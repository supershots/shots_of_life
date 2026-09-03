import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Mode} from '../types';

const MODE_KEY = 'sleepguide.mode.v1';

/** 5章: モードは本人が選ぶ。既定は「普通」。 */
export class SettingsStore {
  static async getMode(): Promise<Mode> {
    const value = await AsyncStorage.getItem(MODE_KEY);
    return value === 'strict' ? 'strict' : 'normal';
  }

  static async setMode(mode: Mode): Promise<void> {
    await AsyncStorage.setItem(MODE_KEY, mode);
  }
}
