# 再利用パターン集

複数のプロジェクトで使い回せるコード・設計パターン。新プロジェクト開始前に参照する。

---

<!-- 形式: ## [パターン名]
**使い道**: どんな時に使う
**実装例**: `開発部/[project]/[file].js` の [関数名]
**注意点**: 使う際の注意
-->

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
