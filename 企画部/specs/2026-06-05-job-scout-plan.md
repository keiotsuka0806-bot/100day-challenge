# Job Scout System 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 毎朝3時に自動起動し、ランサーズ・クラウドワークス・Upworkから新着案件を検索・スコアリングして `運用部/reports/job-scout-YYYY-MM-DD.md` に出力するScheduled Agentシステムを構築する。

**Architecture:** Claude Code Scheduled Agent が毎朝3時に起動し、WebSearchで3プラットフォームを横断検索する。スコアリングはLLMが実行（技術適合40%・予算35%・締切25%の加重平均）。既読案件はseen-jobs.jsonで管理し、新着のみをレポートに掲載する。

**Tech Stack:** Claude Code Scheduled Agent, WebSearch tool, Read/Write tools, JSON (seen-jobs.json), Markdown レポート

---

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `運用部/job-scout/seen-jobs.json` | 既読案件URLの累積リスト（差分管理の核） |
| `運用部/job-scout/search-config.md` | 検索キーワード・除外ワード・スコア設定（手動編集可） |
| `運用部/job-scout/AGENT-PROMPT.md` | Scheduled Agentへの実行指示（scheduleに渡すプロンプト） |
| `運用部/reports/job-scout-YYYY-MM-DD.md` | 毎朝3時に生成される日次レポート |

---

## Task 1: 既読管理ファイルを初期化する

**Files:**
- Create: `運用部/job-scout/seen-jobs.json`

- [ ] `運用部/job-scout/` ディレクトリを作成する

  ```bash
  mkdir -p "/Users/kei/Library/Mobile Documents/com~apple~CloudDocs/Claude code/＃100Day Challenge/運用部/job-scout"
  ```

- [ ] `seen-jobs.json` を初期状態で作成する（Writeツール使用）

  ```json
  {
    "seen": [],
    "last_updated": "2026-06-05"
  }
  ```

  保存先: `運用部/job-scout/seen-jobs.json`

- [ ] コミット

  ```bash
  git add "運用部/job-scout/seen-jobs.json"
  git commit -m "feat: job-scout seen-jobs.json を初期化"
  ```

---

## Task 2: 検索設定ファイルを作成する

**Files:**
- Create: `運用部/job-scout/search-config.md`

- [ ] 以下の内容で `search-config.md` を作成する（Writeツール使用）

  ```markdown
  # Job Scout 検索設定

  ## マッチキーワード（OR）

  ### 日本語プラットフォーム（ランサーズ・クラウドワークス）
  Firebase, Firestore, React, Next.js, PWA, Vanilla JS,
  Webアプリ開発, Webサービス開発, ランディングページ, LP制作,
  MVP開発, プロトタイプ開発

  ### Upwork（英語）
  Firebase developer, React developer, PWA development,
  JavaScript web app, Landing page React, MVP web application,
  Frontend developer Firebase

  ## 除外キーワード
  WordPress, Unity, Unreal, iOS開発, Android開発, 運用のみ, 保守のみ

  ## スコアリング重み
  - 技術適合度: 40%
  - 予算: 35%
  - 締切余裕: 25%

  ## 掲載最低スコア
  3.5
  ```

  保存先: `運用部/job-scout/search-config.md`

- [ ] コミット

  ```bash
  git add "運用部/job-scout/search-config.md"
  git commit -m "feat: job-scout 検索設定ファイルを作成"
  ```

---

## Task 3: Scheduled Agent のプロンプトファイルを作成する

**Files:**
- Create: `運用部/job-scout/AGENT-PROMPT.md`

これが毎朝3時にScheduled Agentが受け取る実行指示。このファイルの内容がシステム全体の動作を決定する。

