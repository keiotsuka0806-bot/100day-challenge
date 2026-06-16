# CLAUDE.md — #100Day Challenge 本社

## Kei Context

Before giving substantive advice or collaboration, read `/Users/kei/codex/kei-persona.md` and use it as background context.

Use `/Users/kei/dev/100day-challenge` as the primary local workspace for this project. Old iCloud Drive paths may exist as backups or compatibility copies, but active code work should happen here.

## Config Boundary

Gitに入れるものは、組織の知識・部署ルール・Step 0の文脈・自動ルーティン・運用スクリプト・レポート形式まで。
秘密情報や端末依存の設定は `CLAUDE.local.md` または `.env.local` に置き、Gitには入れない。

## Step 0: Organization Context

この組織の目的は、`100日チャレンジを通してAI組織そのものを育てる` こと。

優先順位は次の順に固定する。

1. 学びを蓄積する
2. 1日あたり1プロジェクトの共有可能な成果を出す
3. 混入や事故を防いで、その学びを壊さず残す

AIは情報収集・整理・初案作成までを担い、人間が最終判断をする。
毎回の作業は、この3点のどれを前進させるかを意識して進める。

## 絶対ルール（全組織共通・最上位）

このルールは全部署・全プロジェクト・全セッションで例外なく守る。優先順位やスピードより上位に置く。

1. **嘘をつかない** — 事実の捏造・推測と事実の混同・誤りの放置をしない（既存の最上位ルール）。
2. **出せる全力を出す** — 「とりあえず動く」「無難」で止めない。今の自分が出せる最高を毎回出す。
3. **面白いことのために本気で取り組む** — 安全で退屈な焼き直しを量産しない。人を驚かせ・心を動かすものを本気で狙う。
4. **妥協をしない** — 時間・楽さを理由に質を落とさない。納得いかないものは出さず、納得いくまで詰める。

スピード優先（1日1プロジェクト）は、この絶対ルールを犠牲にしてよいという意味ではない。速さと全力・面白さ・非妥協を両立させる。

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
| SoundFrame | `開発部/sound-frame/` | デプロイ済み | Vanilla JS / FFmpeg.wasm |
| AI Project OS | `開発部/ai-project-os/` | 開発中 | Vanilla JS / localStorage |
| 激辛AI審査会 | `開発部/gekikara-review/` | デプロイ済み | Next.js / TypeScript / Tailwind |
| MeetingCostMeter | `開発部/meeting-cost-meter/` | 開発中 | Vanilla JS / localStorage |
| RetroSnap | `開発部/retro-snap/` | 開発中 | Vanilla JS / Canvas API |
| VibeSanitizer | `開発部/vibe-sanitizer/` | デプロイ済み | Vanilla JS / Vercel / Claude API |
| AI Debate Stage | `開発部/ai-debate-stage/` | 共有可能 | Vanilla JS / OpenAI API / Vercel |
| ShortsStudio | `開発部/shorts-studio/` | 休止 | Vanilla JS / FFmpeg.wasm / Firebase |
| AsaBrief | `開発部/asa-brief/` | 休止 | Vanilla JS / OpenAI API / Vercel |
| TokenDiet | `開発部/token-diet/` | デプロイ済み | Vanilla JS / gpt-tokenizer / Firebase |
| AI処方箋 | `開発部/ai-shohosen/` | デプロイ済み | Vanilla JS / Firebase Hosting |
| あいだ(Aida) | `開発部/aida/` | 共有可能 | Vanilla JS / Firestore / Vercel / OpenAI API |
| AIOrgSim | `開発部/ai-org-sim/` | デプロイ済み | React / Vite / TS / React Flow / Vercel（https://ai-org-sim.vercel.app） |
| ReceiptWarikan | `開発部/receipt-warikan/` | デプロイ済み | Vanilla JS / Vercel / OpenAI Vision（鍵未登録で休眠）（https://receipt-warikan-delta.vercel.app） |
| QRLivePoll | `開発部/qr-live-poll/` | デプロイ済み（ストック） | Vanilla JS / Vercel / qrcode-generator（Firebase未設定＝デモモード）（https://qr-live-poll.vercel.app） |

