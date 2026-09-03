import {NativeEventEmitter, NativeModules} from 'react-native';

interface AlarmSchedulerNative {
  scheduleNext(hour: number, minute: number): Promise<{timestamp: number}>;
  scheduleAt(timestampMs: number): Promise<boolean>;
  cancel(): Promise<boolean>;
  canScheduleExactAlarms(): Promise<boolean>;
}

interface IncomingAlarmNative {
  consumeLaunchFlag(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

interface CallServiceNative {
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
}

interface WakeScreenNative {
  keepAwake(): Promise<boolean>;
  release(): Promise<boolean>;
}

/**
 * ネイティブモジュールは実機ビルドでのみリンクされる。Jest やこの環境のように
 * ネイティブアプリをビルドできない場所でも import 自体は失敗させたくないので、
 * 実際にメソッドを呼んだときだけ分かりやすいエラーを出す Proxy にしてある。
 */
function lazyModule<T extends object>(name: string): T {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        const mod = NativeModules[name];
        if (!mod) {
          return () =>
            Promise.reject(
              new Error(
                `Native module "${name}" is not linked. 実機向けにネイティブビルドし直してください` +
                  '（Metro の再起動だけでは反映されません）。',
              ),
            );
        }
        return mod[prop];
      },
    },
  ) as T;
}

export const AlarmSchedulerNative = lazyModule<AlarmSchedulerNative>('AlarmScheduler');
export const IncomingAlarmNativeModule = lazyModule<IncomingAlarmNative>('IncomingAlarm');
export const CallServiceNative = lazyModule<CallServiceNative>('CallService');
export const WakeScreenNative = lazyModule<WakeScreenNative>('WakeScreen');

function createIncomingAlarmEmitter(): NativeEventEmitter {
  if (!NativeModules.IncomingAlarm) {
    // ネイティブビルドが無い環境（Jest 等）向けのダミー実装。
    return {
      addListener: () => ({remove: () => {}}),
      removeAllListeners: () => {},
      listenerCount: () => 0,
      emit: () => {},
    } as unknown as NativeEventEmitter;
  }
  return new NativeEventEmitter(NativeModules.IncomingAlarm);
}

export const incomingAlarmEmitter = createIncomingAlarmEmitter();