- [ ] 以下の内容で `AGENT-PROMPT.md` を作成する（Writeツール使用）

  ````markdown
  # Job Scout Agent — 毎朝3時自動実行

  ## 目的
  ランサーズ・クラウドワークス・Upworkから新着の受注案件を検索し、スコアリングして日次レポートを生成する。

  ## Step 1: 設定と既読リストを読み込む

  以下の2ファイルをReadツールで読み込む:
  - `/Users/kei/Library/Mobile Documents/com~apple~CloudDocs/Claude code/＃100Day Challenge/運用部/job-scout/search-config.md`
  - `/Users/kei/Library/Mobile Documents/com~apple~CloudDocs/Claude code/＃100Day Challenge/運用部/job-scout/seen-jobs.json`

  `seen` 配列に含まれるURLを「既読リスト」として記憶する。

  ## Step 2: 各プラットフォームをWebSearchで検索する

  以下の6クエリをWebSearchで順番に実行する:

  1. `site:lancers.jp Firebase OR React OR Webアプリ 開発依頼`
  2. `site:lancers.jp "PWA" OR "Next.js" OR "LP制作" 開発`
  3. `site:crowdworks.jp Firebase OR React OR Webアプリ 開発募集`
  4. `site:crowdworks.jp "PWA" OR "Next.js" OR "ランディングページ" 開発`
  5. `site:upwork.com "Firebase developer" OR "React developer" job posted`
  6. `site:upwork.com "PWA development" OR "JavaScript web app" OR "landing page React"`

  各クエリの結果から以下を抽出する:
  - 案件タイトル
  - URL（案件ページのURL）
  - 予算（記載があれば）
  - 締切（記載があれば）
  - 概要（検索スニペットから1〜2文）

  ## Step 3: 新着のみフィルタリングする

  抽出したすべての案件について:
  - URLが `seen` 配列に含まれている → **スキップ（既読）**
  - URLが `seen` 配列にない → **新着として処理に進む**

  ## Step 4: 各案件をスコアリングする

  新着案件それぞれについて3軸でスコアを付ける（各1〜5点）。

  ### 技術適合度（重み: 40%）
  - 5点: Firebase / React / PWA が案件に明記されている
  - 4点: Next.js / JavaScript / Vite などが明記されている
  - 3点: JavaScript系だが具体的な技術が不明
  - 2点: フロントエンド全般（技術指定なし）
  - 1点: 技術ミスマッチ（Python / iOS / WordPress など）

  ### 予算（重み: 35%）
  - 5点: 10万円以上（または $700以上）
  - 4点: 5〜10万円（または $350〜700）
  - 3点: 3〜5万円（または $200〜350）
  - 2点: 1〜3万円（または $70〜200）
  - 1点: 1万円未満（または $70未満）または記載なし

  ### 締切余裕（重み: 25%）
  - 5点: 2週間以上
  - 4点: 10日〜2週間
  - 3点: 1週間〜10日
  - 2点: 3〜7日
  - 1点: 3日以内または即日または記載なし

  **総合スコア計算式:**
  `総合 = (技術適合 × 0.40) + (予算 × 0.35) + (締切 × 0.25)`

  **総合スコア 3.5未満の案件はレポートに掲載しない。**

  ## Step 5: レポートを生成する

  TODAY = 実行日の日付（YYYY-MM-DD形式）

  出力先パス:
  `/Users/kei/Library/Mobile Documents/com~apple~CloudDocs/Claude code/＃100Day Challenge/運用部/reports/job-scout-{TODAY}.md`

  ### 掲載案件がある場合のフォーマット:

  ```
  # 案件スカウト {TODAY} ── 新着 {N}件

  > スキャン: ランサーズ / クラウドワークス / Upwork | 実行: 03:00

  ## {スター} {案件タイトル}
  - プラットフォーム: {ランサーズ / クラウドワークス / Upwork}
  - 予算: {予算 or "記載なし"} | 締切: {締切 or "記載なし"}
  - スコア: 技術{X} / 予算{X} / 締切{X} = **総合 {X.X}**
  - URL: {URL}
  - 概要: {1〜2行}
  ```

  スターの対応表:
  - 4.5〜5.0 → ★★★★★
  - 4.0〜4.4 → ★★★★☆
  - 3.5〜3.9 → ★★★☆☆

  掲載順: 総合スコアの降順。

  ### 掲載案件がない場合のフォーマット:

  ```
  # 案件スカウト {TODAY} ── 新着 0件

  > スキャン: ランサーズ / クラウドワークス / Upwork | 実行: 03:00

  今日の新着案件はありません。
  ```

  Writeツールでレポートファイルを保存する。

  ## Step 6: seen-jobs.json を更新する

  今回WebSearchで取得したすべての案件URL（新着・既読の両方）を `seen` 配列に追加する。重複は除く。

  更新後のJSONを以下の形式でWriteツールで上書き保存する:

  ```json
  {
    "seen": ["url1", "url2", "...（全既読URL）"],
    "last_updated": "{TODAY}"
  }
  ```

  保存先: `/Users/kei/Library/Mobile Documents/com~apple~CloudDocs/Claude code/＃100Day Challenge/運用部/job-scout/seen-jobs.json`

  ## 完了

  レポートとseen-jobs.jsonの更新が完了したら終了する。
  ユーザーへの通知は不要（深夜3時のバックグラウンド実行のため）。
  ````

  保存先: `運用部/job-scout/AGENT-PROMPT.md`

- [ ] コミット

  ```bash
  git add "運用部/job-scout/AGENT-PROMPT.md"
  git commit -m "feat: job-scout agent プロンプトを作成"
  ```

---

## Task 4: スケジュールを登録する

- [ ] `schedule` スキルを呼び出し、以下の設定で登録する

  - **名前**: job-scout
  - **cron**: `0 3 * * *`（毎朝3時）
  - **プロンプト**: `AGENT-PROMPT.md` の内容をそのまま使用

  呼び出し方: 「job-scout agentを毎朝3時に実行するスケジュールを登録してください」と schedule スキルに渡す

- [ ] 登録後、CronListで確認する

  期待結果: `job-scout` が `0 3 * * *` で登録されている

- [ ] コミット（.claude/scheduled_tasks.json が更新されている場合）

  ```bash
  git add ".claude/scheduled_tasks.json"
  git commit -m "feat: job-scout cron 毎朝3時に登録"
  ```

---

## Task 5: 手動テスト実行で動作確認する

- [ ] `schedule` スキルの「今すぐ実行」オプション、またはAGENT-PROMPTの手順をこのセッションで手動実行する

- [ ] 以下を確認する

  | チェック | 期待結果 |
  |---------|---------|
  | レポート生成 | `運用部/reports/job-scout-YYYY-MM-DD.md` が存在する |
  | スコアリング | スコア3.5以上の案件のみ掲載されている |
  | seen更新 | `seen-jobs.json` の `seen` 配列にURLが追記されている |
  | 差分テスト | 同じプロンプトを再実行すると「新着0件」になる |

- [ ] テスト用レポートをコミット

  ```bash
  git add "運用部/reports/job-scout-"*.md "運用部/job-scout/seen-jobs.json"
  git commit -m "test: job-scout 動作確認完了"
  ```

---

## 完成の定義

- [ ] 毎朝3時にScheduled Agentが自動実行される（CronListで確認済み）
- [ ] ランサーズ・クラウドワークス・Upworkを検索してレポートを生成する
- [ ] スコア3.5以上の案件のみ掲載される
- [ ] 既読案件が翌日以降に再表示されない
- [ ] `運用部/reports/job-scout-YYYY-MM-DD.md` が毎朝届いている
