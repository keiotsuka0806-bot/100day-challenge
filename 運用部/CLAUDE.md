# CLAUDE.md — 運用部

## 役割

QA部がGOを出したプロジェクトをデプロイし、稼働状況を記録する。

## Step 0: Shared Context

運用部の役割は、`共有可能な成果を確実に出し、学びを壊さず残す` こと。

優先順位は次の順に扱う。

1. 学びが残る状態でデプロイ・記録する
2. 1日あたり1プロジェクトの共有可能な成果を確実に出す
3. 混入や事故を防ぎ、作業ツリーを清潔に保つ

運用部は最終出力だけでなく、`project-registry`、日次レポート、automation report を通じて組織の現在地を記録する。

## デプロイ手順

### 標準デプロイ（Vanilla JS プロジェクト）

```bash
# 1. プロジェクトディレクトリに移動
cd 開発部/[project-name]

# 2. Firebaseプロジェクトを確認
cat .firebaserc   # "default" が正しいプロジェクトIDか確認

# 3. ローカルプレビュー（任意）
firebase serve --only hosting

# 4. 本番デプロイ
firebase deploy --only hosting
```

### React/Vite プロジェクトのデプロイ

```bash
cd 開発部/[project-name]
npm run build
firebase deploy --only hosting
```

## デプロイ後の確認

1. デプロイ完了URLにアクセスして動作確認
2. ログイン機能が動くか確認
3. 主要機能を1通り操作する
4. Genius Council を実行する
5. Genius Council の3ループ改善を反映する
6. 変更があれば再デプロイする
7. Release Check を実行する
8. 必要なら Visual Smoke Check を実行する

## Genius Council 必須ルール

本番デプロイ後は、全プロジェクトで以下を実行する。

```bash
cd /Users/kei/dev/100day-challenge
node 運用部/scripts/post-deploy-genius-cycle.mjs --project 開発部/[project-name] --url [production-url]
```

このスクリプトは、プロジェクト内容から適切な天才プロ集団を自動選定し、3ループ改善チケットを `デザイン部/reports/` に保存する。
同時に、実作業に分解した共通タスクカードを `運用部/tasks/[project-name]/GC-L1.md`、`GC-L2.md`、`GC-L3.md` に保存する。これはLexWorld専用ではなく、全プロジェクト共通の作業カード置き場。各カードには `Open / Doing / Done / Skipped` の状態と、変更ファイル・確認コマンド・公開URL確認の証拠欄を持たせる。

運用部はレポートを読んで、実装可能な改善を3回反映する。変更を入れた場合は再デプロイし、公開URLでHTTP 200と主要ファイルの反映を確認する。

### Project Registry

全プロジェクトの状態は `運用部/project-registry.json` を正本にする。

新しいプロジェクトを追加・移動した後は、以下で一覧を同期する。

```bash
cd /Users/kei/dev/100day-challenge
node 運用部/scripts/sync-project-registry.mjs
```

自動判定が合わないプロジェクトは、`運用部/council-overrides.json` の対象プロジェクトに以下を設定して上書きする。`project-registry.json` は自動更新される正本なので、人間の判断は混ぜない。

```json
{
  "projects": {
    "lexworld": {
      "typeOverride": "game",
      "councilOverride": "Game Master Council"
    }
  }
}
```

Genius Council実行時に、以下が自動更新される。

- status
- url
- type
- council
- lastDeploy
- lastCouncil
- councilReport
- lastVerifiedAt
- lastHttpStatus
- lastPublicUrl
- lastVisualCheckAt
- lastVisualCheck

### Release Check

共有可能ステータスへ進める前に、以下を実行する。

```bash
cd /Users/kei/dev/100day-challenge
node 運用部/scripts/release-check.mjs --project [project-name]
```

このチェックが落ちた場合は `要修正`、通った場合は `共有可能` に進め、`運用部/reports/YYYY-MM-DD.md` へRelease Check結果と共有可能プロジェクト一覧を自動追記し、`広報部/handoff/[project-name]-YYYY-MM-DD.md` を生成する。
チェックが落ちた場合は `運用部/tasks/[project-name]/release-fix.md` を生成し、次に直す項目を明示する。
共有可能判定には、GC-L1/L2/L3の品質スコア合計12点以上も必要。

全URLありプロジェクトをまとめて確認する場合は、以下を実行する。

```bash
node 運用部/scripts/release-check-all.mjs --visual
```

状態遷移は以下に固定する。

`開発中 -> デプロイ済み -> デプロイ後改善中 -> 共有可能`

Release Check失敗時は `要修正` に落とす。修正後にRelease Checkが通れば `共有可能` に戻す。

### Visual Smoke Check

公開画面の最低限の実表示確認が必要な場合は、Release Checkに統合して以下を実行する。

```bash
cd /Users/kei/dev/100day-challenge
node 運用部/scripts/release-check.mjs --project [project-name] --visual
```

単独で確認する場合は `node 運用部/scripts/visual-smoke-check.mjs --url [production-url] --project [project-name]` を使う。Playwrightが利用できる環境ではモバイルスクリーンショットを `スクリーンショット/YYYY-MM-DD/` に保存する。利用できない場合はHTML取得による簡易確認にフォールバックする。

### Council Task Update

Councilタスクの状態や証拠欄を手で編集せず更新する場合は、以下を使う。

```bash
node 運用部/scripts/update-council-task.mjs --project [project-name] --ticket GC-L2 --status Done --file 開発部/[project-name]/app.js --command "npm run check" --url-check "HTTP 200"
```

### デプロイ完了条件

以下を満たすまで「共有完了」と言わない。

