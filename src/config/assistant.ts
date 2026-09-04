import type {Mode} from '../types';
import {
  callTuning,
  endCallFunctionEnabled,
  modelConfig,
  startSpeakingPlan,
  stopSpeakingPlan,
  transcriberConfig,
  voiceConfig,
} from './vapiCallConfig';
import {buildSystemPrompt, ResumeContext} from './systemPrompt';
import type {TranscriptTurn} from '../types';

export const REPORT_STEP_TOOL = 'report_step';
export const MARK_TONIGHT_OFF_TOOL = 'mark_tonight_off';

/**
 * サーバーを持たない構成（02章）なので、Vapi の Assistant はダッシュボードに事前作成
 * せず、通話のたびにこのインライン設定オブジェクトを vapi.start() に渡す。
 * こうすることで、公開鍵だけをアプリに埋め込めばよく、通話ごとにモード
 * （普通/厳しめ）や再開コンテキストを反映した system prompt を作り直せる。
 *
 * priorTranscript を渡すと、離席中断からの再接続・再着信のときに直前までの
 * 会話をそのまま model.messages に積む。「続きからいこう」を LLM の想像に
 * 任せず、実際の会話履歴で裏付ける（6章「到達済みステップは端末に保持しておく」）。
 */
export function buildAssistantConfig(
  mode: Mode,
  resume?: ResumeContext,
  priorTranscript?: TranscriptTurn[],
  recapMinutes?: number,
) {
  const priorMessages = (priorTranscript ?? [])
    .filter(turn => turn.role !== 'system')
    .map(turn => ({role: turn.role, content: turn.text}));

  return {
    name: 'nemuri-guide',
    // firstMessage は与えない（LLM に system prompt の手順1から生成させ、
    // report_step を呼ばせる）。ただし firstMessageMode は明示しておかないと
    // 既定が「ユーザーが話すのを待つ」側になり、AI が一言も発しないまま
    // 沈黙し続ける（実機ログで charactersUsed:0 のまま無言待機を確認済み）。
    firstMessageMode: 'assistant-speaks-first' as const,
    model: {
      provider: modelConfig.provider,
      model: modelConfig.model,
      messages: [
        {
          role: 'system' as const,
          content: buildSystemPrompt(mode, resume, recapMinutes),
        },
        ...priorMessages,
      ],
      tools: [
        {
          type: 'function' as const,
          function: {
            name: REPORT_STEP_TOOL,
            description:
              'いま案内しているステップをアプリ側に記録するための、相手には聞こえない内部呼び出し。',
            parameters: {
              type: 'object' as const,
              properties: {
                stepId: {type: 'string' as const},
              },
              required: ['stepId'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: MARK_TONIGHT_OFF_TOOL,
            description:
              '相手が今夜はもう続けたくない旨を伝えたときに呼ぶ、相手には聞こえない内部呼び出し。',
            parameters: {
              type: 'object' as const,
              properties: {},
            },
          },
        },
      ],
    },
    voice: {
      provider: voiceConfig.provider,
      voiceId: voiceConfig.voiceId,
      model: voiceConfig.model,
    },
    transcriber: {
      provider: transcriberConfig.provider,
      language: transcriberConfig.language,
    },
    silenceTimeoutSeconds: callTuning.silenceTimeoutSeconds,
    maxDurationSeconds: callTuning.maxDurationSeconds,
    backgroundSound: callTuning.backgroundSound,
    startSpeakingPlan,
    stopSpeakingPlan,
    endCallFunctionEnabled,
    // hooks: [idleSpeechHook] はいったん外してある。実機テストで通話開始が
    // 400 Bad Request になったため、最も推測で書いた（現行ドキュメント未確認の）
    // このフィールドから疑って外した。通話が繋がることを確認してから、
    // 現行の Vapi ドキュメントで正しい形を確認のうえ戻すこと（03章参照）。
  };
}

/**
 * 6章「寝る体勢のあとにスマホを触ったとき」用の、一言だけ言って自ら切る
 * 短いお知らせ通話。手順の再開ではないので、手順表や report_step ツールは含めない。
 */
export function buildAnnouncementAssistantConfig(text: string) {
  return {
    name: 'nemuri-guide-announcement',
    firstMessage: text,
    firstMessageMode: 'assistant-speaks-first' as const,
    model: {
      provider: modelConfig.provider,
      model: modelConfig.model,
      messages: [
        {
          role: 'system' as const,
          content: `あなたは就寝ガイドです。相手が寝る体勢に入ったあとにもう一度端末を
触ったので、一言だけ短く声をかけます。「${text}」と言い終えたら、5秒待ってから
何も言わず通話を終えてください（endCall）。それ以外の話はしません。`,
        },
      ],
    },
    voice: {
      provider: voiceConfig.provider,
      voiceId: voiceConfig.voiceId,
      model: voiceConfig.model,
    },
    transcriber: {
      provider: transcriberConfig.provider,
      language: transcriberConfig.language,
    },
    silenceTimeoutSeconds: 60,
    maxDurationSeconds: 60,
    backgroundSound: callTuning.backgroundSound,
    startSpeakingPlan,
    stopSpeakingPlan,
    endCallFunctionEnabled: true,
  };
}
