import {buildFirstMessage, buildSystemPrompt} from '../systemPrompt';
import {
  AWAY_STEP_ID,
  formatRecap,
  LAST_STEP_ID,
  STEPS,
  stepIndexById,
} from '../script';

describe('script.ts step table', () => {
  it('keeps the away step (歯磨き＋コンタクト) as the only away-location step', () => {
    const awayIndices = STEPS.filter(s => s.location === 'away').map(s => s.id);
    expect(awayIndices).toEqual([AWAY_STEP_ID]);
  });

  it('orders charge-phone before lights-off, and lights-off before put-down-phone', () => {
    // 05章「見つかった順番の問題」②: 暗闇でケーブルを探させない。
    const chargeIndex = stepIndexById('charge_phone');
    const lightsIndex = stepIndexById('turn_off_lights');
    const putDownIndex = stepIndexById('put_down_phone');
    expect(chargeIndex).toBeLessThan(lightsIndex);
    expect(lightsIndex).toBeLessThan(putDownIndex);
  });

  it('ends with the close-eyes step', () => {
    expect(STEPS[STEPS.length - 1].id).toBe(LAST_STEP_ID);
  });

  it('formats the previous-night recap per mode', () => {
    expect(formatRecap('normal', 7)).toContain('7');
    expect(formatRecap('normal', 7)).not.toBe(formatRecap('strict', 7));
  });
});

describe('buildSystemPrompt', () => {
  it('includes every step label and the chosen mode line for a fresh call', () => {
    const prompt = buildSystemPrompt('normal');
    for (const step of STEPS) {
      expect(prompt).toContain(step.label);
      expect(prompt).toContain(step.line.normal);
    }
    expect(prompt).not.toContain(STEPS[0].line.strict);
  });

  it('instructs a silent hangup after the away step without explaining the interruption', () => {
    const prompt = buildSystemPrompt('normal');
    expect(prompt).toContain('endCall');
    expect(prompt).toContain('中断については説明しない');
  });

  it('adds a resume note for redial that names the step to continue from', () => {
    const prompt = buildSystemPrompt('normal', {
      lastCompletedStepIndex: 1, // completed steps 0-1 (opening, tv)
      isRedial: true,
      isAwayReconnect: false,
    });
    const resumeStep = STEPS[2];
    expect(prompt).toContain(resumeStep.label);
    expect(prompt).toContain('続きからいこう');
  });

  it('adds an "おかえり" resume note for an away reconnect instead of a redial note', () => {
    const awayIndex = stepIndexById(AWAY_STEP_ID);
    const prompt = buildSystemPrompt('strict', {
      lastCompletedStepIndex: awayIndex,
      isRedial: false,
      isAwayReconnect: true,
    });
    expect(prompt).toContain('おかえり');
    expect(prompt).not.toContain('続きからいこう');
  });

});

describe('buildFirstMessage', () => {
  // 開口一番は script.ts の固定文言だけで決まるので、LLM を介さず静的な文字列
  // として組み立てる（LLM に生成させると通話開始直後の応答が遅くなるため）。
  it('returns the fixed opening line for a fresh call', () => {
    expect(buildFirstMessage('normal')).toBe(STEPS[0].line.normal);
  });

  it('appends the previous-night recap after the opening line on a fresh call', () => {
    const withRecap = buildFirstMessage('normal', undefined, 7);
    expect(withRecap).toContain(STEPS[0].line.normal);
    expect(withRecap).toContain('7');
  });

  it('returns just the resume step line for an away reconnect (already says "おかえり")', () => {
    const awayIndex = stepIndexById(AWAY_STEP_ID);
    const resumeStep = STEPS[awayIndex + 1];
    expect(
      buildFirstMessage('normal', {
        lastCompletedStepIndex: awayIndex,
        isRedial: false,
        isAwayReconnect: true,
      }),
    ).toBe(resumeStep.line.normal);
  });

  it('returns a "続きからいこう" transition into the resume step for a redial', () => {
    const message = buildFirstMessage('normal', {
      lastCompletedStepIndex: 0,
      isRedial: true,
      isAwayReconnect: false,
    });
    const resumeStep = STEPS[1];
    expect(message).toContain('続きからいこう');
    expect(message).toContain(resumeStep.label);
    expect(message).toContain(resumeStep.line.normal);
  });
});
