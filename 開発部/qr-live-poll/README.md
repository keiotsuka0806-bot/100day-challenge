# QRでその場ライブ投票（QRLivePoll）

質問を作るとQRが出て、その場の人がスマホで読み取って投票すると、結果が棒グラフでリアルタイムに伸びる。ログイン不要。

シチュエーション別に最適化した4つのシーンから選べる（作成画面でカードを選ぶだけ）。
集計は **🙈匿名**（人数・%だけ）か **🙋記名**（だれが何を選んだか名前を表示）を作成時に選べる。記名にすると、日程調整で「誰がどの日に来られるか」まで一目で分かる（調整さん的な使い方）。

| シーン | 参加者の操作 | 結果の見せ方 |
|---|---|---|
| ⚖️ 賛否・温度を聞く | ひとつ押すだけ | %の棒グラフ（◯票・◯%） |
| ✅ 複数選択アンケート | 当てはまるのを全部えらんで「決定」 | 人数（◯人） |
| 📅 日程を決める | 候補日から行ける日を全部えらんで「決定」 | 日ごとの人数＋最多の日に◎ |
| ⭐ 星評価・満足度 | ★1〜★5 をひとつえらぶ | 平均点＋★ばらつき |

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

## データ構造
`poll = { id, type, question, named, options:[{text,votes,names?}], voters, createdAt }`
- `type`: `binary` / `multi` / `schedule` / `rating`
- `named: true` のとき各 `options[].names` に投票者名を積み、`vote(id, indices, name)` で渡す（匿名は `name=null`）。投票者名は端末の localStorage に保存して次回プリフィル。
- 複数選択（multi・schedule）は1回の投票で選んだ複数indexを `vote(id, indices)` でまとめて送信し、`voters`（回答した人数）を+1する。
- `schedule` は `options[].text` にISO日付（`YYYY-MM-DD`）を保存し、表示時に「M/D（曜）」へ整形。
- `rating` は `options` を ★1〜★5 の5バケットにし、平均＝Σ(星×票)/総票。

## TODO（次の磨き込み）
- [ ] デプロイ前ゲート: Genius Council 3ループ → QA `/code-review` → セキュリティチェック（通過後にデプロイ）
- [ ] 不正投票対策（必要なら）
- [x] シーン別UX（賛否/複数選択/日程/星評価）と人数表示・日程の◎ハイライト
