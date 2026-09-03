import {AppState, AppStateStatus} from 'react-native';
import {EventEmitter} from 'events';
import {VapiService} from './VapiService';
import {CallLogStore} from './CallLogStore';
import {SettingsStore} from './SettingsStore';
import {ActiveSessionStore} from './ActiveSessionStore';
import {AlarmSchedulerNative, CallServiceNative, WakeScreenNative} from '../native/nativeModules';
import {BEDTIME_HOUR, BEDTIME_MINUTE, SLEEP_RELEASE_MS} from '../config/schedule';
import {
  AWAY_RECONNECT_SECONDS,
  AWAY_STEP_ID,
  LAST_STEP_ID,
  PHONE_TOUCHED_PROMPTS,
  REDIAL_CONFIG,
  stepIndexById,
} from '../config/script';
import type {CallEndReason, CallSession, Mode, NightLogEntry, TranscriptTurn} from '../types';

export type OrchestratorStatus =
  | 'idle'
  | 'in_call'
  | 'away_waiting'
  | 'redial_waiting'
  | 'finished';

const AWAY_STEP_INDEX = stepIndexById(AWAY_STEP_ID);
const LAST_STEP_INDEX = stepIndexById(LAST_STEP_ID);

function todayNightId(d = new Date()): string {
  // 深夜0時をまたいでも同じ「晩」として扱うため、正午基準で日付境界を決める。
  const shifted = new Date(d);
  if (shifted.getHours() < 12) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return shifted.toISOString().slice(0, 10);
}

/**
 * 03〜06章の状態機械。画面（IncomingCallScreen/InCallScreen/HomeScreen）は
 * このシングルトンのイベントを購読するだけで、通話・中断・再着信・モード切替の
 * 判断ロジックには触れない。
 */
class CallOrchestratorImpl extends EventEmitter {
  private vapi = new VapiService();
  private session: CallSession | null = null;
  private mode: Mode = 'normal';
  private currentStepIndex = -1;
  private status: OrchestratorStatus = 'idle';

  private awayReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sleepReleaseTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSub: {remove: () => void} | null = null;
  private awaitingAwayReturn = false;

  constructor() {
    super();
    this.vapi.on({
      onCallStart: () => this.emit('callStart'),
      onCallEnd: reason => void this.handleCallEnd(reason),
      onStepReported: stepId => this.handleStepReported(stepId),
      onTonightOff: () => this.handleTonightOff(),
      onTranscript: turn => this.handleTranscript(turn),
      onError: error => this.emit('error', error),
    });
    SettingsStore.getMode().then(mode => {
      this.mode = mode;
    });
    this.appStateSub = AppState.addEventListener('change', s => this.handleAppStateChange(s));
  }

  getStatus(): OrchestratorStatus {
    return this.status;
  }

  getMode(): Mode {
    return this.mode;
  }

  async setMode(mode: Mode) {
    this.mode = mode;
    await SettingsStore.setMode(mode);
    this.emit('modeChanged', mode);
  }

  private setStatus(status: OrchestratorStatus) {
    this.status = status;
    this.emit('statusChanged', status);
  }

  /** 起動時に1回呼ぶ。翌日ぶんの着信を張る（6章「実装の流れ」1番）。 */
  async ensureAlarmScheduled(): Promise<void> {
    await AlarmSchedulerNative.scheduleNext(BEDTIME_HOUR, BEDTIME_MINUTE);
  }

  /**
   * 着信画面が表示された直後に1回呼ぶ。今夜すでに進行中のセッション（再着信待ち）が
   * 永続化されていれば復元し、'redial' を返す。無ければ 'fresh'。
   * プロセスが再着信のあいだに OS に殺されていても、ここで復元できる。
   */
  async prepareForIncomingAlarm(): Promise<'fresh' | 'redial'> {
    if (this.session && this.status === 'redial_waiting') {
      return 'redial';
    }
    const saved = await ActiveSessionStore.load();
    if (saved && saved.nightId === todayNightId() && !saved.endedAt) {
      this.session = saved;
      this.status = 'redial_waiting';
      return 'redial';
    }
    return 'fresh';
  }

