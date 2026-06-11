# Git未コミット整理メモ 2026-06-05

## 現状

未コミット・未追跡ファイルが多く、複数日の作業が混在している。

この状態で一括コミットすると、後から「どの変更が何のためだったか」を追いにくくなる。自走組織としては、変更を意味のある単位に分けてコミットする。

## 推奨コミット単位

### 1. 企画部ルール修正

対象:
- `企画部/CLAUDE.md`

内容:
- 「おはよう」時の企画10案出力をMarkdownテーブル形式に固定
- 企画部の一押しを必須化

推奨コミットメッセージ:

```text
企画部: 10案報告フォーマットを表形式に固定
```

### 2. FoodScore運用記録

対象:
- `運用部/日報/2026-06-05.md`
- `運用部/daily/2026-06-05.md`
- `QA部/review-2026-06-05.md`
- `広報部/drafts/2026-06-05-food-score.md`
- `広報部/reports/2026-06-05.md`

内容:
- FoodScore実装・デプロイ完了を日報へ反映
- Daily Control Sheet作成
- QAレビュー作成
- 広報ドラフトとX案作成

推奨コミットメッセージ:

```text
運用部: FoodScoreの記録・QA・広報ドラフトを整備
```

### 3. 記憶庫更新

対象:
- `記憶庫/lessons.md`
- `記憶庫/reusable-patterns.md`
- `記憶庫/decisions.md`

内容:
- FoodScoreから得た学びを記録
- AI画像採点アプリパターンを追加
- Daily Control Sheet導入判断を記録

推奨コミットメッセージ:

```text
記憶庫: FoodScoreの学びと再利用パターンを追加
```

### 4. 既存プロジェクト群

対象候補:
- `開発部/food-score/`
- `開発部/mini-kanban/`
- `開発部/quote-court/`
- `開発部/wine-board-game/`
- `開発部/whisky-note/manifest.json`
- `開発部/whisky-note/sw.js`

内容:
- 各アプリ本体やPWA対応ファイル

注意:
- これは今回の整理作業より前の成果物も含むため、プロジェクト単位で中身を確認してからコミットする。

### 5. 自動化・社内システム

対象候補:
- `.claude/`
- `.agents/`
- `運用部/scripts/`
- `skills-lock.json`
- `CLAUDE.md`
- `運用部/CLAUDE.md`
- `開発部/CLAUDE.md`

内容:
- スケジュールタスク、Hooks、スキル、部署ルール

注意:
- `.claude/scheduled_tasks.lock` が削除状態になっているため、削除が意図通りか確認してからコミットする。

### 6. 画像・検証成果物

対象候補:
- `food-score-initial.png`
- `food-score-main.png`
- `food-score-results.png`
- `food-score-results2.png`
- `lobby.png`
- `.playwright-mcp/`

内容:
- スクリーンショット、Playwright検証ログ

注意:
- `.playwright-mcp/` はログが多いため、必要なスクリーンショットだけ残すか、`.gitignore`対象にするか決める。

## 次にやること

1. まず上記1〜3だけをコミットする
2. 次にプロジェクト単位で `開発部/food-score/` などを確認してコミットする
3. 最後に `.claude/`・`.agents/`・`.playwright-mcp/` の扱いを決める

## 判断

今日の安全な最小コミット範囲は、企画部ルール・FoodScore運用記録・記憶庫更新の3つ。  
既存プロジェクト本体や自動化ファイルは、変更量が大きいため別コミットに分ける。
