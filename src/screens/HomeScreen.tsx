import React, {useCallback, useEffect, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {CallOrchestrator} from '../services/CallOrchestrator';
import {CallLogStore} from '../services/CallLogStore';
import {BEDTIME_HOUR, BEDTIME_MINUTE} from '../config/schedule';
import type {Mode, NightLogEntry} from '../types';

const END_REASON_LABEL: Record<string, string> = {
  completed: '最後まで完了',
  today_off: '今日はやめる、で終了',
  dropped: '途中で終了',
  away_interruption: '離席中断',
  declined: '応答なし',
  unknown: '不明',
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

interface Props {
  onOpenLog: () => void;
}

export function HomeScreen({onOpenLog}: Props): React.JSX.Element {
  const [mode, setModeState] = useState<Mode>(CallOrchestrator.getMode());
  const [recent, setRecent] = useState<NightLogEntry[]>([]);

  const refresh = useCallback(() => {
    CallLogStore.all().then(entries => {
      setRecent(entries.slice(-5).reverse());
    });
  }, []);

  useEffect(() => {
    refresh();
    const onFinished = () => refresh();
    CallOrchestrator.on('nightFinished', onFinished);
    return () => {
      CallOrchestrator.off('nightFinished', onFinished);
    };
  }, [refresh]);

  const selectMode = async (next: Mode) => {
    setModeState(next);
    await CallOrchestrator.setMode(next);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>ねむりガイド</Text>
        <Text style={styles.nextAlarm}>
          次の着信: {pad(BEDTIME_HOUR)}:{pad(BEDTIME_MINUTE)}
        </Text>

        <Text style={styles.sectionLabel}>モード</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'normal' && styles.modeButtonActive]}
            onPress={() => selectMode('normal')}>
            <Text style={styles.modeButtonText}>普通</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'strict' && styles.modeButtonActive]}
            onPress={() => selectMode('strict')}>
            <Text style={styles.modeButtonText}>厳しめ</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logLink} onPress={onOpenLog}>
          <Text style={styles.logLinkText}>これまでの記録を見る →</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>直近の記録</Text>
        {recent.length === 0 && <Text style={styles.empty}>まだ記録がありません</Text>}
        {recent.map(entry => (
          <View key={entry.nightId} style={styles.logRow}>
            <Text style={styles.logDate}>{entry.nightId}</Text>
            <Text style={styles.logReason}>
              {entry.endReason ? END_REASON_LABEL[entry.endReason] ?? entry.endReason : '進行中'}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          style={styles.testButton}
          onPress={() => CallOrchestrator.answer()}>
          <Text style={styles.testButtonText}>テスト通話（開発用）</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0b1020'},
  content: {padding: 24, paddingBottom: 48},
  title: {color: '#ffffff', fontSize: 28, fontWeight: '700'},
  nextAlarm: {color: '#c7cbe0', fontSize: 16, marginTop: 8, marginBottom: 24},
  sectionLabel: {color: '#8b90ab', fontSize: 13, marginTop: 24, marginBottom: 8},
  modeRow: {flexDirection: 'row', gap: 12},
  modeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#1c2138',
  },
  modeButtonActive: {backgroundColor: '#3ea66b'},
  modeButtonText: {color: '#ffffff', fontSize: 15, fontWeight: '600'},
  logLink: {marginTop: 20},
  logLinkText: {color: '#7f9cf5', fontSize: 14},
  empty: {color: '#5c6180', fontSize: 14},
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2f4a',
  },
  logDate: {color: '#c7cbe0', fontSize: 14},
  logReason: {color: '#8b90ab', fontSize: 14},
  testButton: {
    marginTop: 40,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3f55',
  },
  testButtonText: {color: '#8b90ab', fontSize: 13},
});
