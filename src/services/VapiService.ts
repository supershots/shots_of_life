import Vapi from '@vapi-ai/react-native';
import type {Mode, TranscriptTurn} from '../types';
import {
  buildAnnouncementAssistantConfig,
  buildAssistantConfig,
  MARK_TONIGHT_OFF_TOOL,
  REPORT_STEP_TOOL,
} from '../config/assistant';
import type {ResumeContext} from '../config/systemPrompt';
import {VAPI_PUBLIC_KEY} from '../config/secrets';

export type VapiCallEndReason = string | undefined;

export interface VapiServiceEvents {
  onCallStart?: () => void;
  onCallEnd?: (reason: VapiCallEndReason) => void;
  onStepReported?: (stepId: string) => void;
  onTonightOff?: () => void;
  onTranscript?: (turn: TranscriptTurn) => void;
  onError?: (error: unknown) => void;
}

/**
 * @vapi-ai/react-native の薄いラッパー。02章「通話部分は実質 vapi.start() の1行」。
 * 中断・再着信・「今日はやめる」の判定に必要なイベント（report_step /
 * mark_tonight_off ツール呼び出し、call-end の理由）だけをアプリ向けに整形する。
 */
export class VapiService {
  private client: Vapi;
  private handlers: VapiServiceEvents = {};

  constructor() {
    this.client = new Vapi(VAPI_PUBLIC_KEY);
    this.client.on('call-start', () => this.handlers.onCallStart?.());
    this.client.on('call-end', () => {
      // Vapi の call-end イベント自体には終了理由が同梱されないビルドがあるため、
      // 直近の 'message' で来る status-update/end-of-call-report を見て理由を拾う。
      this.handlers.onCallEnd?.(this.lastEndedReason);
      this.lastEndedReason = undefined;
    });
    this.client.on('message', (message: any) => this.handleMessage(message));
    this.client.on('error', (error: unknown) => this.handlers.onError?.(error));
  }

  private lastEndedReason: VapiCallEndReason;

  on(handlers: VapiServiceEvents) {
    this.handlers = {...this.handlers, ...handlers};
  }

  private handleMessage(message: any) {
    if (!message || typeof message !== 'object') {return;}

    if (message.type === 'tool-calls' && Array.isArray(message.toolCalls)) {
      for (const call of message.toolCalls) {
        const name = call?.name ?? call?.function?.name;
        const args = call?.parameters ?? call?.arguments ?? {};
        if (name === REPORT_STEP_TOOL && args?.stepId) {
          this.handlers.onStepReported?.(String(args.stepId));
        } else if (name === MARK_TONIGHT_OFF_TOOL) {
          this.handlers.onTonightOff?.();
        }
      }
      return;
    }

    if (message.type === 'transcript' && message.transcriptType === 'final') {
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      this.handlers.onTranscript?.({
        role,
        text: String(message.transcript ?? ''),
        at: Date.now(),
      });
      return;
    }

    if (message.type === 'end-of-call-report') {
      // message ペイロードの正確な形（'end-of-call-report' という type 名や
      // endedReason フィールド名）は、実機で adb logcat / vapi.on('message') を
      // 実際に流して確認してから固めること（08章「推測で直させない」）。
      this.lastEndedReason = message.endedReason;
    }
  }

  async start(
    mode: Mode,
    resume?: ResumeContext,
    priorTranscript?: TranscriptTurn[],
    recapMinutes?: number,
  ) {
    const assistant = buildAssistantConfig(mode, resume, priorTranscript, recapMinutes);
    await this.client.start(assistant as never);
  }

  /**
   * 6章「寝る体勢のあとにスマホを触ったとき」用の、一言だけの短い通話。
   * 通常フローの call-end ハンドラ（中断・再着信の判定）を巻き込まないよう、
   * このお知らせ通話が終わるまでハンドラを一時的に差し替えて待つ。
   */
  async speakAnnouncement(text: string): Promise<void> {
    const assistant = buildAnnouncementAssistantConfig(text);
    const previousHandlers = this.handlers;
    return new Promise((resolve, reject) => {
      this.handlers = {
        onCallEnd: () => {
          this.handlers = previousHandlers;
          resolve();
        },
        onError: error => {
          this.handlers = previousHandlers;
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      };
      this.client.start(assistant as never).catch(error => {
        this.handlers = previousHandlers;
        reject(error);
      });
    });
  }

  stop() {
    this.client.stop();
  }
}
