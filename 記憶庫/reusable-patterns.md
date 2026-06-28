# 再利用パターン集

複数のプロジェクトで使い回せるコード・設計パターン。新プロジェクト開始前に参照する。

---

## QR・招待リンクは本番URLを固定で焼く（inviteUrl / AI乱入大喜利）
**使い道**: QR・招待リンクでスマホを呼び込む「各自デバイス参加型」アプリ全部。`location.origin` をそのまま焼くと localhost / Vercelプレビューが本番QRに混入し「アクセスできません」になるのを防ぐ。
**実装例**: `開発部/tsugihagi-sakubun-lab/app.js` の `inviteUrl()`。
```js
const PUBLIC_ORIGIN = 'https://ai-ranyu-ogiri.vercel.app'; // 本番公開URL
function inviteUrl(path = '') {
  const o = location.origin;
  // localhost / Vercelプレビュー(*.vercel.app の自動生成名)では本番URLに差し替える
  const isLocal = /localhost|127\.0\.0\.1/.test(o);
  const isPreview = /-[a-z0-9]+\.vercel\.app$/.test(o) && o !== PUBLIC_ORIGIN;
  const base = (isLocal || isPreview) ? PUBLIC_ORIGIN : o;
  return base + path; // QR・招待リンク・結果コピーはすべてこれを通す
}
```
**注意点**: ① 本番ドメインを取得し直したら `PUBLIC_ORIGIN` を更新する。② QR・招待リンク・「結果をコピー」など**外部に渡るURLは全部 inviteUrl() を経由**させる（1箇所でも生 origin が残ると混入する）。③ QRはくっきり描画＋URLテキスト併記にすると、読めない端末でも手入力で救える（6/22実機指摘の対応）。

<!-- 形式: ## 朝会統合パターン（複数ルーティン→1対話セッション）
**使い道**: 複数の定期AIタスクをコスト最小で回したいとき
**実装例**: `.claude/skills/morning-routine/SKILL.md`（記憶庫レトロ・企画生成・組織レポート・Job Scout・note下書きを1セッションに統合）
**基本構造**: ①各タスクの旧プロンプトを1スキルのStepに変換 ②WebSearch等の予算をセッション全体で配分 ③やることがないStepはスキップ ④最後にスコープ単位でcommit
**注意点**: ヘッドレス実行・クラウドルーティンは2026-06-15以降クレジット消費。対話セッションは対象外なので、定常業務は「人間が開始する1セッション」に寄せるのが最安

## [パターン名]
**使い道**: どんな時に使う
**実装例**: `開発部/[project]/[file].js` の [関数名]
**注意点**: 使う際の注意
-->

## 処方箋型(プロンプト受け渡し型)公開AIアプリ
**使い道**: AIに不慣れな一般ユーザー向けに、APIキー不要・無料・障壁ゼロでAIの価値を届けたいとき
**実装例**: `開発部/ai-shohosen/`(悩みカテゴリを選ぶ→そのまま貼れる「効くプロンプト」を生成して渡す)
**基本構造**: ①アプリ自身はAPIを叩かない(=キー・課金・コスト不要) ②ユーザーの状況をフォームで受け取り、最適化済みプロンプト文字列を生成 ③「コピーしてChatGPTに貼る」導線で完結。アプリ側はテンプレ＋分岐ロジックだけ
**勝ち筋**: 「ChatGPTと同じチャット箱」では本体に勝てない。「持っているChatGPTを使えるようにする」補完ポジションなら乗り換え理由が立つ
**注意点**: YMYL(お金・健康)テーマは「誇張・一発逆転を禁止/リスクは正直に」を生成プロンプトに固定する

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

