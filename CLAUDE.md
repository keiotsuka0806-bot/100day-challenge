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

## 品質バー（絶対ルール2〜4のチェック可能版）

「全力」「面白い」「妥協しない」は形容詞なので、成果物ごとに次のチェックで判定する。**1つでも✗なら「共有可能」を名乗らない**（どのモデル・どのセッションでも同じ判定になることが目的）。

### アプリ（Dayプロジェクト）
- [ ] 初見の他人が、説明なしで10秒以内に「何ができるか」を言える（トップ画面だけで）
- [ ] 最初の成功体験（コア価値の瞬間）まで30秒・3操作以内
- [ ] 幅320pxで実測して崩れていない（[[mobile-breakage-playbook]]）
- [ ] 本番URLがHTTP 200を返すのを**実測**した（Vercel SSO保護OFF確認込み）
- [ ] APIキーなしでもモックで動く＝ランニングコストゼロ動線がある（サーバー型のみ）
- [ ] 「スクショして人に見せたくなる瞬間」がどの画面か、具体的に1つ言える
- [ ] 3ゲート（Genius Council 3ループ→QA→セキュリティ）の記録ファイルが残っている

### note記事・下書き
- [ ] タイトルに数字か固有の具体が入っている
- [ ] リード3〜4文だけで「読む理由」が成立している（本文を読まずに判定）
- [ ] Keiの実体験プレースホルダがあり、感情を創作していない（絶対ルール1）
- [ ] CTAは1つだけ（収益部funnel.mdの今週の導線）
- [ ] 誇張・実態と違う実績表現がゼロ（[[x-profile-bio]]の「嘘をつかない」）

### 企画案
- 朝会スキル（morning-routine）の各ゲート（4軸トーン・乗り換え理由・収益現実・需要実測）をそのまま適用。ここには重複して書かない。

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
| 収益部 | `収益部/` | 収益動線の管理・収益台帳・課金昇格判定(週次レビュー) |

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
| GratitudeJar | `開発部/gratitude-jar/` | 共有可能 | Vanilla JS / Canvas / Web Audio / localStorage / PWA / Vercel（API不要・コストゼロ）（https://gratitude-jar-lyart.vercel.app） |
| AI乱入大喜利 | `開発部/tsugihagi-sakubun-lab/` | デプロイ済み | Vanilla JS / Firestore(共有倉庫tatsuro-kei-2026・匿名auth) / Vercel関数+OpenAI(AI参戦・鍵ありで本物/なしでモック) / PWA（https://ai-ranyu-ogiri.vercel.app） |
| 段取り(Dandori) | `開発部/dandori/` | デプロイ済み | Vanilla JS / Vercel / PWA。ライフイベント手続きナビ。事実は人手キュレーション(AI不使用・コストゼロ)。引越し/結婚/出産/病気休職障害を実装、死別ほかは準備中（https://dandori-snowy.vercel.app） |
| RideDex | `開発部/ride-dex/` | デプロイ済み | Vanilla JS / PWA / Vercel関数+OpenAI Vision(鍵あり=本物/なし=デモモック)。街の車・バイクをカメラで鑑定→図鑑コレクションする"宝探し"。世代+確度+ユーザー訂正/レア演出/実績/撮影写真トグル保存/ナンバー自動モザイク。現実世界図鑑シリーズ第1弾（https://ridedex-kei.vercel.app） |
| TrainDex | `開発部/train-dex/` | デプロイ済み | Vanilla JS / PWA / Vercel関数+OpenAI Vision。鉄道図鑑（手入力主役＋AI任意＋フライホイール＋ポケモン図鑑型マスター16+24）。現実世界図鑑シリーズ第2弾（https://traindex-kei.vercel.app）。※統合版はTransportDex |
| TransportDex | `開発部/transport-dex/` | デプロイ済み | Vanilla JS / PWA / Vercel関数+OpenAI Vision。**車・鉄道・飛行機の統合プラットフォーム（顔は特化・中身は統合）**。1エンジン+ジャンル設定データ(genres.js)で駆動。ハブ(横断コレクション)＋ジャンル別アプリ(?g=train/ride/plane)。手入力主役/AI任意ヒント/オンデバイス類似検索/ポケモン図鑑型マスター/その他保持。新ジャンルは設定追加だけ（https://transportdex-kei.vercel.app） |
| 思考のセカンドオピニオン | `開発部/thought-second-opinion/` | デプロイ済み | Vanilla JS / Vercel関数+OpenAI(gpt-4o-mini) / PWA。CBT認知再構成(歪み提案→ソクラテス式3問→バランス思考→気分のビフォーアフター)の5分体験。危機ワード検出+常時相談窓口+反芻ガード+レート制限。鍵あり=本物/なし=モック（https://thought-second-opinion.vercel.app） |
| 衝動ブレーキ | `開発部/impulse-brake/` | デプロイ済み | Vanilla JS / PWA / Vercel関数+OpenAI(gpt-4o-mini・鍵なしモック=コストゼロ)。買う前に一拍おく道具(心の支え柱)。スクショを貼る(=買い物の顔)→AI3問(未来の自分)→自分の後悔率→24h再考→見送り累計/回数が育つ。値段任意・名前入力不要。全ショップ対応(貼るだけ)+iPhoneショートカットで買い物アプリ起動時に自動立ち上げ。研究起点=test-time computeを衝動買いに翻訳（https://impulse-brake-mu.vercel.app） |
| なんで箱(Naze Box) | `開発部/naze-box/` | デプロイ済み | Vanilla JS / PWA / Vercel関数+OpenAI(gpt-4o-mini・鍵なしモック=コストゼロ)。子どもの「なんで？」に年齢別(3/5/7/10歳)でAIが答える"好奇心アルバム"。回答は子どもファースト(絵文字ヒーロー+1文大きく／たとえ話・親向け補足は折りたたみ／つぎの質問で連鎖)。音声入力(話す)。保存すると**分野ごとの木が独立に育つ「好奇心の森」**(め→ふたば→き→はな→み)。新分野の芽ぶきでその分野の動物が来訪しコメント+おくりもの(棚に蓄積)。センシティブ語で親向け補足を厚く。研究起点=Karpathy「文脈=プログラム」(年齢文脈で出力可変)（https://naze-box.vercel.app） |

