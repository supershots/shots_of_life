import type {Mode} from '../types';
import {
  AWAY_STEP_ID,
  formatRecap,
  IDLE_NUDGES,
  LAST_STEP_ID,
  PHONE_TOUCHED_PROMPTS,
  STEPS,
} from './script';

export interface ResumeContext {
  /** 前回到達済みの最後のステップ index（このステップの次から再開する）。 */
  lastCompletedStepIndex: number;
  /** 6章②-3: 再着信の開口一番は説明しない。「続きからいこう。◯◯からだね。」で自然に戻す。 */
  isRedial: boolean;
  /** 6章①-4: 離席中断からの再接続。開口一番は「おかえり」。中断について説明しない。 */
  isAwayReconnect: boolean;
}

const BASE_PRINCIPLES = `あなたは就寝ガイドです。相手が寝る準備を終えるまで、手順をひとつずつ案内します。

原則:
- 一度にひとつのことだけ言う。まとめて言わない。
- 短く言う。1文20字以内を目安に。
- 相手が応答するまで待つ。催促しない。急かさない。
- 質問には最小限で答え、雑談は広げない。相手が話し始めても1〜2往復で手順に戻す。
- テンションを上げない。声を張らない。
- 「おやすみ」「よく眠れますように」など、返事をしたくなる言葉で終わらない。
- 怒らない・責めない・声を張らない。厳しめモードでも「短い」のであって「怒っている」のではない。`;

function modeVoiceNote(mode: Mode): string {
  return mode === 'strict'
    ? '声の調子: 厳しめモード。低く、短く、断定的に。語尾は「〜して」で言い切り、修飾語を削る。音量は上げない。'
    : '声の調子: 普通モード。やわらかく、間いかけるように。';
}

function stepsBlock(mode: Mode): string {
  const lines = STEPS.map((step, index) => {
    const n = index + 1;
    const line = `${n}. ${step.label}: 「${step.line[mode]}」`;
    if (step.id === AWAY_STEP_ID) {
      return `${line}\n   → 言い終えたら、相手の返事や反応を待たずに、その場で必ずendCallを呼んで
     通話を終えること。これは「相手が応答するまで待つ」という原則の例外。相手の返事を
     待ってしまうと、待たされたユーザーが不自然に感じる（実機テストで、切ると言った
     あと実際には切らずに待ち続ける不具合が確認されている。ここは待ってはいけない）。
     アプリ側が再接続したら「おかえり」から再開する。中断については説明しない。`;
    }
    if (step.id === LAST_STEP_ID) {
      return `${line}\n   → 確認は求めない。言い終えたら10秒待ち、相手の返事や反応を待たずに、
     何も言わずに必ずendCallを呼んで通話を終えること。これも「相手が応答するまで待つ」
     という原則の例外。`;
    }
    if (step.id === 'put_down_phone') {
      return `${line}\n   → 確認は求めない。`;
    }
    return line;
  });
  return `手順（この順に、ひとつずつ）:\n${lines.join('\n')}`;
}

function idleNudgeNote(mode: Mode): string {
  return `沈黙が続いても催促しない。声かけの言い回しの例: ${IDLE_NUDGES[mode]
    .map(t => `「${t}」`)
    .join('、')}（システム側が20秒間隔・最大3回で自動的に発話の機会を作るので、あなたはその都度この調子で短く応じるだけでよい）。`;
}

function todayOffNote(): string {
  return `相手が「今日はやめる」「もういい」など、その晩の続行を望まない趣旨のことを言ったら、
理由を聞かず「わかった」とだけ返して mark_tonight_off ツールを呼び、そのまま通話を終える（endCall）。
責めない。次の手順には進まない。`;
}

function phoneTouchedNote(mode: Mode): string {
  return `もし「スマホを置いて」以降にもう一度話しかけられたら（画面を再び触った気配があれば）、
トーンを下げて短く応じる: 「${PHONE_TOUCHED_PROMPTS[mode]}」。声を張って覚醒させない。`;
}

