# 再利用パターン集

複数プロジェクトで使い回せるコード・構造のカタログ。

---

## cloneNode リスナー剥がしパターン

**使い道**: DOM 要素に複数回 `addEventListener` が呼ばれる場面（再レンダリング時のリスナー重複防止）

**実装例**: `開発部/whisky-note/app.js` の `setupTagList()` 関数

```js
function setupTagList(containerId, options, arr) {
  const container = document.getElementById(containerId);
  // cloneNode(true) で既存リスナーをすべて剥がす
  const fresh = container.cloneNode(false); // 子ノードは不要なので false
  container.parentNode.replaceChild(fresh, container);
  // fresh に新しい内容を構築してリスナーを登録
}
```

**注意点**: `cloneNode(true)` は子ノードごとコピーする。既存子ノードを捨てたい場合は `cloneNode(false)` を使う。

---

## onSnapshot + Auth ライフサイクルパターン

**使い道**: Firebase Auth + Firestore を使うすべてのアプリ

**実装例**: `開発部/whisky-note/app.js` の `auth.onAuthStateChanged` ブロック

```js
let unsubscribeSnapshot = null;

auth.onAuthStateChanged(user => {
  if (user) {
    // ログイン時：リスナー開始
    unsubscribeSnapshot = db.collection('records')
      .where('uid', '==', user.uid)
      .onSnapshot(snapshot => { /* ... */ });
  } else {
    // ログアウト時：リスナー必ず detach
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }
});
```

**注意点**: `unsubscribeSnapshot` を module レベルの変数に保持すること。関数スコープに置くと参照できなくなる。

---

## base64 写真リサイズ → Firestore 保存パターン

**使い道**: 写真アップロード機能（Firebase Storage なしで Firestore に直接保存する場合）

**実装例**: `開発部/whisky-note/app.js` の `handlePhotoUpload()` 相当処理

```
[ファイル選択]
  → HEIC? → heic2any でJPEG変換
  → Canvas でリサイズ（max 1200px, quality 0.82）
  → base64 data URL として変数に保持
  → Firestore document の photo フィールドに保存
```

**注意点**: Firestore document の上限は 1MB。base64 JPEG（1200px, 0.82品質）は概ね 150〜400KB。写真1枚なら収まるが、複数枚・高品質は危険。本番ではFirebase Storageへの移行を前提にすること。

---

## vanilla JS SPA 画面切り替えパターン

**使い道**: ビルドステップなしの SPA でルーティングなしの画面遷移

**実装例**: `開発部/whisky-note/index.html` + `app.js` の画面切り替え処理

```js
// CSS クラスで表示/非表示を制御
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}
```

```css
.screen { display: none; }
.screen.active { display: block; }
```

**注意点**: モーダルは別管理（`open` クラス + `body.style.overflow = 'hidden'`）。スクロールロックを忘れると背景がスクロールする。
