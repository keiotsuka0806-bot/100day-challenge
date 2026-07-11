# デプロイ罠プレイブック（公開前後の定番事故・統合版）

100日チャレンジで繰り返し踏んできた公開まわりの罠を1枚に統合したもの。散在していた記憶（各メモリ）を、**症状 → 確認コマンド → 対策**の形でまとめる。デプロイ前後（自走ループ Phase 4）で参照する。

> 大原則: **「公開した」と言う前に、公開URLで HTTP 200 を実測する。** 302/401のまま「公開済」と言わない（嘘をつかない）。

---

## リリース前クイックチェック順序（この順で）

```bash
cd /Users/kei/dev/100day-challenge
node 運用部/scripts/check-mobile.mjs 開発部/[project]      # 罠④ スマホ崩れの静的検出
# 3ゲート（genius-audit → /code-review → security-check）を通す
node 運用部/scripts/release-check.mjs --project [project] --visual   # 総合ゲート
# デプロイ後：
curl -s -o /dev/null -w "%{http_code}\n" https://<url>/     # 罠① 200実測（302/401ならSSO壁）
```
> ⚠️ **release-check.mjs の HTTP判定は 3xx も「OK」扱い**（`>=200 && <400`）。つまり **SSO壁の302を見逃してPASSする**。release-checkが通っても、上の `curl ... -w "%{http_code}"` で**200を目視確認**すること（罠①）。

---

## 罠① Vercel SSO保護（公開URLがログイン壁）

**症状**: 新規Vercelプロジェクトを `vercel --prod` すると Deployment Protection がデフォルトON。本番URLが `vercel.com/sso-api` へ **302** し、友達が開けない（RideDayで実際に発生）。

**確認**:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<url>/   # 302 なら疑う
curl -I https://<url>/ | grep -i location                 # location が sso-api ならこれ
```

**対策**（トークンは `~/Library/Application Support/com.vercel.cli/auth.json`。projectId/orgId は `<proj>/.vercel/project.json`）:
```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"ssoProtection":null}' \
  "https://api.vercel.com/v9/projects/<projectId>?teamId=<orgId>"
