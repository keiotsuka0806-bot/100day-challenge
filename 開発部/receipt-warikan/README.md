# レシート割り勘カメラ（ReceiptWarikan）

レシートを撮ると品目を読み取り、「誰が何を食べたか」をタップで割り振って一人ずつの支払額を出すアプリ。

企画: `企画部/specs/2026-06-16-receipt-warikan.md`

## 動かし方

### 1. すぐ試す（鍵不要・無料）
ローカルで簡易サーバーを立てて開くだけ。AI読み取りは使わず「サンプルで試す」＋手入力で全機能が動く。

```bash
cd 開発部/receipt-warikan
python3 -m http.server 8000
# → http://localhost:8000 を開く
```

- 「サンプルで試す」で品目が入る → メンバーを足して割り当て → 一人あたりが出る
- 手入力（品名＋金額）でも品目を追加できる

### 2. AI読み取り（OpenAI Vision）を有効化する
レシート写真からの自動読み取りは、サーバー側の関数 `api/parse-receipt.js` がOpenAIを呼ぶ。
**鍵を未登録のうちは休眠（コストゼロ）**で、登録するとカメラ読み取りが有効になる。

```bash
# Vercelにデプロイ
vercel
# 環境変数に鍵を登録（~/.secrets/keys.env のOpenAIキー）
vercel env add OPENAI_API_KEY
vercel --prod
```

## 設計メモ
- フロント: Vanilla JS（ビルドなし）。画像は読み取りの瞬間だけ使い、保存しない。
- AI: `gpt-4o-mini`（Vision）。鍵はサーバー側のみ。クライアントに鍵を置かない。
- セキュリティ: API側で画像サイズ上限（約6MB）＋データURL形式チェック。鍵未登録時は503で安全に停止。
- 計算: 品目の割り当て先で等分。誰も選ばなければ全員で割り勘。税・サービス料は割増%で按分。

## TODO（次の磨き込み）
- [ ] QA部の `/code-review`
- [ ] デプロイ後 Genius Council 3ループ
- [ ] 結果のシェア（LINEに送る等）
