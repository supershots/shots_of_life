import type {Mode, StepDefinition} from '../types';

/**
 * 05章「台本」。手順は棚卸し済みの順番（コンタクトは歯磨きと同じ回でまとめ、
 * 電気を消す→スマホを充電するではなく、充電する→電気を消す の順にして
 * 暗闇でケーブルを探させない）。
 *
 * <wait> はここでは waitSeconds として保持する。ここで AI は黙る。
 */
export const STEPS: StepDefinition[] = [
  {
    id: 'opening',
    label: '開口一番',
    location: 'here',
    estimatedSeconds: 8,
    line: {
      normal: 'こんばんは。22時50分です。そろそろ、寝る準備をはじめよう。',
      strict: '22時50分。寝る準備をして。',
    },
  },
  {
    id: 'turn_off_tv',
    label: 'テレビを消す',
    location: 'here',
    estimatedSeconds: 20,
    line: {
      normal: 'テレビ、消せる？　消したら教えて。',
      strict: 'テレビを消して。',
    },
  },
  {
    id: 'brush_and_contacts',
    label: '歯磨き＋コンタクト',
    location: 'away',
    estimatedSeconds: 210,
    line: {
      normal:
        'じゃあ洗面所へ。歯磨きと、コンタクト。両方済ませてきて。終わったら、また掛けるね。',
      strict: '洗面所へ。歯磨きとコンタクトを済ませて。終わったら掛け直す。',
    },
  },
  {
    id: 'charge_phone',
    label: 'スマホを充電する',
    location: 'here',
    estimatedSeconds: 20,
    line: {
      normal: 'おかえり。スマホを、充電器につないで。',
      strict: 'おかえり。充電して。',
    },
  },
  {
    id: 'turn_off_lights',
    label: '部屋の電気を消す',
    location: 'here',
    estimatedSeconds: 18,
    line: {
      normal: '部屋の電気を消して。ここからは暗いままでいい。',
      strict: '電気を消して。',
    },
  },
  {
    id: 'put_down_phone',
    label: 'スマホを置く',
    location: 'here',
    estimatedSeconds: 18,
    line: {
      normal: 'そのまま、スマホを置いて。画面はもう見なくていい。',
      strict: 'スマホを置いて。',
    },
  },
  {
    id: 'close_eyes',
    label: '目を閉じる',
    location: 'here',
    estimatedSeconds: 14,
    line: {
      normal: 'じゃあ、目を閉じて。',
      strict: '目を閉じて。',
    },
  },
];

export const AWAY_STEP_ID = 'brush_and_contacts';
export const FIRST_STEP_AFTER_AWAY_ID = 'charge_phone';
export const LAST_STEP_ID = 'close_eyes';

export function stepIndexById(id: string): number {
  return STEPS.findIndex(s => s.id === id);
}

/**
 * 沈黙時の声かけ（その場ステップのみ。離席ステップは待たずに切る＝該当なし）。
 * 20秒間隔・最大3回・相手が喋ったらリセット（vapiCallConfig.idleSpeechHook）。
 * 催促にしないこと（「まだ？」ではなく「うん。待ってるよ」「急がなくていい」）。
 */
export const IDLE_NUDGES: Record<Mode, string[]> = {
  normal: ['うん、待ってるよ。', '大丈夫。急がなくていい。', 'ここにいるよ。'],
  strict: ['まだだね。', '消して。', '待ってる。'],
};

/** 6章「寝る体勢のあとにスマホを触ったとき」。反応はトーンを下げる方向。 */
export const PHONE_TOUCHED_PROMPTS: Record<Mode, string> = {
  normal: 'まだ起きてるね。もう一回いこうか。',
  strict: '置いて。',
};

/** 6章②「前夜の記録の返し方」。{minutes} を触った分数で置換する。 */
export const PREVIOUS_NIGHT_RECAP: Record<Mode, string> = {
  normal: '昨日は、置いてから{minutes}分触ってたよ。',
  strict: '昨日は置いてから{minutes}分触ってた。今日は置こう。',
};

/** 6章①: 離席中断からの自動再接続までの待ち時間（復帰検知があればそちらが優先）。 */
export const AWAY_RECONNECT_SECONDS: Record<Mode, number> = {
  normal: 210, // 3分30秒
  strict: 180, // 3分
};

/** 6章①-5: 離席から10分経っても復帰しなければ、1回だけ掛けて出なければその晩は終了。 */
export const AWAY_GIVE_UP_SECONDS = 600;

/** 6章②: 途中で切られたときの再着信（間隔・上限はモード依存）。 */
export const REDIAL_CONFIG: Record<Mode, {intervalSeconds: number; maxAttempts: number}> = {
  normal: {intervalSeconds: 5 * 60, maxAttempts: 2},
  strict: {intervalSeconds: 3 * 60, maxAttempts: 4},
};

export function formatRecap(mode: Mode, minutes: number): string {
  return PREVIOUS_NIGHT_RECAP[mode].replace('{minutes}', String(minutes));
}
