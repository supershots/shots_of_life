# ねむりガイド v0 — セットアップ / 引き継ぎメモ

このリポジトリは「ねむりガイド v0 実装仕様」を実装したものです。Android 専用、
React Native（Kotlin ネイティブモジュールで着信・フォアグラウンドサービス・画面制御を
補完）+ Vapi Client SDK（WebRTC）構成。サーバーは持ちません。

このドキュメントは、コードでは終わらせられない部分（鍵の取得、声の選定、実機での
夜間テスト）を人間が引き継ぐためのものです。実装仕様書 本体の章番号を随所で参照します。

## 0. 前提

- Node 18+、Android Studio（SDK・エミュレータ）、実機の Android 端末（**声の選定と
  夜間テストは実機必須**。04章）。
- `npm install` を実行（`@vapi-ai/react-native` とその周辺 WebRTC 依存を含む）。

## 1. 人間にしかできないこと（08章より）

以下はコードでは代替できません。順番にやってください。

1. **Vapi のアカウント作成・課金設定・公開鍵の取得**
   https://dashboard.vapi.ai で Public Key を発行し、
   `src/config/secrets.example.ts` を `src/config/secrets.ts` としてコピーして
   `VAPI_PUBLIC_KEY` に入れる（`secrets.ts` は git 管理外）。
2. **声の選定（04章）**
   ElevenLabs の候補を3つ程度に絞り、**必ず実機のスピーカーで**比較する
   （PC/ヘッドホンで選ぶと電話網の圧縮を通ったときに別物になる）。
   選定基準の優先順位: ① 語尾の下がり方 ② 話速（0.8〜0.85倍程度）
   ③ 電話帯域での明瞭さ ④ 音質（最後でいい）。
   決まったら `src/config/vapiCallConfig.ts` の `voiceConfig.voiceId` を書き換える。
3. **実機での夜間テスト**
   08章の4段階（下記）を順に実機で確認する。
4. **3晩使ってみて、4晩目も使う気になるかの判断**
   これが v0 の成否基準です（技術的に動いても、3晩目で嫌になるなら設計が間違っている）。

## 2. 実装済みの内容とアーキテクチャ

| 層 | 実装 |
| --- | --- |
| 着信 | `android/.../alarm/`: `AlarmSchedulerModule`(setAlarmClock) / `AlarmReceiver`(全画面通知, USAGE_ALARM) / `MainActivity`(ロック画面上に表示) |
| 通話中の保持 | `android/.../call/CallForegroundService`(foregroundServiceType=microphone) |
| 画面制御 | `android/.../screen/WakeScreenModule`(FLAG_KEEP_SCREEN_ON の付与/解放。端末ロックは行わない) |
| 通話 | `src/services/VapiService.ts`（`@vapi-ai/react-native` の薄いラッパー） |
| 台詞・設定値 | `src/config/{vapiCallConfig,script,systemPrompt,assistant}.ts`（3章・5章） |
| 状態機械 | `src/services/CallOrchestrator.ts`（中断・再着信・モード・スリープ、6章） |
| 画面 | `src/screens/*`、`App.tsx` |

### 実装仕様書に対する追加・逸脱（明示しておくべき判断）

- **Vapi Assistant はダッシュボード事前作成ではなく、通話のたびにインライン設定を渡す**
  （`buildAssistantConfig`）。理由: 秘密鍵をアプリに埋め込まずに済み、モード
  （普通/厳しめ）や再開コンテキストを毎回反映できるため。
- **`report_step` / `mark_tonight_off` という2つのクライアント側ツール呼び出しを
  システムプロンプトに追加した**（`src/config/systemPrompt.ts` の `toolBridgeNote`）。
  仕様書本文には明示されていないが、6章「到達済みステップは端末に保持しておく」を
  確定的に実現するために必要と判断した。AI の会話には一切影響しない、サイレントな
  内部呼び出し。
- **離席中断からの再接続と、途中で切れたときの再着信は、別経路で実装**している。
  離席中断（6章①）はアプリ内タイマー＋フォアグラウンドサービスで静かに再接続。
  再着信（6章②）は `AlarmManager`（`AlarmScheduler.scheduleAt`）経由で、待機中に
  プロセスが OS に殺されても構わない設計にした（`ActiveSessionStore` で
  進行中セッションを永続化し、コールドスタート後に復元する）。
- **離席の「10分経っても復帰しない場合は1回だけ掛けて…」は簡略化**した。再接続した
  通話自体の `silenceTimeoutSeconds`（10分）にその判定を委ねている。仕様書が想定する
  「3分30秒で1回、ダメなら10分でもう1回」という二段構えの正確な再現はしていない。
  ④の実機検証時に、体験として問題なければこのままでよい。
- **`silenceTimeoutSeconds` / `stopSpeakingPlan` / `startSpeakingPlan` の
  フィールド名は 2026年のドキュメント確認に基づく**。`hooks` の
  `customer.speech.timeout`（idle nudge）についても同様。Vapi 側の仕様変更が
  ありうるので、①②の実機検証に入る前に Vapi の最新ドキュメント
  （Speech configuration / Assistant hooks）で再確認すること（3章・8章で
  明示されている注意点）。
- **`end-of-call-report` メッセージの型と `endedReason` の扱い**
  (`src/services/VapiService.ts`) も同様に、実機で `vapi.on('message', ...)` の
  実際のペイロードを見て確認すること。

## 3. 実機での確認手順（08章の4段階）

一度に全部作らず、この順で完了条件を満たしてから次へ進むこと。

