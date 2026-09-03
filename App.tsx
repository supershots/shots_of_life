/**
 * ねむりガイド v0
 * @format
 */

import React, {useEffect, useState} from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';
import {CallOrchestrator, OrchestratorStatus} from './src/services/CallOrchestrator';
import {IncomingAlarmNativeModule, incomingAlarmEmitter} from './src/native/nativeModules';
import {requestStartupPermissions} from './src/native/permissions';
import {HomeScreen} from './src/screens/HomeScreen';
import {IncomingCallScreen} from './src/screens/IncomingCallScreen';
import {InCallScreen} from './src/screens/InCallScreen';
import {LogScreen} from './src/screens/LogScreen';

type View = 'home' | 'incoming' | 'in_call' | 'log';

function App(): React.JSX.Element {
  const [view, setView] = useState<View>('home');

  useEffect(() => {
    void requestStartupPermissions();

    // コールドスタート（ロック画面から着信で叩き起こされた）場合。
    // このときは着信フロー（応答/再着信の間隔）自身がアラームの再スケジュールを
    // 管理するので、ここで先に「翌日ぶん」を張って上書きしてはいけない。
    IncomingAlarmNativeModule.consumeLaunchFlag().then(wasIncoming => {
      if (wasIncoming) {
        setView('incoming');
      } else {
        // 06章「実装の流れ」1番: 通常起動時は翌日ぶんの着信が確実に張られているようにする。
        void CallOrchestrator.ensureAlarmScheduled();
      }
    });

    // アプリが既に起動していた場合（onNewIntent 経由）。
    const sub = incomingAlarmEmitter.addListener('onIncomingAlarm', () => {
      setView('incoming');
    });

    const onStatus = (status: OrchestratorStatus) => {
      if (status === 'in_call') {
        setView('in_call');
      } else if (status === 'away_waiting' || status === 'redial_waiting' || status === 'finished') {
        setView(current => (current === 'log' ? current : 'home'));
      }
    };
    CallOrchestrator.on('statusChanged', onStatus);

    return () => {
      sub.remove();
      CallOrchestrator.off('statusChanged', onStatus);
    };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1020" />
      {view === 'home' && <HomeScreen onOpenLog={() => setView('log')} />}
      {view === 'incoming' && (
        <IncomingCallScreen
          onAnswered={() => setView('in_call')}
          onClosed={() => setView('home')}
        />
      )}
      {view === 'in_call' && <InCallScreen onEnded={() => setView('home')} />}
      {view === 'log' && <LogScreen onBack={() => setView('home')} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0b1020'},
});

export default App;
