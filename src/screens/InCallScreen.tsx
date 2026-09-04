import React, {useEffect, useState} from 'react';
import {SafeAreaView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {CallOrchestrator, OrchestratorStatus} from '../services/CallOrchestrator';
import {STEPS} from '../config/script';

interface Props {
  onEnded: () => void;
}

/**
 * Vapi の SDK が投げてくる error は Error インスタンスとは限らない
 * （プレーンなオブジェクトのことがある）。String(err) は "[object Object]"
 * にしかならないので、中身が読めるように分解する。
 */
function describeUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || String(err);
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const nested = anyErr.message ?? anyErr.error ?? anyErr.reason ?? anyErr.errorMsg;
    if (typeof nested === 'string') {
      return nested;
    }
    try {
      const plain = JSON.stringify(err, Object.getOwnPropertyNames(err));
      if (plain && plain !== '{}') {
        return plain;
      }
    } catch {
      // JSON.stringify can throw on circular structures; fall through.
    }
  }
  return String(err);
}

/**
 * 通話中の最小限の画面。台本は音声だけで進むので、ここは「今どのあたりか」を
 * 静かに示すだけでいい。ユーザー操作を求めるボタンは置かない
 * （手順は AI が声で進める。確認は求めない、が5〜6章の原則）。
 */
export function InCallScreen({onEnded}: Props): React.JSX.Element {
  const [stepIndex, setStepIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onStep = (index: number) => setStepIndex(index);
    const onStatus = (status: OrchestratorStatus) => {
      if (status !== 'in_call') {
        onEnded();
      }
    };
    const onError = (err: unknown) => {
      setError(describeUnknownError(err));
    };
    CallOrchestrator.on('stepChanged', onStep);
    CallOrchestrator.on('statusChanged', onStatus);
    CallOrchestrator.on('error', onError);
    return () => {
      CallOrchestrator.off('stepChanged', onStep);
      CallOrchestrator.off('statusChanged', onStatus);
      CallOrchestrator.off('error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = STEPS[stepIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.label}>通話中</Text>
        <Text style={styles.step}>{step ? step.label : '準備中…'}</Text>
        {error != null && <Text style={styles.error}>エラー: {error}</Text>}
      </View>
      <TouchableOpacity
        style={styles.hangup}
        onPress={() => {
          // vapi.start() が失敗して通話が始まっていない場合、call-end は
          // 二度と飛んでこない（hangup() は何もしない）ので、待たずに
          // その場でホームへ戻す。実際に通話中でも、切る操作としては自然。
          CallOrchestrator.hangup();
          onEnded();
        }}>
        <Text style={styles.hangupText}>通話を終える</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
    justifyContent: 'space-between',
    paddingVertical: 64,
    alignItems: 'center',
  },
  center: {
    marginTop: 120,
    alignItems: 'center',
  },
  label: {
    color: '#8b90ab',
    fontSize: 14,
  },
  step: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 12,
  },
  error: {
    color: '#ff8080',
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  hangup: {
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3a3f55',
  },
  hangupText: {
    color: '#ffffff',
    fontSize: 14,
  },
});
