# CLAUDE.md — 開発部

## 役割

企画部の仕様書をもとに実装する。スピードと品質のバランスを保つ。

## Step 0: Shared Context

開発部は、`100日チャレンジを通してAI組織そのものを育てる` ための実装担当である。

優先順位は次の順に扱う。

1. 学びを残せる実装にする
2. 1日あたり1プロジェクトの共有可能な成果を出す
3. 対象外変更や混入を避ける

実装の前に、企画部の仕様書だけでなく、必要なら `運用部/CLAUDE.md` の運用ルールと `記憶庫/` の学びも参照する。

## 朝のフレーズ — 「今日は[name]を作りたい」

ユーザーが「今日は[企画名]を作りたい」と言ったら、企画部の仕様書を確認して即座に実装を開始する。

```
入力: 「今日はポモドーロタイマーを作りたい」
確認: 企画部/specs/2026-06-02-pomodoro.md を読む
出力: 開発部/pomodoro/ に実装開始
      → index.html, app.js, styles.css
      → manifest.json, sw.js
      → firebase.json, .firebaserc
```

## プロジェクト一覧

| プロジェクト | ディレクトリ | ステータス |
|-------------|-------------|----------|
| WhiskyNote | `whisky-note/` | 稼働中 |
| MoodForecast | `mood-forecast/` | 開発中 |
| NaniTaberu | `nani-taberu/` | 開発中 |
| ReceiptWarikan | `receipt-warikan/` | デプロイ済み（Day17採用） |
| QRLivePoll | `qr-live-poll/` | デプロイ済み（ストック） |
| GlassFactory | `glass-factory/` | デプロイ済み（本命・ロビー＋4部屋：①見学リプレイ／②企画会議室／③ボツ美術館／④会社を建てる＝別棟リンクでDay16のAIOrgSimを流用。鍵不要・コストゼロ。https://glass-factory-one.vercel.app/ ・セキュリティ100/100通過） |
| AI乱入大喜利 | `tsugihagi-sakubun-lab/` | デプロイ済み（6/23公開・https://ai-ranyu-ogiri.vercel.app）。各自スマホで参加(合言葉+QR)→お題にボケ→投票→優勝の大喜利。AIも参戦(Vercel関数+OpenAI、鍵ありで本物/なしでモック)。Firestore共有倉庫ogiriRooms・匿名auth。お題114問 |
| RideDex | `ride-dex/` | 開発中（Day1実装済み・ローカル検証済み／デプロイ前3ゲート前）。街の車・バイクをカメラ→OpenAI Vision鑑定（メーカー/車種/世代+年式レンジ/確度%/レア度/豆知識）→図鑑コレクション。"宝探し"UX。年式は単年でなく世代レンジ／詳しい人が訂正可（端末内）／レア度別演出／実績バッジ。Vanilla JS+PWA、Vercel関数で鍵秘匿+レート制限(60秒10回)+サイズ上限。鍵ありで本物/なしでデモモック。写真は保存せず車種データのみ。現実世界図鑑シリーズの第1弾エンジン |

## コーディング規約

### 基本方針
- **Vanilla JS 優先** — ビルドステップなしで動くなら Vanilla JS を選ぶ
- **CDN利用** — npm不要ならCDNリンクで済ませる
- **コメントなし** — 変数名・関数名で意図を伝える。WHYが非自明な場合のみコメントを書く
- **セキュリティ** — XSS/SQL injection/OWASP Top 10 に注意。`innerHTML` に生のユーザー入力を渡さない

### モバイル対応（PCで作ってスマホで崩さない・必須）

「PCでは整っているのにスマホでガタガタ」を最初から防ぐ。崩れの主因は **横はみ出し** と **flex行の詰め込みすぎ** の2つ。

**作るときの鉄則**
- viewportは `width=device-width, initial-scale=1.0`。`maximum-scale=1.0` は付けない（ピンチズーム禁止になり不便）
- 横並び（`display:flex`）には原則 `flex-wrap: wrap` を付け、狭い画面で折り返す
- 幅は `max-width` で上限を切るだけにする。`width:NNNpx` / `min-width:NNNpx` で固定しない（特に `width/min-width/max-width` を同じpxで三重ロックしない）
- 1行に入力欄やボタンを詰め込まない。最重要要素は `flex: 1 1 100%` で独立行にし、広い画面用に `@media (min-width: 420px)` で横並びへ戻す
- 画像・キャンバス・SVGは `max-width: 100%`。入力欄のフォントは16px以上（iOSのタップ拡大防止）
- 画面いっぱいの高さは `100vh` でなく `100dvh`（スマホのツールバー変動対応）
- 3カラム等の固定レイアウトは `@media (max-width: 720px)` で縦積みにする
- 新規はテンプレ `_templates/vanilla-starter/` を土台にする（崩れ防止の共通CSSが入っている）

**完成前チェック（必須・QA依頼の前に実行）**
ローカルで配信し、Playwright(MCP)を **幅320px** にして開き、横はみ出しがゼロかを実測する。推測しない。

```js
// 320pxで横はみ出し(overflowX)が0かを確認。0でなければ犯人要素が出る
() => {
  const de = document.documentElement, vw = de.clientWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) bad.push({ sel: el.className || el.tagName, right: Math.round(r.right) });
  });
  return { overflowX: de.scrollWidth - vw, offenders: bad.slice(0, 8) };
}
```

`overflowX` が0でなければ、`offenders` の要素に `flex-wrap` / `max-width` / 独立行化で対処してから再確認する。モーダル・結果パネル・ゲーム盤面など「操作後に出る要素」も開いた状態で測ること。

クイック静的チェック（ブラウザ不要・目安）: `node 運用部/scripts/check-mobile.mjs <project-dir>`

### ファイル構成（Vanilla JSプロジェクトの標準）
```
[project-name]/
  index.html        ← 全UIマークアップ
  app.js            ← 全アプリロジック
  styles.css        ← 全CSS
  manifest.json     ← PWAマニフェスト
  sw.js             ← Service Worker（オフライン対応）
  firebase.json     ← Firebaseホスティング設定
  .firebaserc       ← Firebaseプロジェクト設定
```

### Firebaseパターン
```javascript
// Auth
firebase.auth().onAuthStateChanged(user => { ... });
firebase.auth().signInWithPopup(provider);

// Firestore 読み取り（リアルタイム）
db.collection('items').where('uid', '==', uid)
  .onSnapshot(snapshot => { ... });

// Firestore 書き込み
db.collection('items').doc(id).set(data);
db.collection('items').doc(id).delete();
```

### PWA必須要素
```json
// manifest.json の最低限
{
  "name": "アプリ名",
  "short_name": "短縮名",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [{ "src": "icon.png", "sizes": "192x192", "type": "image/png" }]
}
```

## 新規プロジェクト作業手順

1. `企画部/specs/` から仕様書を確認する
2. このディレクトリ（`開発部/`）に新しいフォルダを作成
3. `index.html`, `app.js`, `styles.css` から実装開始（土台は `_templates/vanilla-starter/`）
4. `firebase.json` と `.firebaserc` を作成
5. `manifest.json` と `sw.js` を追加
6. **幅320pxでモバイル崩れ確認**（上記「モバイル対応」の完成前チェック。横はみ出し0を実測）
7. 実装完了したら QA部 に `/code-review` を依頼

## よく使うCDNリンク（コピー用）

```html
<!-- Firebase compat SDK -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>

<!-- HEIC画像変換 -->
<script src="https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"></script>
```
