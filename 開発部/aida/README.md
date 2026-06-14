# あいだ（Aida）

二人の本当の対話を、AIが通訳する。
大切な誰かと一緒に、お互い別々に・非公開で同じ問いに答えると、AIが「本当は同じだった一点」と「言葉の奥の本心」を双方向に翻訳して両者に同時に返す。

仕様書: `企画部/specs/2026-06-14-aida.md`

## 構成

| 役割 | 技術 |
|------|------|
| フロント | Vanilla JS（ビルドなし） |
| 部屋・回答の同期 | Firebase Firestore（クライアントSDK / CDN compat 10.12.0） |
| AI翻訳 | Vercel Serverless Function `api/translate.js`（OpenAI を `openai` SDK で呼ぶ。`gpt-4o` / 構造化出力 json_schema strict） |
| ホスティング | Vercel |
| PWA | manifest + service-worker |

**APIキーはサーバ側だけ**：`OPENAI_API_KEY` は Vercel の環境変数に置き、ブラウザには一切出さない（BYOK・キー直書きは禁止）。モデルは `OPENAI_MODEL` 環境変数で変更可（既定 `gpt-4o`）。あとから Claude に戻す場合は `api/translate.js` を `@anthropic-ai/sdk` 版に差し替える。

## セットアップ

### 1. Firebase（部屋の同期）
1. Firebase コンソールでプロジェクトを作成し、**Firestore Database** を有効化
2. `app.js` の `firebaseConfig`（`REPLACE_ME` の箇所）を自分の値に差し替える
3. Firestore のセキュリティルール（MVP用・`aidaRooms` のみ読み書き可、一定期間で失効推奨）:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /aidaRooms/{code} {
      allow read, write: if true; // MVP。公開前に期限・スキーマ制限を検討
    }
  }
}
```

### 2. OpenAI API キー
- Vercel プロジェクトの環境変数に `OPENAI_API_KEY` を設定する（既存の課金済みキーを利用）
- ローカル確認時は `vercel dev` を使うと `api/translate.js` も動く（`.env.local` に `OPENAI_API_KEY=...`）

### 3. ローカル開発 / デプロイ
```bash
npm install        # @anthropic-ai/sdk を入れる
vercel dev         # ローカル（静的 + /api 関数）
vercel deploy      # プレビュー
vercel deploy --prod
```

## データモデル（Firestore: `aidaRooms/{code}`）
```
{
  relation, relationLabel, questions: string[],
  a: { joined: bool, answers: string[]|null },
  b: { joined: bool, answers: string[]|null },
  translating: bool,
  result: { commonGround[], aTrueHeart, bTrueHeart, nextStep, safety } | null,
  error: string|null,
  createdAt
}
```
両者の `answers` がそろうと、トランザクションで1人だけが `/api/translate` を呼び、結果を `result` に書く（両者の onSnapshot に届く）。

## 倫理・プライバシー
- 回答はその部屋の二人だけのもの。AI出力は **感情を捏造しない／どちらの肩も持たない／診断しない**（システムプロンプトで固定）。
- 危険（DV・自傷の示唆）を検知したら、翻訳より先に相談窓口を案内する（`safety` フィールド）。
- センシティブな内容のため、本番では部屋の自動失効・保持最小化を入れること。

## 未対応 / TODO（公開前）
- [ ] PWA アイコン（icon-192/512.png）を用意
- [ ] Firestore ルールの本番化（期限付き・スキーマ検証）
- [ ] 部屋の自動削除（TTL）
- [ ] Genius Council 3ループ → release-check