function toolBridgeNote(): string {
  return `内部メモ（相手には話さない指示）:
- 上の手順表の各ステップの台詞を言い始める直前に、必ず report_step ツールを
  {"stepId": "<そのステップのid>"} で呼ぶこと。これはアプリ側が進捗を保存するための
  サイレントな呼び出しで、会話には一切影響しない。
- 「今日はやめる」を検知したときは、通話を終える前に mark_tonight_off ツールを呼ぶこと。`;
}

function resumeNote(mode: Mode, resume: ResumeContext): string {
  const resumeStepIndex = resume.lastCompletedStepIndex + 1;
  const resumeStep = STEPS[resumeStepIndex];
  if (!resumeStep) {
    return '';
  }
  // 開口一番はすでに firstMessage（静的な文字列）として再生済み（LLM のターンを
  // 挟むと初手の応答が遅くなるため、buildFirstMessage 側で組み立てて済ませてある）。
  // ここでは「もう一度言わない・繰り返さない」ための文脈だけを渡す。
  if (resume.isAwayReconnect) {
    return `内部メモ: これは離席中断からの再接続。開口一番（「おかえり」に続く一言）は
すでに再生済み。中断や離席について触れない。`;
  }
  if (resume.isRedial) {
    return `内部メモ: これは再着信（前回途中で切れた）。開口一番の「続きからいこう。
${resumeStep.label}からだね。」はすでに再生済み。経緯を説明しない。手順1〜${resumeStepIndex} は
既に完了しているので繰り返さない。`;
  }
  return '';
}

/**
 * 08章「システムプロンプト（下敷き）」の下敷きに加え、通話開始直後の一言目を
 * ここで静的に組み立てる。すべて script.ts の固定文言だけで決まる（LLM の判断は
 * 要らない）ので、firstMessage として渡せば LLM のターンを待たずに即座に話し始め
 * られる。実機テストで「最初の会話のスタートが遅い」と確認された、LLM に開口一番
 * を生成させていたことによる遅延の対策（以前は report_step を追わせるために
 * あえて undefined にしていたが、report_step は client 専用ツールで async: true
 * にしたので、開口一番の report_step 相当はアプリ側で楽観的に反映すれば足りる。
 * CallOrchestrator.beginCall 側を参照）。
 */
export function buildFirstMessage(
  mode: Mode,
  resume?: ResumeContext,
  recapMinutes?: number,
): string | undefined {
  if (!resume) {
    const opening = STEPS[0].line[mode];
    return recapMinutes != null ? `${opening}${formatRecap(mode, recapMinutes)}` : opening;
  }
  const resumeStep = STEPS[resume.lastCompletedStepIndex + 1];
  if (!resumeStep) {
    return undefined;
  }
  if (resume.isAwayReconnect) {
    return resumeStep.line[mode];
  }
  if (resume.isRedial) {
    return `続きからいこう。${resumeStep.label}からだね。${resumeStep.line[mode]}`;
  }
  return undefined;
}

/**
 * 08章「システムプロンプト（下敷き）」を土台に、モードと再開状況を反映して組み立てる。
 * report_step / mark_tonight_off の2つのツール呼び出しは、6章の中断・再着信・
 * 「今日はやめる」をアプリ側で確定的に検出するための実装上の追加（仕様書本文には
 * 明示されていないが、「到達済みステップは端末に保持しておく」を実現するために必要）。
 */
export function buildSystemPrompt(mode: Mode, resume?: ResumeContext): string {
  const parts = [
    BASE_PRINCIPLES,
    modeVoiceNote(mode),
    stepsBlock(mode),
    idleNudgeNote(mode),
    todayOffNote(),
    phoneTouchedNote(mode),
    toolBridgeNote(),
  ];
  if (resume) {
    const note = resumeNote(mode, resume);
    if (note) {parts.push(note);}
  }
  return parts.join('\n\n');
}