```
解除後に root が **200** になることを確認。短い共有名は `vercel alias set <deploymentUrl> <name>.vercel.app`。
**新規プロジェクトを公開するたびに必ずこの確認をする。**

---

## 罠② モノレポ誤爆デプロイ（別プロジェクトに飛ぶ）

**症状**: `開発部/[app]` に自前の `.vercel` が無い状態で `vercel` を打つと、リポジトリに紐づく**別の既存プロジェクトを自動で拾って誤デプロイ**（実例: 「あいだ」のファイルが food-score に飛んだ）。

**対策**: 新規アプリは**必ず自分専用の紐付けを先に作る**。リポジトリ外から初回デプロイして専用プロジェクトを作り、生成された `.vercel` を本体にコピーしてから以後は本体から直接デプロイ:
```bash
rm -rf ~/app-deploy && rsync -a --exclude node_modules --exclude .vercel --exclude .git 開発部/[app]/ ~/app-deploy/
# 人間（ログイン済み端末）: cd ~/app-deploy && npx vercel   → 新規プロジェクトとして作成
```
詳細は `server-app-deploy` スキル。リポジトリ直下に `.vercel` を置かない。

---

## 罠③ Service Worker キャッシュ（変更が反映されない）

**症状**: 「直したのに全然変わってない」。cache-first の `sw.js` が初回保存した `app.js`/CSS を**ずっと返し続ける**。実装ミスではなくSWのキャッシュ。

**対策**:
- Web版の変更が反映されない → まず `sw.js` のキャッシュ戦略を疑う。
- cache-first を **network-first + バージョン管理**（skipWaiting / activate時に旧キャッシュ削除 / clients.claim）に。`CACHE='xxx-v2'` のように**版数を上げる**。
- **CSS/JSを直したら必ず `sw.js` の版数を上げる**（罠④とセット）。上げないと古い版が実機に残る。
- ローカル確認は **新しいポートで開く**（8124→8125）と旧SW/HTTPキャッシュの管轄外で確実に最新が出る。開発中は index.html のSW登録を無効化＋既存を `unregister` し、公開前に戻す。
- Playwright（サンドボックスChrome）でも同じ事故が起きる → 検証は新ポート＋SW無効が安定。

---

## 罠④ スマホ320px崩れ（PCで綺麗・スマホでガタガタ）

**症状**: 原因は横はみ出しではなく **flex行に要素を詰め込みすぎて潰れる**。320pxでボタン/入力が極端に細く多行折返しする（375では出ないことが多い）。

**確認・対策**:
1. ローカルでPlaywrightを **320px幅**で開く。`scrollWidth - clientWidth` と主要要素の `getBoundingClientRect().width`・行数を**実測**（推測しない）。
2. 詰まったflex行は `flex-wrap` ＋ 最重要要素を `flex: 1 1 100%`（独立行）、広い画面用に `@media (min-width: 420px)` で横並びへ戻す。
3. **`sw.js` の版数を上げる**（罠③）。上げないと古いCSSが実機に残る。
4. 実機反映はデプロイ後。公開は勝手にやらず確認。

**仕組み化済み（活用する）**:
- 雛形 `開発部/_templates/vanilla-starter/styles.css` に崩れ防止の土台CSS内蔵（新規アプリは自動継承）。
- `node 運用部/scripts/check-mobile.mjs <project>`（依存なし静的検出）。
- `運用部/scripts/visual-smoke-check.mjs` が320px横はみ出しを測定（release-check `--visual` で自動・8px超NG）。

---

## 罠⑤ Firebase上限とVercelを混同しない

- **「新規プロジェクトが作れない」= Firebase の話**（無料プランの数上限）。Firebaseは新規作らず共有倉庫 `tatsuro-kei-2026`（表示名「100Day Challenge」）に相乗り、アプリごとにコレクションを分ける。
- **Vercel は別サービス。上限に達しておらず、Dayアプリごとに新規作成してよい**（`vercel link`→`vercel --prod`）。Firebaseと混同して止めない。新規Vercelは罠①のSSO確認を忘れず。
- Firestoreルールは**コレクションごとに match ブロックを追記**＋末尾に `match /{document=**} { allow read,write: if false; }` の安全網。**他アプリの既存ブロックは絶対に消さない**。稼働中のWhiskyNote（`whisky-note-e137d`）は共有倉庫に巻き込まない。

**`.vercelignore` の罠**: `firebase-config.js` を `.gitignore` していると、Vercelは `.vercelignore` が無い時 `.gitignore` を流用するため本番に上がらず**デモモードのまま**になる。→ `.vercelignore` を作り firebase-config.js を**あえて除外しない**ことで本番に届ける（apiKeyは公開前提・守りはFirestoreルール）。

---

## 罠⑥ ツールの偽成功（Write/commitが「成功」なのに実は空）

**症状**: Bash/Write出力の空返り・二重化・文字列混入（「Restored session」等）・**Writeやcommitの偽成功**。根本原因はmacOSのzshセッション復元機能（コードのバグではない）。

**対策**: `~/.zshenv` に `export SHELL_SESSIONS_DISABLE=1`（対策済み）。再発時:
```bash
zsh -i -c 'echo x'    # 「Restored/Saving session」ゴミが出ないか確認。出れば .zshenv が効いていない
```
- 重要な書き込み後は `git status` / `ls` / `wc -l` など**短い出力で実物を数えて裏を取る**。
- Write不調時は heredoc（`cat > file <<'EOF' … EOF`）で代替。
- commit前は `git diff --cached --name-only` で確認、`git add -A` は使わない。

---

## 未修正のTODO（このプレイブック由来）

- **release-check.mjs の HTTP判定が 3xx をOK扱い** → SSO壁(302)を見逃す。`< 400` を `< 300` にするか、location が `sso-api` を含む場合はNGにする修正が望ましい（要・Kei確認のうえ実施）。
