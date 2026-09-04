jest.mock('../../native/nativeModules', () => ({
  AlarmSchedulerNative: {
    scheduleNext: jest.fn().mockResolvedValue({timestamp: Date.now()}),
    scheduleAt: jest.fn().mockResolvedValue(true),
    cancel: jest.fn().mockResolvedValue(true),
    canScheduleExactAlarms: jest.fn().mockResolvedValue(true),
  },
  IncomingAlarmNativeModule: {
    consumeLaunchFlag: jest.fn().mockResolvedValue(false),
  },
  CallServiceNative: {
    start: jest.fn().mockResolvedValue(true),
    stop: jest.fn().mockResolvedValue(true),
  },
  WakeScreenNative: {
    keepAwake: jest.fn().mockResolvedValue(true),
    release: jest.fn().mockResolvedValue(true),
  },
  incomingAlarmEmitter: {
    addListener: jest.fn(() => ({remove: jest.fn()})),
  },
}));

import {CallOrchestrator} from '../CallOrchestrator';
import {AlarmSchedulerNative} from '../../native/nativeModules';
import {CallLogStore} from '../CallLogStore';
import {
  AWAY_RECONNECT_SECONDS,
  AWAY_STEP_ID,
  REDIAL_CONFIG,
  STEPS,
} from '../../config/script';
import {REPORT_STEP_TOOL, MARK_TONIGHT_OFF_TOOL} from '../../config/assistant';

// The manual mock at __mocks__/@vapi-ai/react-native.js is auto-applied.
const VapiMockModule = require('@vapi-ai/react-native');

function vapiInstance() {
  const instance = VapiMockModule.__getLastInstance();
  if (!instance) {
    throw new Error('Vapi mock instance not created yet');
  }
  return instance;
}

function reportStep(stepId: string) {
  vapiInstance().emit('message', {
    type: 'tool-calls',
    toolCalls: [{name: REPORT_STEP_TOOL, parameters: {stepId}}],
  });
}

function markTonightOff() {
  vapiInstance().emit('message', {
    type: 'tool-calls',
    toolCalls: [{name: MARK_TONIGHT_OFF_TOOL, parameters: {}}],
  });
}

function endCall() {
  vapiInstance().emit('call-end');
}

// Deep async chains (handleCallEnd -> finalizeNight -> CallLogStore.upsert -> ...)
// need several microtask ticks to fully settle; a couple of awaits isn't enough.
async function flush() {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
}

async function playThroughStep(stepId: string) {
  reportStep(stepId);
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('CallOrchestrator: away-step interruption', () => {
  it('hangs up quietly after the away step, then reconnects on the timer with an away-reconnect resume', async () => {
    jest.useFakeTimers({doNotFake: ['queueMicrotask']});

    await CallOrchestrator.answer();
    await flush();

    for (const step of STEPS) {
      await playThroughStep(step.id);
      if (step.id === AWAY_STEP_ID) {
        break;
      }
    }
    endCall();
    await flush();

    expect(CallOrchestrator.getStatus()).toBe('away_waiting');

    const seconds = AWAY_RECONNECT_SECONDS[CallOrchestrator.getMode()];
    await jest.advanceTimersByTimeAsync(seconds * 1000);
    await flush();

    expect(CallOrchestrator.getStatus()).toBe('in_call');
    const lastStart = vapiInstance().startCalls[vapiInstance().startCalls.length - 1];
    const systemMessage = lastStart.model.messages[0].content as string;
    expect(systemMessage).toContain('おかえり');

    jest.useRealTimers();
  });
});

describe('CallOrchestrator: full night to completion', () => {
  it('walks every step and finalizes as completed, rescheduling tomorrow', async () => {
    await CallOrchestrator.answer();
    await flush();

    for (const step of STEPS) {
      await playThroughStep(step.id);
    }
    endCall();
    await flush();

    expect(CallOrchestrator.getStatus()).toBe('finished');

    const entries = await CallLogStore.all();
    const last = entries[entries.length - 1];
    expect(last.endReason).toBe('completed');
    expect(last.lastCompletedStepIndex).toBe(STEPS.length - 1);
    expect(AlarmSchedulerNative.scheduleNext).toHaveBeenCalled();
  });
});

describe('CallOrchestrator: dropped call redial', () => {
  it('schedules a redial via AlarmManager when the call drops mid-step', async () => {
    await CallOrchestrator.answer();
    await flush();

    await playThroughStep(STEPS[0].id);
    await playThroughStep(STEPS[1].id);
    // drop mid-step (not the away step, not the last step)
    endCall();
    await flush();

    expect(CallOrchestrator.getStatus()).toBe('redial_waiting');
    expect(AlarmSchedulerNative.scheduleAt).toHaveBeenCalled();
  });

  it('gives up silently once the mode-dependent redial limit is reached', async () => {
    await CallOrchestrator.answer();
    await flush();
    await playThroughStep(STEPS[0].id);

    const mode = CallOrchestrator.getMode();
    const {maxAttempts} = REDIAL_CONFIG[mode];

    // First drop starts the redial cycle.
    endCall();
    await flush();
    expect(CallOrchestrator.getStatus()).toBe('redial_waiting');

    // Each redial ring that also drops without reaching a step increments the
    // attempt count; the (maxAttempts+1)th drop overall is the one that finalizes.
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await CallOrchestrator.answerRedial();
      await flush();
      endCall();
      await flush();
    }

    expect(CallOrchestrator.getStatus()).toBe('finished');
    const entries = await CallLogStore.all();
    expect(entries[entries.length - 1].endReason).toBe('dropped');
  });
});

describe('CallOrchestrator: "今日はやめる"', () => {
  it('finalizes as today_off and does not enter the redial flow', async () => {
    await CallOrchestrator.answer();
    await flush();

    await playThroughStep(STEPS[0].id);
    markTonightOff();
    endCall();
    await flush();

    expect(CallOrchestrator.getStatus()).toBe('finished');
    const entries = await CallLogStore.all();
    expect(entries[entries.length - 1].endReason).toBe('today_off');
    expect(AlarmSchedulerNative.scheduleAt).not.toHaveBeenCalled();
  });
});

describe('CallOrchestrator: redial answer resumes from the interrupted step', () => {
  it('seeds the resumed call with the redial resume context for the interrupted step', async () => {
    await CallOrchestrator.answer();
    await flush();
    await playThroughStep(STEPS[0].id);
    await playThroughStep(STEPS[1].id);
    endCall(); // drops while step 2 (index 2) would be next
    await flush();

    await CallOrchestrator.answerRedial();
    await flush();

    const lastStart = vapiInstance().startCalls[vapiInstance().startCalls.length - 1];
    const systemMessage = lastStart.model.messages[0].content as string;
    const resumeStep = STEPS[2];
    expect(systemMessage).toContain(resumeStep.label);
    expect(systemMessage).toContain('続きからいこう');
  });
});

describe('CallOrchestrator: vapi.start() rejects', () => {
  it('emits an error instead of leaving the screen stuck with no signal', async () => {
    const onError = jest.fn();
    CallOrchestrator.on('error', onError);
    const startSpy = jest
      .spyOn(vapiInstance(), 'start')
      .mockRejectedValueOnce(new Error('invalid public key'));

    await CallOrchestrator.answer();
    await flush();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    // status still flips to in_call synchronously before the failed start,
    // matching what the InCallScreen "準備中..." placeholder relies on --
    // the important part is the error is surfaced, not silently swallowed.
    expect(CallOrchestrator.getStatus()).toBe('in_call');

    CallOrchestrator.off('error', onError);
    startSpy.mockRestore();
  });
});