## 夜間自動リサーチパターン（Remote Routine）
**使い道**: 毎晩決まった時刻にWebリサーチを自動実行し、翌日の企画・開発に使う情報をまとめるとき
**実装例**: claude.ai/code/routines → `夜間リサーチエージェント`（trig_01N7K2cDH4vZB2TkFv217PJG）
**基本フロー**:
1. `schedule`スキルでRemote Routineを作成（cron式はUTC）
2. allowed_toolsに`WebSearch`と`WebFetch`を追加
3. プロンプトにリサーチトピック・出力ファイルパス・git commit手順を明示
4. 最後にレポート全文を出力するよう指示（git push失敗時でもログURLで確認できる）
5. `git push 2>/dev/null || echo 'skip'` でpushエラーを握りつぶす
**注意点**: Remote Routineはローカルファイル・環境変数不可。結果の確認はルーティンログURL（`claude.ai/code/routines/{id}`）かgit push成功後のリポジトリのどちらかになる。GitHub MCP未接続の場合はgit pushが失敗するがログで閲覧できる

## MCP登録パターン（Keychain経由）
**使い道**: APIトークンが必要なMCPを安全に登録するとき
**手順**:
```bash
# 1. Keychainに保存
security add-generic-password -a "kei" -s "[service-name]" -w "token_value"

# 2. MCPに登録（起動時にKeychainから取得）
claude mcp add [name] --scope user \
  -e TOKEN="$(security find-generic-password -s [service-name] -w)" \
  -- npx -y [mcp-package]
```
**注意点**: tokenは登録時に展開されて~/.claude.jsonに保存される。トークン再発行時は`claude mcp remove`→再登録が必要

## Playwright MCPによるデプロイ後確認パターン
**使い道**: デプロイ後にアプリが正しく表示されているか自動確認するとき
**手順**: `mcp__playwright__browser_navigate` → `mcp__playwright__browser_take_screenshot` → 画像をReadで確認
**注意点**: 初回はPlaywrightのブラウザバイナリのダウンロードが走るため時間がかかる

## Firestoreをサービスアカウント認証で操作するパターン
**使い道**: Firebase Admin SDKを使わずNode.jsだけでFirestoreに書き込むとき（フックスクリプトなど）
**実装例**: `~/.claude/kanban-sync/sync.js` のgetAccessToken()・fsReq()
**手順**:
1. gcloudでサービスアカウント作成 → keyをJSONでダウンロード
2. RS256でJWTを署名しOAuth tokenを取得
3. `https://firestore.googleapis.com/v1/projects/{id}/databases/(default)/documents/` にREST
**注意点**: npmパッケージ不要。Node.js標準の`crypto`と`https`だけで完結する

## WriteフックでNode.jsスクリプトを呼ぶパターン
**使い道**: ファイル書き込み後に複数の処理（Obsidian更新・Kanban同期など）をまとめて実行するとき
**実装例**: `~/.claude/kanban-sync/on-nikki-write.js`
**設定**:
```json
{ "matcher": "Write", "hooks": [{ "type": "command",
  "command": "cat | node ~/.claude/kanban-sync/on-nikki-write.js 2>/dev/null || true",
  "async": true }] }
```
**注意点**: stdinからPostToolUse JSONを受け取る。file_pathを見て対象ファイルかどうかを最初に判定してexit(0)する設計にすること

## Firebase新規プロジェクト初期化チェックリスト
**使い道**: 新プロジェクトにFirebaseを追加するたびに参照
**手順**:
1. `firebase init` でプロジェクト作成
2. Firebaseコンソールで Authentication → Google プロバイダーを「始める」（手動必須）
3. Firestore Security Rulesを設定
4. `.firebaserc`のdefaultにproject-idを設定
**注意点**: 手順2はAPIで自動化できない。必ずコンソールで手動操作が必要

## AI画像採点アプリパターン
**使い道**: 写真を入力してAIに評価・分類・アドバイスさせるアプリを作るとき
**実装例**: `開発部/food-score/app.js` の `resizeImage()`・`callScoringApi()`・`displayResults()`、`開発部/food-score/api/analyzeFood.js`
**基本フロー**:
1. `FileReader` または `getUserMedia` で画像を取得
2. Canvasで長辺1200px程度にリサイズ
3. base64に変換
4. ブラウザから `/api/analyzeFood` へ送信
5. Vercel Serverless Function側でOpenAI Visionへ画像とJSON出力指定プロンプトを送信
6. 返却JSONを検証してUIに反映
7. 必要なら `localStorage` に履歴を保存
**注意点**: APIキーをブラウザに置かない。友達共有URLを最終成果物にする場合は、Vercel環境変数などサーバー側でキーを管理し、無料公開ではレート制限・画像サイズ制限を入れる。

