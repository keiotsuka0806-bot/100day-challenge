# QRでその場ライブ投票（QRLivePoll）

質問を作るとQRが出て、その場の人がスマホで読み取って投票すると、結果が円グラフ…ならぬ棒グラフでリアルタイムに伸びる。ログイン不要。

企画: `企画部/specs/2026-06-16-qr-live-poll.md`

## 動かし方

### 1. すぐ試す（デモモード・設定不要）
```bash
cd 開発部/qr-live-poll
python3 -m http.server 8000
# → http://localhost:8000 を開く
```
- 質問と選択肢を作る → 主催者画面にQRと結果が出る
- **動作確認のコツ**: 同じブラウザで「投票URL」を別タブに貼って開くと投票でき、主催者タブの結果がその場で動きます（デモモードは同一ブラウザのタブ間で同期）。

> デモモードは1台のブラウザ内だけの同期です。実際に「その場の複数スマホ」から投票を集めるには、下の2番でリアルタイム化します。

### 2. 複数スマホでリアルタイム同期（本番）
Firestoreにつなぐと、QRを読んだ全員の投票が即・全員の画面に反映されます。

1. Firebaseでプロジェクトを作り、Firestoreを有効化
2. `firebase-config.example.js` を `firebase-config.js` にコピーして自分の設定を貼る
3. デプロイ（Vercel/Firebase Hosting など。スマホから開けるURLが必要）

`firebase-config.js` があると自動でリアルタイムモードに切り替わります（なければデモモード）。

## 設計メモ
- フロント: Vanilla JS。ハッシュルーティング（`#host=ID` 主催 / `#vote=ID` 投票）。
- バックエンド抽象化: `firebase-config.js` の有無で Firestore ⇄ localStorage を自動切替（`app.js` 冒頭）。
- QR生成: `qrcode`（CDN）。
- 二重投票の簡易抑止: 投票済みフラグを端末の localStorage に保存（厳密な防止ではなくMVP）。
- XSS: ユーザー入力は `textContent` で描画。

## TODO（次の磨き込み）
- [ ] QA部の `/code-review`
- [ ] デプロイ後 Genius Council 3ループ
- [ ] 結果画面の演出（伸びるアニメ強化・1位ハイライト）
- [ ] 不正投票対策（必要なら）
