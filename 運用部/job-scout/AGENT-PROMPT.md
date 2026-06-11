# Job Scout Agent — 毎朝3時自動実行

## 前提
このAgentは `https://github.com/keiotsuka0806-bot/100day-challenge` のgitチェックアウト上で動く。
作業ディレクトリ = リポジトリルート。すべてのパスはリポジトリルートからの相対パスを使う。

## 目的
ランサーズ・クラウドワークス・Upworkから新着の受注案件を検索し、スコアリングして日次レポートを生成する。

## Step 1: 設定と既読リストを読み込む

以下の2ファイルをReadツールで読み込む:
- `運用部/job-scout/search-config.md`
- `運用部/job-scout/seen-jobs.json`

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

TODAY = Bashで `date +%Y-%m-%d` を実行して取得した日付（YYYY-MM-DD形式）

出力先パス（リポジトリルートからの相対パス）:
`運用部/reports/job-scout-{TODAY}.md`

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

保存先: `運用部/job-scout/seen-jobs.json`

## Step 7: 変更をGitにコミットしてpushする

以下のBashコマンドを順番に実行して、生成したファイルをリポジトリに保存する:

```bash
git config user.email "job-scout-agent@100day-challenge"
git config user.name "Job Scout Agent"
git add "運用部/reports/job-scout-$(date +%Y-%m-%d).md" "運用部/job-scout/seen-jobs.json"
git commit -m "chore: job-scout レポート $(date +%Y-%m-%d)"
運用部/scripts/automation-push-main.sh job-scout
```

## 完了

automation-push-main.sh が完了したら終了する。
ユーザーへの通知は不要（深夜3時のバックグラウンド実行のため）。