## デザイン部3ループ改善パターン
**使い道**: 1日プロジェクトをデプロイ後、友達に渡せる品質まで短時間で上げるとき
**実装例**: `デザイン部/reports/2026-06-05-food-score.md`
**基本フロー**:
1. Web上の同種アプリ・UI/UX傾向を軽く調べる
2. Loop 1: First Impressionを改善する
3. Loop 2: Core Flowを改善する
4. Loop 3: Shareabilityを改善する
5. デプロイして、友達共有URLを日報に残す
**注意点**: 1日プロジェクトでは大改造よりも、初回30秒で使えること、迷わないこと、共有しやすいことを優先する。

## Genius Council デプロイ後3ループ改善パターン
**使い道**: すべてのプロジェクトで、デプロイ後に領域別の天才プロ集団レビューを自動生成し、3回の改善ループを強制するとき
**実装例**: `運用部/scripts/post-deploy-genius-cycle.mjs`
**基本フロー**:
1. プロジェクトを本番デプロイする
2. 本番URLのHTTP 200を確認する
3. 以下を実行する
```bash
cd /Users/kei/dev/100day-challenge
node 運用部/scripts/post-deploy-genius-cycle.mjs --project 開発部/[project-name] --url [production-url]
```
4. スクリプトがプロジェクト種別を判定する
   - game: プロゲーマー、レベルデザイナー、RTA走者、ゲームUX
   - ai: AIプロダクト、プロンプト、セキュリティ、UX
   - visual-share: 写真家、SNS、モバイルUX、ブランド
   - ops-tool: SaaS PM、業務改善、アクセシビリティ、QA
   - learning: 教育設計、認知科学、教材編集、学習UX
   - 自動判定が合わない場合は `運用部/council-overrides.json` の `typeOverride` / `councilOverride` で上書きする
5. `デザイン部/reports/YYYY-MM-DD-[project]-genius-council.md` の改善チケットを読む
6. `運用部/tasks/[project]/GC-L1.md`、`GC-L2.md`、`GC-L3.md` の作業カードに沿って改善を実装するか、改善不要理由を記録する
7. 変更があれば再デプロイし、公開URLを再確認する
8. `node 運用部/scripts/release-check.mjs --project [project-name]` を実行し、共有可能判定を確認する
9. 画面の実表示確認が必要な場合は `node 運用部/scripts/release-check.mjs --project [project-name] --visual` を実行する
10. 複数プロジェクトをまとめて見る場合は `node 運用部/scripts/release-check-all.mjs --visual` を実行する
**生成されるファイル**:
- `運用部/project-registry.json`
- `運用部/council-overrides.json`
- `デザイン部/reports/YYYY-MM-DD-[project]-genius-council.md`
- `運用部/tasks/[project]/GC-L1.md`
- `運用部/tasks/[project]/GC-L2.md`
- `運用部/tasks/[project]/GC-L3.md`
- `運用部/tasks/[project]/release-fix.md`（Release Check失敗時）
- `広報部/handoff/[project]-YYYY-MM-DD.md`
**補助コマンド**:
- `node 運用部/scripts/sync-project-registry.mjs`: `開発部/` 配下を見てProject Registryを同期する
- `node 運用部/scripts/release-check-all.mjs --visual`: URLありプロジェクトを一括でRelease Checkする
- `node 運用部/scripts/update-council-task.mjs --project [project] --ticket GC-L1 --status Done --file [path] --command "[command]"`: Councilタスクの状態と証拠欄を更新する
- `node 運用部/scripts/visual-smoke-check.mjs --url [production-url] --project [project-name]`: 公開画面の実表示またはHTML取得を確認する
**状態遷移**: `開発中 -> デプロイ済み -> デプロイ後改善中 -> 共有可能`。Release Check失敗時は `要修正`。
**注意点**: レポート生成だけで完了にしない。Genius Councilは「議論ログを作る仕組み」であり、実装反映または明確な見送り判断、変更ファイル・確認コマンド・公開URL確認の証拠記録、GC-L1/L2/L3合計12点以上までが完了条件。

