import AsyncStorage from '@react-native-async-storage/async-storage';
import type {NightLogEntry} from '../types';

const STORAGE_KEY = 'sleepguide.nightLogs.v1';
const MAX_ENTRIES = 60;

/**
 * 01章「通話ログ（開始・終了・文字起こし）を保存する — Vapi 側に残る」を補う、
 * 端末側の最小限の夜ログ。Vapi のダッシュボードにも通話自体のログは残るが、
 * アプリ内でモード切替の効果や継続率を振り返れるように、ここにも要点だけ持つ。
 */
export class CallLogStore {
  static async all(): Promise<NightLogEntry[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {return [];}
    try {
      return JSON.parse(raw) as NightLogEntry[];
    } catch {
      return [];
    }
  }

  static async upsert(entry: NightLogEntry): Promise<void> {
    const entries = await this.all();
    const idx = entries.findIndex(e => e.nightId === entry.nightId);
    if (idx >= 0) {
      entries[idx] = entry;
    } else {
      entries.push(entry);
    }
    entries.sort((a, b) => a.startedAt - b.startedAt);
    const trimmed = entries.slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }

  /** 直近で終了している夜ログ（recap 用）。今夜のぶんは除く。 */
  static async mostRecentBefore(nightId: string): Promise<NightLogEntry | undefined> {
    const entries = await this.all();
    return [...entries].reverse().find(e => e.nightId !== nightId && e.endedAt != null);
  }
}
