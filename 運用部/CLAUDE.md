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

## Morning Routine（朝会）

旧・夜間自動ルーティン4本（kikakubu / org-report / retrospective / job-scout）は、2026-06-15のAnthropic課金変更（ヘッドレス実行・Agent SDK等が月次クレジット制になる）に伴い **2026-06-11に全廃** した。同じ業務は `.claude/skills/morning-routine/SKILL.md`（朝会スキル）に統合済みで、Claude Codeの対話セッション（課金枠の対象外）で実行する。

運用方法: 朝、Claude Codeを開いて「朝会して」と言う。1セッションで以下を順に実行する。

1. 記憶庫レトロスペクティブ（昨日分）
2. 企画部 今日の企画10案
3. 組織改善レポート
4. Job Scout
5. スコープ単位のcommit & push

### 旧体制の痕跡と復元方法

- **クラウドルーティン6本**（claude.ai/code/routines のスケジュールエージェント: 企画部アイデア生成 / Daily Org Improvement Report / 夜の自動Retrospective / job-scout / 夜間リサーチエージェント / nightly-tech-research-kikakubu）は 2026-06-11 に全て無効化済み。設定とプロンプトは https://claude.ai/code/routines に残っており、再有効化すれば復活する
- launchd plist 4件は `~/Library/LaunchAgents.disabled/` に退避済み（`com.100daychallenge.*`）。戻せば自動実行が復活するが、6/15以降はクレジットを消費する
- `運用部/scripts/routine-*.sh`、`run-in-automation-worktree.sh`、`automation-push-main.sh`、`automation-ownership-check.sh` は記録として残しているが **現在は未使用**
- automation worktree（`/Users/kei/dev/.automation-worktrees/`）と `automation/*` ブランチは削除済み（未マージのコミットは無かった）
- 経緯の詳細は `記憶庫/decisions.md` の 2026-06-11 エントリを参照

### Organization Health Check

組織の定点観測は `運用部/scripts/organization-health-check.sh` で行う。`運用部/reports/organization-health-YYYY-MM-DD.md` を出力し、`共有可能` の数、`要修正` の数、今日の学び、混入リスク、次の1手を固定で記録する。

## 日次レポート形式

「日報更新して」と言われたら、以下を**同時に**一括で行う。

1. その日の運用日報を作成・更新する
2. Obsidian の **3フォルダすべて** を更新する（どれか1つでも欠けてはいけない）
3. その日に変化したプロジェクトがあれば `project-registry.json` と Obsidian のプロジェクトノートも更新する

| ファイル | パス |
|---|---|
| Daily Control Sheet | `運用部/daily/YYYY-MM-DD.md` |
| Obsidian 100日チャレンジ日報 | `/Users/kei/Documents/Kei/100 Day Challenge/100日チャレンジ日報/YYYY-MM-DD.md` |
| Obsidian 日報 | `/Users/kei/Documents/Kei/100 Day Challenge/日報/YYYY-MM-DD.md` |
| Obsidian プロジェクトノート | `/Users/kei/Documents/Kei/100 Day Challenge/プロジェクト/Day N [Project].md` |

`100日チャレンジ日報/` と `日報/` は同じ内容でよい。

### Obsidian 日報のフォーマット（必須）

必ず過去ファイル（`日報/YYYY-MM-DD.md` の直近ファイル）を読んでから書く。

```markdown
## 日報

### 今日の一言
[1〜2文]

---

### 今日の成果
[プロジェクト1件につき以下の表を1つ。複数あれば並べる]

| 項目 | 内容 |
| --- | --- |
| 本日の選定 | [プロジェクト名] |
| 完成物 | [説明] |
| URL | https://... |
| 状態 | デプロイ済み / 開発中 |
| 主な技術 | [スタック] |

---

### 今日の流れ
1. ...

---

### 開発部
**[プロジェクト名]** ✅/🟡 [一言ステータス]
[説明]
#### 実装済み機能
| 機能 | 状態 |
| --- | --- |
| ... | ✅ |   ← ✅ を使う。「完了」は使わない

---

### 運用部
- [デプロイ・設定変更の箇条書き]

---

### 今日の学び
- [箇条書き]

---

### 途中プロジェクト
| プロジェクト | 場所 | 状態 | 次に見ること |
| --- | --- | --- | --- |

---

### Next Action
- [ ] ...
```

### Obsidian プロジェクトノートのフォーマット（必須）

- **デプロイ済みプロジェクト** → `Day N [ProjectName].md`（N は通し番号。デプロイされるたびに増やす）
- **構想・企画段階** → `企画 [ProjectName].md`（Day 番号はつけない）

```markdown
# Day N [ProjectName]

## 概要
## 実装場所
## 共有URL
## 実装したこと
[✅ テーブル]
## 今日の判断
[箇条書き]
## 確認
[箇条書き]
## 次の改善候補
[箇条書き]
```

`日報更新` に含まれる「プロジェクト更新」は、次のどれかを指す。

- `運用部/project-registry.json` の status / url / lastDeploy / lastCouncil / lastReleaseCheck を更新する
- 変更のあったプロジェクトの `SHARE.md` や運用メモがあれば更新する
- 対応する Obsidian のプロジェクトノートを更新する
- 共有可能になったプロジェクトがあれば日報の「稼働中プロジェクト」と `project-registry.json` を一致させる

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
