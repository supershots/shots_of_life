/** 5章: 普通 / 厳しめ の2モード。 */
export type Mode = 'normal' | 'strict';

/** 5章の手順表。'away' は離席ステップ（洗面所）、'here' はその場。 */
export type StepLocation = 'here' | 'away';

export interface StepDefinition {
  id: string;
  label: string;
  location: StepLocation;
  estimatedSeconds: number;
  /** モード別の台詞（AI がこの手順で言う一文）。 */
  line: Record<Mode, string>;
}

/** 沈黙時の声かけ文言（モード別）。 */
export interface IdlePrompt {
  location: StepLocation;
  text: Record<Mode, string>;
}

export type CallEndReason =
  | 'completed' // 目を閉じてまで到達し、無言で切れた
  | 'away_interruption' // 離席ステップで「また掛けるね」→ 自ら切った
  | 'today_off' // 「今日はやめる」で終わった
  | 'dropped' // 想定外に切れた／出なかった（途中）
  | 'declined' // 着信を応答しなかった／閉じた
  | 'unknown';

export interface CallSession {
  /** その晩を通して不変。複数回の通話（離席の再接続や再着信）をまとめる単位。 */
  nightId: string;
  mode: Mode;
  /** 到達済みの最後のステップ index（-1 は未着手）。6章「到達済みステップは端末に保持」。 */
  lastCompletedStepIndex: number;
  /** この晩は再着信・再接続をしない、のフラグ（「今日はやめる」）。 */
  skipRedialTonight: boolean;
  /** 今晩すでに行った再着信（②途中で切られた）の回数。 */
  redialAttempts: number;
  /** 離席中断からの再接続を試みた回数（10分待っても戻らなければ1回だけ、6章①-5）。 */
  awayReconnectAttempts: number;
  startedAt: number;
  endedAt?: number;
  endReason?: CallEndReason;
  transcript: TranscriptTurn[];
}

export interface TranscriptTurn {
  role: 'assistant' | 'user' | 'system';
  text: string;
  at: number;
}

export interface NightLogEntry {
  nightId: string;
  mode: Mode;
  startedAt: number;
  endedAt?: number;
  endReason?: CallEndReason;
  lastCompletedStepIndex: number;
  redialAttempts: number;
  awayReconnectAttempts: number;
  /** 「寝る体勢のあとにスマホを触った」ことが何回あったか（6章、継続率の予測変数として記録のみ）。 */
  touchedAfterDownCount: number;
  /** 置いてから最初に触るまでの分数。「前夜の記録の返し方」の recap に使う。 */
  touchedAfterDownFirstLatencyMinutes?: number;
  transcript: TranscriptTurn[];
}