> 新プロジェクトを立ち上げたらこの表を更新すること。

## ステータス定義

| ステータス | 意味 |
| --- | --- |
| 開発中 | 実装中。まだQA前 |
| QA待ち | MVP実装完了。QAレビュー待ち |
| デプロイ済み | 本番URLはあるが、Genius Council前 |
| デプロイ後改善中 | Genius Councilの3ループ改善を処理中 |
| 共有可能 | QA・Genius Council・再確認が完了し、友達にURLを渡してよい |
| 改善中 | 既存プロジェクトの並行改善中 |
| 稼働中 | 共有可能化済みで継続利用可能 |
| 休止 | 現時点では開発しない |

## 新規プロジェクト立ち上げ手順

1. **企画部** に仕様書を作成する → `企画部/specs/YYYY-MM-DD-[name].md`
2. **開発部** に実装ディレクトリを作成 → `開発部/[name]/`
3. 開発部の `CLAUDE.md` に新プロジェクトのメモを追記
4. 実装完了後、**QA部** に `/code-review` を依頼
5. QA通過後、**運用部** が `firebase deploy` を実行
6. **デプロイ直後に、適切な天才プロ集団レビューを3ループ実行して改善する**
7. 本社 `CLAUDE.md`（この表）を更新

## 全社共通ルール

- **スピード優先**: 1日1プロジェクトのペース。完璧より完成を優先する
- **バニラJS優先**: ビルドステップは必要な場合のみ。Vanilla JS + CDNで済むなら使う
- **Firebase標準**: ホスティング・Auth・Firestoreはデフォルト選択肢
- **PWA対応**: manifest.json と service worker を原則追加する
- **日本語UI**: ユーザー向けの表示はすべて日本語

## デプロイ後 Genius Council ルール

すべてのプロジェクトは、デプロイ完了後に必ず `Genius Council` を通す。

`Genius Council` は、プロジェクト種別に応じた「天才プロ集団」によるレビューと改善ループである。

### 必須フロー

1. 運用部が本番URLを確認する
2. `運用部/scripts/post-deploy-genius-cycle.mjs` を対象プロジェクトに対して実行する
3. 自動選定されたプロ集団の観点で議論ログを作成する
4. 3ループの改善を実施する
5. 改善チケットを `デザイン部/reports/YYYY-MM-DD-[project]-genius-council.md` に保存する
6. `運用部/project-registry.json` を更新する
7. 変更があれば再デプロイし、再度疎通確認する
8. `運用部/scripts/release-check.mjs` で共有可能判定を行う

### プロ集団の自動選定

| 種別 | 参加する天才プロ集団 |
| --- | --- |
| ゲーム / パズル | プロゲーマー、レベルデザイナー、RTA走者、ゲームUXデザイナー |
| AIアプリ | AIプロダクト設計者、プロンプトエンジニア、セキュリティ監査者、UXリサーチャー |
| 写真 / 画像 / シェア | 写真家、SNSグロース専門家、モバイルUXデザイナー、ブランドデザイナー |
| 業務ツール / 管理アプリ | SaaS PM、業務改善コンサル、アクセシビリティ専門家、QAエンジニア |
| 学習 / 言語 / 知識 | 教育設計者、認知科学者、教材編集者、学習UXデザイナー |
| その他 | プロダクトマネージャー、UXデザイナー、QAエンジニア、グロース担当 |

### 3ループの定義

- **Loop 1: First-Use / Core Value**
  初見で価値が伝わるか、最初の成功体験までが短いかを改善する。
- **Loop 2: Expert Quality / Domain Depth**
  その領域のプロが見て、浅さ・破綻・退屈さ・危険さがないかを改善する。
- **Loop 3: Replay / Share / Operation**
  もう一度使う理由、人に渡す理由、運用で抜けない仕組みを改善する。

このフローは「任意の仕上げ」ではなく、デプロイ完了条件の一部とする。

### 共有可能ゲート

`共有可能` と言えるのは、以下のコマンドが通った場合のみ。

```bash
node 運用部/scripts/release-check.mjs --project [project-name]
```

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
