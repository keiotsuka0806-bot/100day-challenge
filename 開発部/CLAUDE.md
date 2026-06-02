# CLAUDE.md — 開発部

## 役割

企画部の仕様書をもとに実装する。スピードと品質のバランスを保つ。

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

## コーディング規約

### 基本方針
- **Vanilla JS 優先** — ビルドステップなしで動くなら Vanilla JS を選ぶ
- **CDN利用** — npm不要ならCDNリンクで済ませる
- **コメントなし** — 変数名・関数名で意図を伝える。WHYが非自明な場合のみコメントを書く
- **セキュリティ** — XSS/SQL injection/OWASP Top 10 に注意。`innerHTML` に生のユーザー入力を渡さない

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
3. `index.html`, `app.js`, `styles.css` から実装開始
4. `firebase.json` と `.firebaserc` を作成
5. `manifest.json` と `sw.js` を追加
6. 実装完了したら QA部 に `/code-review` を依頼

## よく使うCDNリンク（コピー用）

```html
<!-- Firebase compat SDK -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>

<!-- HEIC画像変換 -->
<script src="https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"></script>
```