## 静的PWA + Firebase Hostingパターン
**使い道**: 1日プロジェクトを素早く公開し、スマホのホーム画面に追加できる形にするとき
**実装例**: `開発部/food-score/manifest.json`・`sw.js`・`firebase.json`
**標準ファイル**:
- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `sw.js`
- `firebase.json`
- `.firebaserc`
**注意点**: Firebase側で `Cache-Control: no-cache` を設定してもService Workerが古いファイルを保持することがある。更新通知またはキャッシュ名更新を忘れない。

## cloneNode リスナー剥がしパターン
**使い道**: DOM 要素に複数回 `addEventListener` が呼ばれる場面（再レンダリング時のリスナー重複防止）
**実装例**: `開発部/whisky-note/app.js` の `setupTagList()` 関数
```js
function setupTagList(containerId, options, arr) {
  const container = document.getElementById(containerId);
  const fresh = container.cloneNode(false); // cloneNode(false) で既存リスナーをすべて剥がす
  container.parentNode.replaceChild(fresh, container);
  // fresh に新しい内容を構築してリスナーを登録
}
```
**注意点**: `cloneNode(true)` は子ノードごとコピーする。既存子ノードを捨てたい場合は `cloneNode(false)` を使う。

## onSnapshot + Auth ライフサイクルパターン
**使い道**: Firebase Auth + Firestore を使うすべてのアプリ
**実装例**: `開発部/whisky-note/app.js` の `auth.onAuthStateChanged` ブロック
```js
let unsubscribeSnapshot = null;

auth.onAuthStateChanged(user => {
  if (user) {
    unsubscribeSnapshot = db.collection('records')
      .where('uid', '==', user.uid)
      .onSnapshot(snapshot => { /* ... */ });
  } else {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }
});
```
**注意点**: `unsubscribeSnapshot` を module レベルの変数に保持すること。関数スコープに置くと参照できなくなる。

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