  /** 着信画面で「応答」を押したときの入口（新規の晩）。 */
  async answer(): Promise<void> {
    this.clearAwayTimer();
    await ActiveSessionStore.clear();
    const nightId = todayNightId();
    this.session = {
      nightId,
      mode: this.mode,
      lastCompletedStepIndex: -1,
      skipRedialTonight: false,
      redialAttempts: 0,
      awayReconnectAttempts: 0,
      startedAt: Date.now(),
      transcript: [],
    };
    const previous = await CallLogStore.mostRecentBefore(nightId).catch(() => undefined);
    await this.beginCall(undefined, previous?.touchedAfterDownFirstLatencyMinutes);
  }

  /** 通話中画面の非常口。ユーザーが自分で切ったときは「想定外の中断」と同じ扱いになる。 */
  hangup(): void {
    this.vapi.stop();
  }

  /** 再着信の着信画面で「応答」を押したとき。中断したステップから再開する。 */
  async answerRedial(): Promise<void> {
    if (!this.session) {
      await this.answer();
      return;
    }
    await this.beginCall({
      lastCompletedStepIndex: this.session.lastCompletedStepIndex,
      isRedial: true,
      isAwayReconnect: false,
    });
  }

  /**
   * 再着信の着信画面を「閉じる」で応答しなかったとき。上限に達していなければ
   * 次の間隔でまた掛け直す（「出なければその晩は終了」は上限到達時だけ）。
   */
  async declineRedial(): Promise<void> {
    if (!this.session) {return;}
    await this.enterRedialWaiting();
  }

  private async beginCall(
    resume?: {
      lastCompletedStepIndex: number;
      isRedial: boolean;
      isAwayReconnect: boolean;
    },
    recapMinutes?: number,
  ): Promise<void> {
    if (!this.session) {return;}
    this.currentStepIndex = -1;
    this.setStatus('in_call');
    await CallServiceNative.start();
    await WakeScreenNative.keepAwake();
    await this.persistSession();
    await this.vapi.start(this.mode, resume, this.session.transcript, recapMinutes);
  }

  private handleStepReported(stepId: string) {
    const index = stepIndexById(stepId);
    if (index < 0 || !this.session) {return;}
    this.currentStepIndex = index;
    this.session.lastCompletedStepIndex = Math.max(
      this.session.lastCompletedStepIndex,
      index - 1,
    );
    void this.persistSession();
    this.emit('stepChanged', index);
  }

  private handleTonightOff() {
    if (!this.session) {return;}
    this.session.skipRedialTonight = true;
  }

  private handleTranscript(turn: TranscriptTurn) {
    this.session?.transcript.push(turn);
    this.emit('transcript', turn);
  }

  private async persistSession(): Promise<void> {
    if (this.session) {
      await ActiveSessionStore.save(this.session);
    }
  }

  private async handleCallEnd(_reason: string | undefined): Promise<void> {
    const session = this.session;
    if (!session) {return;}

    if (session.skipRedialTonight) {
      await this.finalizeNight('today_off');
      return;
    }

    if (this.currentStepIndex === AWAY_STEP_INDEX) {
      // 離席ステップを言い終えて自ら切った ＝ 意図された中断（6章①）。
      session.lastCompletedStepIndex = AWAY_STEP_INDEX;
      await this.persistSession();
      this.enterAwayWaiting();
      return;
    }

    if (this.currentStepIndex === LAST_STEP_INDEX) {
      // report_step は「このステップに入った」時点で呼ばれるので、lastCompletedStepIndex
      // は index-1 までしか進まない。最終ステップを言い切って自ら切ったのは完了の
      // 証拠なので、ここで初めて最後のステップ自体を「完了」に含める。
      session.lastCompletedStepIndex = LAST_STEP_INDEX;
      await this.finalizeNight('completed');
      return;
    }

    // それ以外で切れた＝想定外の中断。再着信で拾う（6章②）。
    await this.enterRedialWaiting();
  }

  private enterAwayWaiting() {
    this.setStatus('away_waiting');
    const seconds = AWAY_RECONNECT_SECONDS[this.mode];
    this.awaitingAwayReturn = true;
    // 離席中は画面を見ていないので、点けっぱなしにする理由がない。
    void WakeScreenNative.release();
    // ただしフォアグラウンドサービスは維持したままにする（復帰検知/タイマーの
    // どちらで再接続するかはプロセスが生きていないと判定できないため）。
    this.awayReconnectTimer = setTimeout(() => {
      void this.reconnectAfterAway();
    }, seconds * 1000);
  }

