import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {CallLogStore} from '../services/CallLogStore';
import {STEPS} from '../config/script';
import type {NightLogEntry} from '../types';

interface Props {
  onBack: () => void;
}

function formatDuration(startedAt: number, endedAt?: number): string {
  if (!endedAt) {return '進行中';}
  const seconds = Math.round((endedAt - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

/** 01章「通話ログ（開始・終了・文字起こし）を保存する」の端末側ビュー。 */
export function LogScreen({onBack}: Props): React.JSX.Element {
  const [entries, setEntries] = useState<NightLogEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    CallLogStore.all().then(all => setEntries([...all].reverse()));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>記録</Text>
        <View style={{width: 48}} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {entries.length === 0 && <Text style={styles.empty}>まだ記録がありません</Text>}
        {entries.map(entry => {
          const isOpen = expanded === entry.nightId;
          const lastStep = STEPS[entry.lastCompletedStepIndex]?.label ?? '未着手';
          return (
            <TouchableOpacity
              key={entry.nightId}
              style={styles.card}
              onPress={() => setExpanded(isOpen ? null : entry.nightId)}>
              <View style={styles.cardHeader}>
                <Text style={styles.date}>{entry.nightId}</Text>
                <Text style={styles.duration}>
                  {formatDuration(entry.startedAt, entry.endedAt)}
                </Text>
              </View>
              <Text style={styles.meta}>
                モード: {entry.mode === 'strict' ? '厳しめ' : '普通'} ／ 終了理由:{' '}
                {entry.endReason ?? '進行中'}
              </Text>
              <Text style={styles.meta}>到達: {lastStep}</Text>
              {(entry.redialAttempts > 0 || entry.awayReconnectAttempts > 0) && (
                <Text style={styles.meta}>
                  再着信 {entry.redialAttempts} 回 ／ 離席再接続 {entry.awayReconnectAttempts} 回
                </Text>
              )}
              {entry.touchedAfterDownCount > 0 && (
                <Text style={styles.meta}>
                  就寝後に触れた回数: {entry.touchedAfterDownCount}
                  {entry.touchedAfterDownFirstLatencyMinutes != null &&
                    `（最初は${entry.touchedAfterDownFirstLatencyMinutes}分後）`}
                </Text>
              )}
              {isOpen && (
                <View style={styles.transcript}>
                  {entry.transcript.map((turn, i) => (
                    <Text key={i} style={styles.transcriptLine}>
                      {turn.role === 'assistant' ? 'AI' : 'あなた'}: {turn.text}
                    </Text>
                  ))}
                  {entry.transcript.length === 0 && (
                    <Text style={styles.transcriptLine}>文字起こしはありません</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0b1020'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: {color: '#7f9cf5', fontSize: 14, width: 48},
  title: {color: '#ffffff', fontSize: 18, fontWeight: '600'},
  content: {padding: 16, paddingBottom: 48},
  empty: {color: '#5c6180', fontSize: 14},
  card: {
    backgroundColor: '#1c2138',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between'},
  date: {color: '#ffffff', fontSize: 16, fontWeight: '600'},
  duration: {color: '#8b90ab', fontSize: 13},
  meta: {color: '#8b90ab', fontSize: 13, marginTop: 4},
  transcript: {marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2a2f4a', paddingTop: 8},
  transcriptLine: {color: '#c7cbe0', fontSize: 13, marginTop: 4},
});