## vanilla JS SPA 画面切り替えパターン
**使い道**: ビルドステップなしの SPA でルーティングなしの画面遷移
**実装例**: `開発部/whisky-note/index.html` + `app.js` の画面切り替え処理
```js
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

## 「診断→おすすめ→ドライラン効果予測→ワンクリック反映→即再評価」ループ
**使い道**: ツールを"操作"ではなく"遊んで学ぶ"体験にしたいとき。詰まり/問題を自動診断し、対処候補を提示、適用前に効果を予測（ドライラン）し、ワンクリックで反映してすぐ結果が変わるループを作る。
**実装例**: `開発部/ai-org-sim/` の詰まり診断→おすすめ部署（7種ライブラリ）→ドライランで効果予測→ワンクリック追加で即再シミュ。
**注意点**: ① 「適用前の効果予測」があると安心して試せるので学習効果が跳ね上がる。② おすすめは固定ライブラリ（少数の型）で十分。AIに頼らずモックで成立させると鍵不要・コストゼロで動く。③ Before/After差分を必ず可視化して「自分の操作が何を変えたか」を返すこと。

## 端数を1円も失わない金額按分（最大剰余法 / reconcileToYen）
**使い道**: 割り勘・税込按分・ポイント配分など「総額を複数人/複数項目に整数で分ける」全ての場面。各人を独立に `Math.round` すると合計が総額とズレるのを防ぐ。
**実装例**: `開発部/receipt-warikan/app.js` の `reconcileToYen()`。
```js
// shares: 各人の理論上の取り分（小数可）, total: 配りたい整数総額
function reconcileToYen(shares, total) {
  const floored = shares.map(Math.floor);
  let remainder = total - floored.reduce((a, b) => a + b, 0); // 配り残しの円
  // 小数部が大きい人から順に1円ずつ配る（最大剰余法）
  const order = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) floored[order[k].i] += 1;
  return floored; // 合計は必ず total に一致
}
```
**注意点**: ① 「各人の表示額の合計＝総額表示」を必ずテストで担保する（1000円を3人→334/333/333）。② 端数の行き先（誰が多く負担するか）は小数部順で決まるので公平。意図的に幹事へ寄せたいなら order の基準を変える。③ 負の remainder（取りすぎ）はこのコードでは起きない前提（floor配分なので remainder ≥ 0）。

## タイムゾーン・時差・DSTを自前計算せず Intl に任せる（WhenToPing）
**使い道**: 「相手の現在ローカル時刻」「都市間の時差」「サマータイム(DST)」を扱う全アプリ。タイムゾーンDBを抱えず、ライブラリ不要・ブラウザ標準だけで正確に出す。
**実装例**: `~/dev/when-to-ping/index.html`（100day repo外）。
```js
// ある都市の「今この瞬間のローカル時刻」を時間(小数)で得る
function localFracOf(timeZone) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date());
  const h = +p.find(x => x.type === 'hour').value % 24;
  const m = +p.find(x => x.type === 'minute').value;
  return h + m / 60; // 例: 14.5 = 14:30
}
// 時差は (相手frac − 自分frac) で算出。30/45分ズレ・DSTも Intl が吸収する
```
**注意点**: ① タイムゾーンIDは IANA名（`Asia/Tokyo`等）で持つ。`formatToParts` は半時間・15分ズレ都市(India/Nepal)もDST切替も自動で正しい。② 深夜またぎの就寝判定（23時就寝→7時起床のような範囲が0時をまたぐ）は `start>end ? (t>=start||t<end) : (t>=start&&t<end)` で分岐する。③ 曜日表示は `weekday` を ja-JP にしないと英語(Mon)が混ざる（6/21 QAで実際に踏んだ）。④ 端末ロケール差を避けるため数値抽出は `en-US` 固定、表示だけ ja-JP にする。


## オンデバイス・データフライホイール（埋め込み類似検索でLLM前に無料候補を出す／TrainDex）
**使い道**: 画像/テキストを「撮る・入れる→AIに識別させる」系アプリで、ユーザーの正確なラベルを資産化してLLM課金とミスを減らしたいとき。コンセプトは **recall(LLMの記憶想起) < retrieval(過去ラベルとの照合)**（Karpathy流＝精度はモデルで買わず、貯めて・測って・検索に回す）。
**実装の骨子**（依存ゼロ・端末内完結・プライバシー良好）:
```js
// 1. 画像を軽い埋め込みに（16x16にリサイズ→RGB→平均除去→L2正規化の768次元・自前）
//    ※生画像は保存せず「埋め込み数値＋ユーザーが付けた正解ラベル」だけをlocalStorageへ（最大300件）
// 2. 新しい写真を撮ったら、過去ラベル全件とコサイン類似度を取り、最上位を
//    「💡 あなたの図鑑で見た目が似ている → ○○ これかも？」とLLM呼び出しの前に無料・オフライン提示
// 3. タップでフォーム自動入力。ユーザーが直せばそれが新たな正解ラベルとして貯まる＝フライホイール
```
**注意点**: ① 生の類似%は誤解を招くので非表示にし「これかも？」表記にする（実測で同形式0.28 vs 別物−0.15＝順位は機能するが絶対値は意味を持たせない）。② `computeEmbedding` を関数分離しておけば将来CLIP等へ差し替え可能（小さく作って回す）。③ 顔写真そのものを貯めない＝埋め込み数値のみ保存でプライバシーを担保。④ 必ず実画像で識別性能を測ってから「効く」と言う。