| うちの子語録辞典 | `開発部/uchinoko-jiten/` | デプロイ済み | Vanilla JS / PWA / localStorage / Vercel関数+OpenAI(gpt-4o-mini・鍵なしモック=コストゼロ)。子の言い間違い・迷言を国語辞典の体裁(【定義】【用例】【語源考察】)で大真面目に保存。写真添付(端末内のみ)・検索+五十音さくいん・カードPNG共有シート・控えJSON書き出し/復元。3ゲート通過(GC→QA8件修正→セキュリティ92点)。収益の芽=C小(製本用PDF買い切り)（https://uchinoko-jiten.vercel.app） |

| 引き継ぎ職人 | `開発部/hikitsugi-shokunin/` | 共有可能 | Vanilla JS / PWA / localStorage(端末内のみ+控えJSON) / Vercel関数+OpenAI(gpt-4o-mini・鍵なしモック=コストゼロ)。退職・異動前の引き継ぎ書づくり: 資料ドロップ(PDF/Word/Excel/PPT・端末内抽出)→AIが下書きWiki生成→**差分インタビュー**(書かれていないことだけ・音声回答可・1日3問ノルマ)→[[相互リンク]]Wiki→抜け漏れ検出+後任の30日プラン+HTML一式書き出し+❓質問タブ(後任がWikiに質問→出典付き回答)+完了率メーター+完了証明PNG。送信前に機密らしき文字列を端末内で伏せ字化+同意モーダル。3ゲート通過(GC 15/15→QA 29件検出22件修正→セキュリティ92点)+release-check共有可能。収益の芽=A型(期限駆動)。研究起点=Karpathy LLM Wiki（https://hikitsugi-shokunin.vercel.app） |

> 新プロジェクトを立ち上げたらこの表を更新すること。

## ステータス定義

| ステータス | 意味 |
| --- | --- |
| 開発中 | 実装中。まだQA前 |
| QA待ち | MVP実装完了。QAレビュー待ち |
| デプロイ済み | Genius Council通過後に本番URLを公開済み（疎通確認・release-check前） |
| デプロイ後改善中 | デプロイ後、本番URLで疎通確認・最終調整中（release-check待ち。※スクリプト互換のため名称は据え置き） |
| 共有可能 | QA・Genius Council・本番疎通が完了し、友達にURLを渡してよい |
| 改善中 | 既存プロジェクトの並行改善中 |
| 稼働中 | 共有可能化済みで継続利用可能 |
| 休止 | 現時点では開発しない |

