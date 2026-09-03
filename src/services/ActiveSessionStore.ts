import AsyncStorage from '@react-native-async-storage/async-storage';
import type {CallSession} from '../types';

const KEY = 'sleepguide.activeSession.v1';

/**
 * 進行中の晩のセッションを永続化する。
 *
 * 6章②「再着信」は AlarmManager（setAlarmClock）でネイティブ側から叩き起こす方式に
 * したので、間隔待ちの間にアプリのプロセスが OS に殺されてもよい設計になっている。
 * その代わり、プロセスが生き返ったときに「これは再着信で、どのステップから
 * 再開すべきか」を知るための最小限の状態をここに保存しておく。
 */
export class ActiveSessionStore {
  static async save(session: CallSession): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
  }

  static async load(): Promise<CallSession | null> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {return null;}
    try {
      return JSON.parse(raw) as CallSession;
    } catch {
      return null;
    }
  }

  static async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  }
}