1. **① アラームと着信画面 — Vapi なし**
   検証端末のメーカーを先に決め、バッテリー最適化から除外しておく。
   おやすみモードでも鳴るか／Doze 復帰後も時刻どおりか／ロック画面に全画面で
   出るか／終話後に翌日分がセットされ直すかを確認。
2. **② 通話だけ — アラームなし**
   `HomeScreen` の「テスト通話（開発用）」ボタンから `vapi.start()` を単独で
   試せる。ここで声を決める（実機必須）。
3. **③ 合体**
   ①のアラームから②の通話を起動する。**ここで一度、実際に3晩使う。**
4. **④ 中断・再着信・モード**
   ③が3晩通ってから着手する。離席中断・「今日はやめる」・再着信・モード切替・
   スマホ復帰検知・15分放置スリープは既にコードとしては入っているが、
   **実機での夜間検証はまだ行われていない**。この README を読んでいる時点で
   ④に手を入れる場合は、必ず実機で1つずつ確認しながら進めること。

## 4. 既知の未対応・実装では直せない問題（06章・07章）

- **OEM 独自のバッテリー最適化**（Xiaomi/OPPO/Huawei 等）は `setAlarmClock()` を
  使っていてもアプリを殺すことがある。検証端末のメーカーを先に確認し、必要なら
  「自動起動を許可」「電池最適化から除外」を手動で設定してから配る。コードでは
  回避できない。日本で多い Pixel・Sharp・Sony・Samsung は比較的マシ。
- 端末再起動時は `BootReceiver`（`android/.../alarm/BootReceiver.kt`）が
  `BOOT_COMPLETED` / `QUICKBOOT_POWERON` / `MY_PACKAGE_REPLACED` を受けて
  毎晩22:50の着信を張り直す（v0 の受け入れ基準には無いが、仕様書が明示している
  OEM バッテリー最適化の問題と合わせて実機で確認すること）。ただし再着信の待機中
  （3〜5分間隔）や離席中断中にちょうど再起動を挟むような稀なケースまでは復元しない
  ── その場合は翌日の通常アラームまで待つ。
- コストは7章の見積もり（約45円/晩、離席中断込みの採用案で月480円ほど）を前提に
  `silenceTimeoutSeconds` などを決めている。声を変えてもコストはほぼ動かない
  （TTSは原価の3%程度）。

## 5. 配布

Play Console は使わない。`cd android && ./gradlew assembleRelease` で
`android/app/build/outputs/apk/release/app-release.apk` を作り、直接端末に
インストールする。ストアに出す場合のみ `USE_EXACT_ALARM` / `USE_FULL_SCREEN_INTENT`
について Google Play への用途申告が必要になる。

### ビルド環境が無い場合（GitHub Actions での自動ビルド）

Android SDK・実機の無い環境（このリポジトリを操作している Claude のクラウド環境も
含む）では APK を作れない。代わりに `.github/workflows/android-build.yml` が、
このブランチに push するたびに GitHub 側でデバッグ APK をビルドし、Actions の
実行結果に Artifact として添付する。

1. GitHub の当該リポジトリの Settings → Secrets and variables → Actions で、
   `VAPI_PUBLIC_KEY` という名前のリポジトリシークレットに Vapi の公開鍵を登録する
   （これを登録しないとビルドは通るが、生成された APK は通話を開始できない）。
2. `claude/app-development-3s35ah` に push する、または Actions タブから
   `Android build` ワークフローを手動実行（workflow_dispatch）する。
3. 完了したワークフロー実行のページ下部 Artifacts から `sleepguide-debug-apk`
   をダウンロードし、端末に転送してインストールする。

## 6. 受け入れ基準（09章、そのまま転記）

- [ ] 指定時刻に、ロック画面へ全画面の着信が出る
- [ ] おやすみモードをオンにしていても鳴る
- [ ] 端末を数時間放置して Doze に入った状態からも、時刻どおりに鳴る
- [ ] 応答すると通話が始まる
- [ ] マイク権限のダイアログが22:50に出ない（初回起動時に取得済み）
- [ ] 開口一番が正しく再生される
- [ ] その場ステップで20秒沈黙すると声かけが1回入り、その後また黙る
- [ ] 離席ステップで「また掛けるね」と言って通話が切れる（マイクが閉じる）
- [ ] 洗面所から戻って画面に触れると、静かに再接続する（全画面着信にならない）
- [ ] 画面に触れなくても、3分30秒で再接続する
- [ ] 再接続の第一声が「おかえり」で、中断について説明しない
- [ ] 「終わった」と言うと次のステップに進む
- [ ] 相槌（「うん」）でAIの発話が中断されない
- [ ] 背景音が鳴っていない
- [ ] 最後は「おやすみ」を言わずに切れる
- [ ] 設定で「普通/厳しめ」を選べ、台詞と待機時間が切り替わる
- [ ] 厳しめでも声を張らない。短くなるだけで、怒っては聞こえない
- [ ] 途中で切ると掛け直してきて、中断したステップから再開する
- [ ] 再着信の上限に達したら、何も言わずに終わる
- [ ] 「今日はやめる」と言うと終わり、その晩は掛かってこない
- [ ] 寝る体勢のあとにアプリを離れると検知され、記録に残る
- [ ] 終話後15分放置すると画面が消える（端末はロックしない）
- [ ] 通話ログと文字起こしが残っている
- [ ] 終話後、翌日分のアラームが自動でセットされている
- [ ] 3晩連続で使って、3晩目も出る気になった
