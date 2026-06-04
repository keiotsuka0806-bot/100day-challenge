# 学びログ

「なぜそうなったか」「何が原因だったか」「次に活かせるか」の視点で記録。

---

## 2026-06-01

- **Firebase Auth** `onAuthStateChanged` が発火する前に Firestore を呼ぶと `permission-denied` が出る。Auth リスナーの内側でのみ Firestore アクセスを開始すること。

- **Firebase Auth** Google Sign-In の popup は mobile Safari で失敗することがある（クロスオリジンポップアップブロック）。モバイル向けには `signInWithRedirect` へのフォールバックを検討すること。

- **Firestore** base64 data URL で写真を Firestore document に保存するとサイズが 1MB 上限に近づく。写真があるアプリは早めに Firebase Storage への移行を計画すること（whisky-note は現時点で上限接近リスクあり）。

- **Firestore** `onSnapshot` リスナーは `auth.onAuthStateChanged` でユーザーがログアウトした際に必ず detach すること。detach しないとメモリリーク＋ログアウト後も古いデータが残る。

- **Vanilla JS SPA** DOM 要素に `addEventListener` を複数回呼ぶと重複リスナーが積まれる。要素を `cloneNode(true)` して置き換えることで既存リスナーをすべて剥がせる（whisky-note の `setupTagList()` がこのパターン）。

- **PWA / HEIC** iOS のカメラ写真は HEIC 形式で渡される場合がある。`heic2any` ライブラリで JPEG に変換してから Canvas リサイズ処理に渡すこと。ただし heic2any は CDN 配信のみ（npm ビルドなし環境でも使える）。

---

## 2026-06-04

- **組織運営** CLAUDE.md はDay2で既にステイルになった（mood-forecastを「空のプレースホルダー」と記述したまま）。プロジェクト完成時に即 CLAUDE.md を更新しないと、次セッションのコンテキスト品質が劣化する。更新はデプロイ直後にやること。

- **組織運営** Firebase skills（firebase-basics / firebase-firestore / firebase-auth-basics 等）が `開発部/whisky-note/.agents/skills/` に閉じている。次の Firebase プロジェクトで再ダウンロードが必要になるか、存在を忘れる。org レベル（`開発部/.agents/skills/`）への移動を検討。

- **スタック判断基準** 「認証・クラウド同期が必要か」が vanilla+Firebase vs React+localStorage の分岐点。必要なら vanilla+Firebase（デプロイ速度優先）、不要なら React+Vite（npm依存が必要な時）。この基準を最初に確認することで迷いゼロにできる。
