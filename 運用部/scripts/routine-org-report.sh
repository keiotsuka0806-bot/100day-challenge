#!/bin/bash
# Daily Org Improvement Report — 毎朝3:13に実行

WORKDIR="/Users/kei/dev/100day-challenge"
LOGFILE="$WORKDIR/運用部/logs/routine-org-report.log"
CLAUDE="/Users/kei/.local/bin/claude"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 組織改善レポート 開始" >> "$LOGFILE"

cd "$WORKDIR"

"$CLAUDE" --print --permission-mode bypassPermissions -p "あなたは#100Day Challenge の外部コンサルタントです。天才コンサルタント視点で組織を分析し、改善レポートを作成してください。

## Step 1: 現状把握
1. git log --oneline -20 で直近の開発活動を把握
2. 運用部/sessions/ の最新セッションログを読む
3. QA部/ の直近レビューファイルを確認
4. CLAUDE.md のプロジェクト一覧で稼働状況を把握

## Step 2: 天才コンサルタント視点で分析
- スピード・リズム: 1日1プロジェクトのペースは維持されているか
- 品質トレンド: QAで繰り返し指摘されている問題パターン
- 技術的観察: スタック選択の最適性・再利用できているか
- 組織の健全性: 各部署が機能しているか・自動化の状況
- 明日への具体的アクション: 1〜3個の即実行可能な改善策

## Step 3: レポートを保存
今日の日付で 運用部/reports/org-improvement-YYYY-MM-DD.md に保存。

フォーマット：
# 組織改善レポート YYYY-MM-DD
## エグゼクティブサマリー
## 分析結果
### スピード・リズム
### 品質トレンド
### 技術的観察
### 組織の健全性
## 明日のアクションアイテム

## Step 4: GitHubにpush
git add して git commit して git push すること。" >> "$LOGFILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 組織改善レポート 完了" >> "$LOGFILE"
