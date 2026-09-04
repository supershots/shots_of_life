/**
 * 03章「設定値 —— ここが本体」。
 *
 * このプロダクトの価値は台詞ではなく間（ま）にある。既定値のままだと確実に壊れる項目
 * なので、ここを最初に固めてから台詞（script.ts / systemPrompt.ts）を書くこと。
 *
 * フィールド名は Vapi Assistant のスキーマに合わせてある（2026年時点でドキュメントを
 * 参照して確認したもの）。Vapi 側の仕様が変わることがあるので、着手時に
 * https://docs.vapi.ai/assistants/speech-configuration と
 * https://docs.vapi.ai/assistants/assistant-hooks を必ず現行ドキュメントで確認してから
 * 値を反映すること（08章「Claude Code への渡し方」より）。
 */

/** 沈黙まわり以外の通話全体設定。 */
export const callTuning = {
  /** 無音で通話を切らせない。既定30秒は歯磨きで席を外した瞬間に切れてしまう。 */
  silenceTimeoutSeconds: 600,
  /** 暴走時の保険。 */
  maxDurationSeconds: 900,
  /** 寝る前にオフィス環境音は論外なので off 固定。 */
  backgroundSound: 'off' as const,
};

/** startSpeakingPlan: いつ喋り始めるか。 */
export const startSpeakingPlan = {
  /** 相手が言い終わるのを待つ秒数。既定0.4は速すぎて食い気味になる。 */
  waitSeconds: 1.2,
  smartEndpointingPlan: {
    /** 非英語には vapi 実装を推奨（LiveKit は英語向け）。 */
    provider: 'vapi' as const,
  },
  transcriptionEndpointingPlan: {
    /** 句読点なしの発話を切らない。 */
    onNoPunctuationSeconds: 1.8,
  },
};

/** stopSpeakingPlan: ユーザーの相槌で AI の発話が中断されないようにする。 */
export const stopSpeakingPlan = {
  /** 「うん」程度（既定0語）で発話を止めない。3語以上の割り込みだけ受け付ける。 */
  numWords: 3,
  /** 割り込まれたあと、少し置いてから再開する。 */
  backoffSeconds: 1.4,
};

/**
 * 沈黙時の声かけ（20秒・最大3回・喋ったらリセット）。
 *
 * 03章では2系統（messagePlan.idleMessages と hooks の customer.speech.timeout）が
 * あることを明示しており、着手時にどちらが現行仕様か確認するよう指示されている。
 * ここでは 2026年時点のドキュメント確認により hooks 方式を採用しているが、
 * Vapi ダッシュボード/最新ドキュメントで再確認してから使うこと。
 */
export const idleSpeechHook = {
  on: 'customer.speech.timeout' as const,
  options: {
    timeoutSeconds: 20,
    triggerMaxCount: 3,
    /** 相手が喋ったらカウントをリセットする。 */
    triggerResetMode: 'onUserSpeech' as const,
  },
};

/** LLM / 音声認識 / 音声合成。7章のコスト前提と対応する。 */
export const modelConfig = {
  provider: 'openai' as const,
  model: 'gpt-4o-mini' as const,
};

export const transcriberConfig = {
  provider: 'deepgram' as const,
  language: 'ja' as const,
};

export const voiceConfig = {
  provider: '11labs' as const,
  /**
   * eleven_turbo_v2_5 / eleven_flash 系は低遅延優先で、日本語の発音精度が
   * 落ちる（実機テストで「日本語の精度が甘い」と確認済み）。このアプリは
   * 相槌のリアルタイム性より聞き取りやすさが重要なので、多言語向けに
   * 品質が高い eleven_multilingual_v2 を使う。
   */
  model: 'eleven_multilingual_v2' as const,
  /**
   * 04章: 声は必ず実機のスピーカーで選ぶこと（PC/ヘッドホンで選ぶと圧縮後に別物になる）。
   * ここは人間にしか決められない。候補を3つに絞って実機比較した結果の voiceId を入れる。
   */
  voiceId: 'a0MsDWokG5Xsuji8g8er',
};

/**
 * 06章 / 08章④: 離席ステップの自己終了と、最終ステップの無言切断は、アシスタント自身に
 * 通話を終える能力（endCall 関数）を持たせて実現する。呼び出し条件は systemPrompt.ts の
 * 指示文だけに委ねる（システムプロンプトが仕様、と08章に明記されている）。
 */
export const endCallFunctionEnabled = true;