## 新規プロジェクト立ち上げ手順

1. **企画部** に仕様書を作成する → `企画部/specs/YYYY-MM-DD-[name].md`
2. **開発部** に実装ディレクトリを作成 → `開発部/[name]/`
3. 開発部の `CLAUDE.md` に新プロジェクトのメモを追記
4. 実装完了後、ローカルプレビューで **Genius Council を3ループ実行して改善する**（コードが最も変わる工程なので最初に置く）
5. Genius Council 通過後、**QA部** に `/code-review` を依頼（**QAチェック**）
6. **セキュリティチェック**を実行（`security-check` スキル / `/security-review`）。検出事項を解消する（**コードを変える工程はここまで**＝デプロイ直前の最終ゲート）
7. **デプロイ前ゲート（Genius Council・QA・セキュリティ）をすべて通過してから**、**運用部** が本番デプロイを実行（Vanilla JS は Vercel / Firebase）
8. デプロイ後に本番URLで疎通確認し、`release-check` で共有可能判定 → 本社 `CLAUDE.md`（この表）を更新

## 収益動線(全社共通)

すべての成果物は、収益の3層(①プロダクト課金=本命/②コンテンツ販売/③メンバーシップ)のどれかに接続する。地図と現在地は `収益部/funnel.md`、実績は `収益部/ledger.md`。

- 企画部: 10案の表に「収益の芽」を一言書く(なしなら「なし」と書く。それも判断材料)
- 広報部: 記事末尾に `収益部/funnel.md` の「今週の導線」CTAを1つだけ入れる
- 収益部: 毎週日曜に週次収益レビュー(シグナル判定・記帳・導線更新)
- 実測値のみ記録。0円も記帳する

## 全社共通ルール

- **スピード優先**: 1日1プロジェクトのペース。完璧より完成を優先する
- **バニラJS優先**: ビルドステップは必要な場合のみ。Vanilla JS + CDNで済むなら使う
- **Firebase標準**: ホスティング・Auth・Firestoreはデフォルト選択肢
- **PWA対応**: manifest.json と service worker を原則追加する
- **日本語UI**: ユーザー向けの表示はすべて日本語

## デプロイ前ゲート（必須・最上位）

すべてのプロジェクトは、**本番デプロイの前に**次の3点をこの順で通す。**1つでも未通過ならデプロイしない。**

1. **Genius Council（3ループ）** — ローカルプレビューに対して下記フローを実施し、通過させる（**コードを最も変える工程なので最初に**）
2. **QAチェック** — QA部に `/code-review`。GO/NO-GO基準（`QA部/CLAUDE.md`）を満たす
3. **セキュリティチェック** — `security-check` スキル（または `/security-review`）で点検し、検出事項を解消する（**デプロイ直前の最終ゲート。通過後はコードを変えない**）

**順序の根拠**: ゲートの目的は「未レビューのコードを本番に出さない」こと。コードを最も変える Genius Council を先に、コードを変えない最終レビュー（QA→セキュリティ）を後に置くことで、最終成果物そのものをQA・セキュリティがサインオフできる。セキュリティ通過後はコードを変えずにデプロイする。

順序の目安: **Genius Council → QA → セキュリティ → 本番デプロイ**。

### Genius Council（デプロイ前ゲートの一部）

`Genius Council` は、プロジェクト種別に応じた「天才プロ集団」によるレビューと改善ループである。

### 必須フロー

1. ローカルプレビューを起動する（`firebase serve` / `vercel dev` / ローカルhttpサーバー等）
2. `運用部/scripts/post-deploy-genius-cycle.mjs` を対象プロジェクトに対して実行する（`--url` にはローカルプレビューURLを渡す。スクリプト名は歴史的経緯で `post-deploy` のままだが、運用上は**デプロイ前ゲート**として使う）
3. 自動選定されたプロ集団の観点で議論ログを作成する
4. 3ループの改善を実施する
5. 改善チケットを `デザイン部/reports/YYYY-MM-DD-[project]-genius-council.md` に保存する
6. **Genius Council 通過後に、はじめて本番デプロイする**
7. デプロイ後、本番URLで疎通確認（HTTP 200・主要機能）する
8. `運用部/scripts/release-check.mjs` で共有可能判定を行い、`運用部/project-registry.json` を更新する

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

このフローは「任意の仕上げ」ではなく、**デプロイの前提条件（ゲート）**とする。

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
