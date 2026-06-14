---
name: server-app-deploy
description: サーバー機能つきアプリ(AIのAPIキーを隠す等でVercel Functionを使うアプリ)を、安全にVercelへ公開する手順。「Vercelにデプロイ」「サーバー型アプリを公開」「APIキーを隠して公開」「あいだみたいな構成でデプロイ」と言われたとき、またはAIキーを隠す必要があるアプリの初回公開時に使う。静的アプリ/Firebase Hostingだけのアプリには使わない。
---

# Server App Deploy（Vercel・モノレポ安全版）

2026-06-14「あいだ」の初回デプロイで踏んだ罠(別プロジェクトへの誤デプロイ)を二度と踏まないための定型手順。

## まず判断:本当にサーバーが要るか

- **要る**: AIのAPIキーをブラウザに出さず隠したい / サーバー側処理が必要 → このスキル(Vercel + `api/*.js`)
- **要らない**: 静的ツール・処方箋型(キー不要)・localStorageのみ → Firebase Hosting か静的配信で十分。**こっちの方が圧倒的に楽**。無理にVercelにしない。

## 役割分担(ここが詰まりの原因なので明確に)

- **Claudeができる**: ファイル作成/編集・`npm install`・curlでの動作確認・**Vercelランタイムログの確認**・紐付けファイル(.vercel)の操作
- **人間しかできない**: Vercel/Firebaseへの**ログイン**、**APIキーの登録**(秘密なのでチャットに貼らない・サイト画面で直接)、Firebaseコンソールでの操作

## 致命的な罠と対策(モノレポ特有)

**罠**: `開発部/[app]` に**自前の `.vercel` が無い**状態で `vercel` を打つと、Vercelがリポジトリに紐づく**別の既存プロジェクトを自動で拾って誤デプロイ**する(実例: あいだのファイルが food-score に飛んだ)。
**対策**: **新規アプリは必ず「自分専用の紐付け」を先に作る**。リポジトリ直下に `.vercel` を置かない(あれば撤去)。

## 手順

### 1. コード側(Claude)
- `package.json`(依存)・`api/translate.js` 等のServerless Function。**キーは `process.env.XXX` から読む。クライアントJSには絶対書かない**。
- `.gitignore` に `node_modules/ .env.local .vercel/` を入れる。
- `npm install` で依存を入れる。

### 2. 新規プロジェクトを安全に作る(初回だけ)
リポジトリ直下の紐付けを拾わないよう、**リポジトリ外から初回デプロイ**して専用プロジェクトを作る:
```bash
rm -rf ~/app-deploy && rsync -a --exclude node_modules --exclude .vercel --exclude .git 開発部/[app]/ ~/app-deploy/
# 人間が実行(ログイン済み端末):
#   cd ~/app-deploy && npx vercel    → 新規プロジェクトとして作成される
```
できたら生成された `~/app-deploy/.vercel` を**本体フォルダにコピー**し、以後は本体から直接デプロイする:
```bash
cp -r ~/app-deploy/.vercel 開発部/[app]/.vercel
```
※2回目以降は `cd 開発部/[app] && npx vercel --prod` だけでOK(本体に紐付けがあるので誤爆しない)。

### 3. 秘密のキーを登録(人間・サイト画面)
- Vercel → 対象プロジェクト → Settings → Environment Variables(新UIは「Environments」→ Production を開く)
- `OPENAI_API_KEY` 等を **Production に追加**。既にあれば**新規追加でなく Edit で値を入れ替える**(重複追加はエラー)。Sensitiveでも値は上書き可。
- **キーはチャットに貼らない**。サイトに直接。

### 4. 反映のため再デプロイ(順序が重要)
**編集 → コミット → 再デプロイ** の順。**編集前のデプロイは反映されない**(古いまま上がる)。
```bash
cd /Users/kei/dev/100day-challenge/開発部/[app] && npx vercel --prod
```

### 5. Firestoreを使う場合
- 専用Firebaseプロジェクト推奨(他アプリと分離)。コンソールでFirestore作成(ロケーション `asia-northeast1`)。
- `firebaseConfig` は公開設定なのでコードに直書きOK(秘密ではない)。
- ルールはそのアプリのコレクションに限定:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /[collection]/{id} { allow read, write: if true; } // MVP。公開前に必ず絞る
  }
}
```

### 6. 動作確認(Claude・curl)
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://[app].vercel.app/                 # 画面 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://[app].vercel.app/api/xxx -d '{...}'  # API 200
curl -s "https://[app].vercel.app/app.js?v=$RANDOM" | grep projectId               # 設定が反映されてるか
```
- **500が出たら推測で直さず、まずVercelランタイムログを見る**(MCP `get_runtime_logs` か `vercel logs`)。
  - `AuthenticationError` = キーの値が無効(空白混入/別アカウント/失効)→ キーを作り直して貼り直す。
  - `The OPENAI_API_KEY ... missing` = 変数未登録 or 再デプロイ未実施。

### 7. 仕上げ
- 本社 `CLAUDE.md` の表をデプロイ済みに更新。
- 公開前に **Firestoreルールを「自分の部屋/データだけ」に締める**、PWAアイコン、データのTTL、Genius Council 3ループ → release-check。
