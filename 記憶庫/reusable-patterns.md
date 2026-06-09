# 再利用パターン集

このファイルは「複数プロジェクトで使い回せる」実装パターンを蓄積する。
「どこかのプロジェクトにあったはず」と探す時間をゼロにするために書く。

---

## Firebase Auth (Google Sign-In)
**使い道**: Firebase認証が必要な全プロジェクト
**実装例**: `開発部/whisky-note/app.js` の `auth.onAuthStateChanged` ブロック
**注意点**: `signInWithPopup` はモバイルでブロックされることがある。その場合は `signInWithRedirect` に切り替える

```javascript
// 認証状態の監視（UI制御の起点）
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    // ログイン済み: Firestoreリスナー開始・メイン画面表示
  } else {
    // 未ログイン: ログイン画面表示
  }
});

// ログイン
firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());

// ログアウト
firebase.auth().signOut();
```

---

## Firestore onSnapshot (リアルタイム同期)
**使い道**: データのリアルタイム更新が必要な全プロジェクト
**実装例**: `開発部/whisky-note/app.js` の `setupFirestoreListener`
**注意点**: コンポーネント破棄時に `unsubscribe()` を呼ばないとメモリリークする

```javascript
const unsubscribe = db.collection('items')
  .where('uid', '==', uid)
  .onSnapshot(snapshot => {
    items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    render();
  });

// クリーンアップ時（ログアウト等）
unsubscribe();
```

---

## PWA 最小構成
**使い道**: 全プロジェクト（全社共通ルールでPWA対応が必須）
**実装例**: `開発部/sound-frame/` または `開発部/tatsuro/`
**注意点**: iconsは192px・512pxの2サイズ必須。start_urlはFirebaseホスティングルートに合わせる

### manifest.json
```json
{
  "name": "アプリ名",
  "short_name": "短縮名",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### sw.js（最小キャッシュ）
```javascript
const CACHE = 'v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
);

self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
);
```

### index.html に追加
```html
<link rel="manifest" href="/manifest.json">
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

---

## Vercel SPA フォールバック
**使い道**: Vercelにデプロイするシングルページアプリ（ゲーム含む）
**実装例**: `開発部/lexworld/vercel.json`
**注意点**: これがないとリロード時に404になる。ゲームはFirebaseよりVercelが設定量少なく速い

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## AI処理中の4ステートUI
**使い道**: AI APIを呼び出すプロジェクト全般
**実装例**: `開発部/sound-frame/app.js`（SoundFrame教訓から定型化）
**注意点**: 「処理中」表示がないとユーザーは「壊れた」と判断して離脱する

```javascript
// 状態: idle / loading / success / error の4ステート
function setState(state, message = '') {
  document.body.dataset.state = state;
  if (message) statusEl.textContent = message;
}

// 使い方
setState('loading', '処理中...');
try {
  const result = await callAI();
  setState('success');
} catch (e) {
  setState('error', 'エラーが発生しました');
}
```

```css
/* state別のUI制御 */
[data-state="loading"] .loading-indicator { display: block; }
[data-state="loading"] .submit-btn { pointer-events: none; opacity: 0.5; }
[data-state="error"] .error-message { display: block; }
```
