# ねむりガイド (SleepGuide) v0

就寝時刻の10分前にロック画面へ着信し、寝るまでの手順を音声で1つずつ案内する、
Android 専用の就寝ガイドアプリ。サーバー・電話番号・通話料は不要（Vapi Client SDK
による端末内 WebRTC 通話のみ）。

詳しい背景・設計判断は `docs/SETUP.md` を参照してください。まずそこから読んでください。

## クイックスタート

```bash
npm install
cp src/config/secrets.example.ts src/config/secrets.ts   # Vapi の公開鍵を入れる
npm run android   # 実機/エミュレータに接続した状態で
```

`src/config/secrets.ts` に `VAPI_PUBLIC_KEY` を設定し、`src/config/vapiCallConfig.ts`
の `voiceConfig.voiceId` を実機で選んだ ElevenLabs の声に差し替えるまでは、
着信画面までは動きますが通話は開始できません。

## 構成

```
android/                 ネイティブ側（アラーム・全画面着信・フォアグラウンドサービス）
src/config/               設定値・台本・システムプロンプト（3〜5章）
src/native/                ネイティブモジュールの JS ラッパー・権限
src/services/               VapiService / CallOrchestrator（状態機械）/ 各種ストア
src/screens/                 着信・通話中・ホーム・記録の各画面
docs/SETUP.md                人間が引き継ぐべき手順・受け入れ基準
```

## ライセンス・注意

このアプリは実機での声の選定と、実機での複数晩のテストなしには完成しません。
`docs/SETUP.md` の「人間にしかできないこと」を必ず読んでください。