  private clearAwayTimer() {
    if (this.awayReconnectTimer) {
      clearTimeout(this.awayReconnectTimer);
      this.awayReconnectTimer = null;
    }
    this.awaitingAwayReturn = false;
  }

  private async reconnectAfterAway(): Promise<void> {
    if (!this.session || this.status !== 'away_waiting') {return;}
    this.clearAwayTimer();
    this.session.awayReconnectAttempts += 1;
    await this.beginCall({
      lastCompletedStepIndex: this.session.lastCompletedStepIndex,
      isRedial: false,
      isAwayReconnect: true,
    });
  }

  private async enterRedialWaiting(): Promise<void> {
    if (!this.session) {return;}
    const config = REDIAL_CONFIG[this.mode];
    if (this.session.redialAttempts >= config.maxAttempts) {
      await this.finalizeNight('dropped');
      return;
    }
    this.session.redialAttempts += 1;
    this.setStatus('redial_waiting');
    await CallServiceNative.stop().catch(() => {});
    await WakeScreenNative.release().catch(() => {});
    await this.persistSession();
    // 6章②: 再着信は全画面着信（離席中断の静かな再接続とは違う）。
    // AlarmManager 経由にすることで、間隔待ちの間にプロセスが落ちても構わない。
    const at = Date.now() + config.intervalSeconds * 1000;
    await AlarmSchedulerNative.scheduleAt(at).catch(error => this.emit('error', error));
  }

  private async finalizeNight(reason: CallEndReason): Promise<void> {
    const session = this.session;
    if (!session) {return;}
    session.endedAt = Date.now();
    session.endReason = reason;

    const entry: NightLogEntry = {
      nightId: session.nightId,
      mode: session.mode,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      endReason: session.endReason,
      lastCompletedStepIndex: session.lastCompletedStepIndex,
      redialAttempts: session.redialAttempts,
      awayReconnectAttempts: session.awayReconnectAttempts,
      touchedAfterDownCount: 0,
      transcript: session.transcript,
    };
    await CallLogStore.upsert(entry);
    await ActiveSessionStore.clear();

    this.setStatus('finished');
    this.clearAwayTimer();
    await CallServiceNative.stop().catch(() => {});
    await this.ensureAlarmScheduled();
    this.armSleepRelease();
    this.emit('nightFinished', entry);
  }

  private armSleepRelease() {
    if (this.sleepReleaseTimer) {clearTimeout(this.sleepReleaseTimer);}
    this.sleepReleaseTimer = setTimeout(() => {
      void WakeScreenNative.release();
    }, SLEEP_RELEASE_MS);
  }

  private handleAppStateChange(state: AppStateStatus) {
    if (state !== 'active') {return;}

    if (this.status === 'away_waiting' && this.awaitingAwayReturn) {
      void this.reconnectAfterAway();
      return;
    }

    if (this.status === 'finished' && this.sleepReleaseTimer) {
      clearTimeout(this.sleepReleaseTimer);
      this.sleepReleaseTimer = null;
      void this.handlePhoneTouchedAfterDown();
    }
  }

  /** 6章「寝る体勢のあとにスマホを触ったとき」。反応はトーンを下げる方向、記録は必ず取る。 */
  private async handlePhoneTouchedAfterDown(): Promise<void> {
    const session = this.session;
    if (!session) {return;}
    const entries = await CallLogStore.all();
    const idx = entries.findIndex(e => e.nightId === session.nightId);
    if (idx >= 0) {
      const entry = entries[idx];
      entry.touchedAfterDownCount += 1;
      if (entry.touchedAfterDownFirstLatencyMinutes == null && session.endedAt) {
        entry.touchedAfterDownFirstLatencyMinutes = Math.round(
          (Date.now() - session.endedAt) / 60_000,
        );
      }
      await CallLogStore.upsert(entry);
    }
    this.emit('phoneTouchedAfterDown');
    try {
      await CallServiceNative.start();
      await this.vapi.speakAnnouncement(PHONE_TOUCHED_PROMPTS[this.mode]);
    } catch (error) {
      this.emit('error', error);
    } finally {
      await CallServiceNative.stop().catch(() => {});
    }
    this.armSleepRelease();
  }

  destroy() {
    this.appStateSub?.remove();
    this.clearAwayTimer();
    if (this.sleepReleaseTimer) {clearTimeout(this.sleepReleaseTimer);}
  }
}

export const CallOrchestrator = new CallOrchestratorImpl();
