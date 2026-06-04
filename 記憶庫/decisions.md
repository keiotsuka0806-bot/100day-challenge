# 意思決定ログ

将来また同じ迷いが出た時のための判断記録。

---

## 2026-06-01 [whisky-note] スタック選定：vanilla JS + Firebase

**決定**: ビルドステップなしの vanilla JS + Firebase CDN を採用

**理由**: 1日開発で即デプロイが目標のため、バンドラー設定に時間を使いたくない。`firebase serve` → `firebase deploy` で完結する最短経路を取った。FirebaseのCDN版（compat SDK 10.12.0）は import/export 不要でグローバル参照でき、`<script>` タグ追加だけで機能が増やせる。

**却下した案**: React + Vite → ビルド設定・HMR・npm依存の管理コストが1日スプリントには過剰。TypeScriptも同様の理由で却下。

---

## 2026-06-01 [mood-forecast] スタック選定：React + Vite + localStorage

**決定**: React + Vite で SPA を構築し、データは localStorage のみに保存

**理由**: mood-forecast は認証不要・クラウド同期不要のローカル完結アプリ。Chart.js等のnpm依存を使いたかったため、バンドラー（Vite）が必要だった。Firebaseを入れるとコスト（Auth設定・Firestore rules）が発生するが、ユーザー価値の増分がゼロなので却下。

**却下した案**: vanilla JS → chartsライブラリのESM依存解決が煩雑。Firebase → 認証・クラウド同期が不要なユースケースにオーバースペック。

---

## 2026-06-04 [組織] 記憶庫の設計：ファイルベース vs 外部サービス

**決定**: `記憶庫/` ディレクトリ内のmarkdownファイル（decisions.md / lessons.md / reusable-patterns.md）で知見管理

**理由**: Claude Code のコンテキストはファイル読み込みで補完される。Git管理下のmarkdownなら、CLAUDE.md等と同じ仕組みで参照でき、ツール追加ゼロで運用できる。Mem0/Zep等の外部サービスはAPI連携コストがあり、1人スタジオには過剰。

**却下した案**: 外部記憶サービス（Mem0等）→ API連携・認証・コスト管理が必要。セッションメモリのみ → セッション間で消える。
