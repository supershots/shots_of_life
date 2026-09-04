import React, {useEffect, useState} from 'react';
import {SafeAreaView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {CallOrchestrator} from '../services/CallOrchestrator';

interface Props {
  onAnswered: () => void;
  onClosed: () => void;
}

/**
 * 06章: ロック画面の上に全画面で出る着信画面。応答するまで通話（マイク）は一切
 * 開始しない。新規の晩か、再着信（続きから）かで文言を出し分ける。
 */
export function IncomingCallScreen({onAnswered, onClosed}: Props): React.JSX.Element {
  const [kind, setKind] = useState<'fresh' | 'redial' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    CallOrchestrator.prepareForIncomingAlarm().then(result => {
      if (!cancelled) {setKind(result);}
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAnswer = async () => {
    if (busy || kind == null) {return;}
    setBusy(true);
    try {
      if (kind === 'redial') {
        await CallOrchestrator.answerRedial();
      } else {
        await CallOrchestrator.answer();
      }
      onAnswered();
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (busy) {return;}
    // 6章②: 再着信を応答しなかった場合も「出なかった」として扱い、上限までは
    // 次の間隔でまた掛け直す。新規の着信をただ閉じただけなら何もしない。
    if (kind === 'redial') {
      setBusy(true);
      try {
        await CallOrchestrator.declineRedial();
      } finally {
        setBusy(false);
      }
    }
    onClosed();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        {kind === 'redial' && <Text style={styles.badge}>再着信（続きから）</Text>}
        <Text style={styles.title}>ねむりガイド</Text>
        <Text style={styles.subtitle}>
          {kind === 'redial' ? '続きからいこう' : 'そろそろ寝る準備をはじめよう'}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.decline]}
          onPress={handleClose}
          disabled={busy}>
          <Text style={styles.buttonText}>閉じる</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.answer]}
          onPress={handleAnswer}
          disabled={busy || kind == null}>
          <Text style={styles.buttonText}>応答</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
    justifyContent: 'space-between',
    paddingVertical: 64,
  },
  center: {
    alignItems: 'center',
    marginTop: 96,
  },
  badge: {
    color: '#0b1020',
    backgroundColor: '#e8b04b',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
  },
  subtitle: {
    color: '#c7cbe0',
    fontSize: 16,
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 24,
  },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: {
    backgroundColor: '#3a3f55',
  },
  answer: {
    backgroundColor: '#3ea66b',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