- 本番URLがHTTP 200
- QA部の最低限チェックが通っている
- Genius Council レポートが生成されている
- 3ループ分の改善または改善不要判断が記録されている
- 各GCタスクに変更ファイル・確認コマンド・公開URL確認の証拠が記録されている
- `release-check.mjs` が通っている
- 必要に応じて `release-check.mjs --visual` が通っている
- 変更後の公開URLが再確認済み

## Git Hygiene

自動ルーティンや手動整理の前後に、以下を実行して作業ツリーの混入を確認する。

```bash
cd /Users/kei/dev/100day-challenge
運用部/scripts/git-hygiene-check.sh
```

ローカルの `.git/hooks/pre-commit` からも同じチェックを呼び出す。止める対象は `.DS_Store`、`.agents/`、`.firebase/`、Claude runtime lock、`企画部/specs/運用部/` に迷い込んだログ、想定外の `.log` など。

### Autosave Scope Guard

`autosave:` コミットは `.git/hooks/prepare-commit-msg` から `運用部/scripts/autosave-scope-check.sh` を実行する。ステージ済みファイルが複数スコープにまたがる場合はコミットを止める。`開発部/` 配下は `開発部/[project]` 単位、それ以外はトップレベル部署単位で判定する。

hookを入れ直す場合は以下を実行する。

```bash
運用部/scripts/install-git-hooks.sh
```

## Automation Worktrees

自動で `git commit` / `git push` する朝ルーティンは、メイン作業ツリーではなく `/Users/kei/dev/.automation-worktrees/100day-challenge/` 配下の専用 worktree で実行する。

各ルーティンは最初に `運用部/scripts/run-in-automation-worktree.sh` へ自己委譲する。これにより、Keiの手元作業がメイン worktree に残っていても、AIルーティンは専用ブランチ `automation/[routine]` 上で clean tree から始める。

automation worktree から main に反映する場合、push は `運用部/scripts/automation-push-main.sh [routine]` を使う。通常の `git push` や `git push origin main` は使わない。

### Routine Ownership

各ルーティンは commit 前に `運用部/scripts/automation-ownership-check.sh` で担当範囲を検査する。`AUTOMATION_ROUTINE` が設定された automation worktree では、pre-commit から自動実行される。

| Routine | 触ってよい範囲 |
|---|---|
| `kikakubu` | `企画部/specs/*-idea*.md`, `企画部/research/*.md`, `企画部/IDEA_LOG.md` |
| `org-report` | `運用部/reports/org-improvement-*.md`, `運用部/org-improvement/*.md` |
| `retrospective` | `記憶庫/lessons.md`, `記憶庫/reusable-patterns.md`, `記憶庫/decisions.md` |
| `job-scout` | `運用部/reports/job-scout-*.md`, `運用部/job-scout/seen-jobs.json` |

### Automation Report

`run-in-automation-worktree.sh` は各実行後に `運用部/reports/automation-YYYY-MM-DD.md` へ、exit code、worktree、before/after commit、作業ツリー状態、ログパスを追記する。朝の確認ではまずこのファイルを見る。

### Organization Health Check

組織の定点観測は `運用部/scripts/organization-health-check.sh` で行う。`運用部/reports/organization-health-YYYY-MM-DD.md` を出力し、`共有可能` の数、`要修正` の数、今日の学び、混入リスク、次の1手を固定で記録する。

### Push Conflict Handling

`automation-push-main.sh` は `origin/main` を fetch して rebase してから `HEAD:main` へpushする。push reject時はもう一度 fetch/rebase/push を試す。rebase conflict または retry失敗時は `運用部/reports/automation-YYYY-MM-DD.md` と `運用部/logs/automation-push-[routine].log` に状態を残して停止する。

## 日次レポート形式

「日報更新して」と言われたら、以下の3ファイルをすべて作成・更新する。

| ファイル | パス |
|---|---|
| Daily Control Sheet | `運用部/daily/YYYY-MM-DD.md` |
| Obsidian 日報（100日チャレンジ） | `/Users/kei/Documents/Kei/100 Day Challenge/日報/YYYY-MM-DD.md` |
| Obsidian 日報（root） | `/Users/kei/Documents/Kei/日報/YYYY-MM-DD.md` |

Obsidian の root 日報は `100 Day Challenge/日報/` と同じ内容をコピーする。

`reports/YYYY-MM-DD.md` に以下の形式で保存する:

```markdown
# 運用日報 YYYY-MM-DD

## デプロイ記録
| 時刻 | プロジェクト | バージョン | URL | ステータス |
|------|------------|----------|-----|---------|
| HH:MM | [name] | - | https://xxx.web.app | 成功/失敗 |

## 稼働中プロジェクト
| プロジェクト | URL | 状態 |
|-------------|-----|------|
| WhiskyNote | https://whisky-note-e137d.web.app | 正常 |

## Genius Council
| プロジェクト | Council | チケット | 実装結果 | 状態 |
|-------------|---------|----------|----------|------|
| [name] | [Game Master Council等] | GC-L1 / GC-L2 / GC-L3 | [実装内容または見送り理由] | 完了/対応中 |

## 特記事項
- [問題があれば記録]
```

## Firebaseプロジェクト一覧

| プロジェクト | Firebase Project ID | URL |
|-------------|-------------------|-----|
| WhiskyNote | `whisky-note-e137d` | https://whisky-note-e137d.web.app |

> 新規プロジェクトをデプロイしたらこの表を更新すること。

## トラブルシューティング

### デプロイが失敗する場合
```bash
firebase login     # 再ログイン
firebase projects:list  # プロジェクト一覧確認
```

### 本番で動かない場合
1. Firebase Hosting のキャッシュをクリア（ブラウザのスーパーリロード）
2. Firebase Console → Hosting でデプロイ履歴を確認
3. 前のバージョンにロールバック: Firebase Console → Hosting → 以前のバージョン → 再デプロイ
