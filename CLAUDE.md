# CLAUDE.md — #100Day Challenge 本社

## 会社概要

**#100Day Challenge**は毎日1プロジェクトを立ち上げるWeb開発スタジオ。
Claude Codeが企画・実装・QA・デプロイを担う「AIファースト」な開発会社として運営する。

## 組織構成

| 部署 | ディレクトリ | 役割 |
|------|-------------|------|
| 企画部 | `企画部/` | アイデア生成・仕様書策定・技術選定 |
| 開発部 | `開発部/` | 実装・バグ修正・リファクタリング |
| QA部 | `QA部/` | コードレビュー・品質チェック |
| 運用部 | `運用部/` | デプロイ・日次レポート・監視 |

各部署ディレクトリに独自の `CLAUDE.md` がある。そのディレクトリで作業する際は、その部署のルールに従うこと。

## プロジェクト一覧

| プロジェクト | ディレクトリ | ステータス | 技術スタック |
|-------------|-------------|----------|-------------|
| WhiskyNote | `開発部/whisky-note/` | 稼働中 | Vanilla JS / Firebase |
| MoodForecast | `開発部/mood-forecast/` | 開発中 | React / Vite |
| NaniTaberu | `開発部/nani-taberu/` | 開発中 | Vanilla JS / Firebase / Rakuten Recipe API |

> 新プロジェクトを立ち上げたらこの表を更新すること。

## 新規プロジェクト立ち上げ手順

1. **企画部** に仕様書を作成する → `企画部/specs/YYYY-MM-DD-[name].md`
2. **開発部** に実装ディレクトリを作成 → `開発部/[name]/`
3. 開発部の `CLAUDE.md` に新プロジェクトのメモを追記
4. 実装完了後、**QA部** に `/code-review` を依頼
5. QA通過後、**運用部** が `firebase deploy` を実行
6. 本社 `CLAUDE.md`（この表）を更新

## 全社共通ルール

- **スピード優先**: 1日1プロジェクトのペース。完璧より完成を優先する
- **バニラJS優先**: ビルドステップは必要な場合のみ。Vanilla JS + CDNで済むなら使う
- **Firebase標準**: ホスティング・Auth・Firestoreはデフォルト選択肢
- **PWA対応**: manifest.json と service worker を原則追加する
- **日本語UI**: ユーザー向けの表示はすべて日本語

---

## WhiskyNote アーキテクチャ詳細

`開発部/whisky-note/` の詳細設計。

### File structure
| File | Role |
|------|------|
| `index.html` | All UI markup; screens toggled via CSS classes (`open`, `visible`) |
| `app.js` | All app logic — state, Firestore sync, rendering, event handling |
| `whisky-db.js` | Static `WHISKY_DB` array — local whisky reference data (Japanese whiskies) |
| `styles.css` | All CSS |

### Key architectural patterns

**State model** — module-level `let` variables in `app.js`: `records` (current user's data), `allRecords` (all Firestore docs for community search), `currentUser`, `currentDetailId`, `currentRating`, `currentPhoto`, `currentAromas[]`, `currentFlavors[]`.

**Data persistence** — Firestore is source of truth; `localStorage` (`whisky_note_v1_{uid}`) is an offline-first cache populated by `onSnapshot`. Writes go directly to Firestore (`db.collection('whiskyRecords').doc(id).set(...)`); the `onSnapshot` listener handles the local state update.

**Auth** — Firebase Auth with Google Sign-In popup. `auth.onAuthStateChanged` drives the full UI lifecycle: login screen ↔ main app, Firestore listener start/stop.

**Modal pattern** — Three detail-style modals: add/edit modal (`whiskyModal`), inline-edit detail modal (`detailModal`), and wiki/community detail modal (`wikiDetailModal`). The detail modal rebuilds its entire `innerHTML` on open and wires up its own event listeners each time. `document.body.style.overflow = 'hidden'` is used to lock scroll; `open` class triggers CSS transitions.

**Tag lists** — `setupTagList(containerId, options, arr)` renders predefined tags + custom-input. It clones the container node to strip old listeners, then renders fresh. Tags mutate the shared `currentAromas`/`currentFlavors` arrays in place.

**Photo handling** — three-stage fallback: Canvas→JPEG resize (max 1200px, 0.82 quality) → `heic2any` for desktop HEIC → raw FileReader. Photos are stored as base64 data URLs inside Firestore documents.

**Search** — client-side filter across `records` (name/distillery). At `query.length >= 2`, also queries `allRecords` for community matches and searches `WHISKY_DB` for reference data. Results rendered in three separate sections below the user's own collection.

### Deployment

```bash
firebase serve --only hosting   # ローカルプレビュー
firebase deploy --only hosting  # 本番デプロイ
```

Firebase project: `whisky-note-e137d`

No package.json / no npm dependencies — CDN scripts only (Firebase compat SDK 10.12.0, heic2any 0.0.4).
