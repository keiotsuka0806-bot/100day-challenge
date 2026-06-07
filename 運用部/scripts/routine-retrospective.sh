#!/bin/bash
# 夜の自動Retrospective — 毎朝3:23に実行

if [ -z "${AUTOMATION_WORKDIR:-}" ]; then
  exec /Users/kei/dev/100day-challenge/運用部/scripts/run-in-automation-worktree.sh retrospective 運用部/scripts/routine-retrospective.sh "$@"
fi

WORKDIR="${AUTOMATION_WORKDIR:-/Users/kei/dev/100day-challenge}"
LOGROOT="${AUTOMATION_LOG_ROOT:-$WORKDIR}"
LOGFILE="$LOGROOT/運用部/logs/routine-retrospective.log"
CLAUDE="/Users/kei/.local/bin/claude"
HYGIENE="$WORKDIR/運用部/scripts/git-hygiene-check.sh"

mkdir -p "$(dirname "$LOGFILE")"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 自動Retrospective 開始" >> "$LOGFILE"

cd "$WORKDIR" || exit 1

if ! "$HYGIENE" --strict >> "$LOGFILE" 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 自動Retrospective 中止: git hygiene check failed" >> "$LOGFILE"
  exit 1
fi

"$CLAUDE" --print --permission-mode bypassPermissions -p "あなたは#100Day Challenge の記憶係です。昨日の開発活動から学びを抽出して記憶庫に自動保存してください。

## Step 1: 昨日の活動を把握
1. git log --oneline --since='yesterday 00:00' --until='today 00:00' で昨日のコミットを確認
2. 運用部/sessions/YYYY-MM-DD.md（昨日の日付）を読む
3. QA部/review-YYYY-MM-DD.md（昨日の日付）があれば読む

昨日のコミットが0件かつセッションログも空の場合は終了してください。

## Step 2: 学びを3種類に分類して抽出
- 技術的ハマりポイント: 実装で詰まった箇所と解決方法
- 再利用できるパターン: 今後も使えるコードパターン・設計
- 意思決定の記録: 技術選定の理由・却下した選択肢

## Step 3: 記憶庫ファイルを更新（学びがあった場合のみ）
- 記憶庫/lessons.md → 技術的ハマりポイントを追記
- 記憶庫/reusable-patterns.md → 再利用パターンを追記
- 記憶庫/decisions.md → 意思決定を追記

追記フォーマット：
## YYYY-MM-DD: [プロジェクト名]
[学びの内容を簡潔に]

## Step 4: GitHubにpush（更新があった場合のみ）
git add 記憶庫/ して git commit すること。
このルーティンは専用automation worktreeで動くため、pushは必ず git push origin HEAD:main を使うこと。" >> "$LOGFILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 自動Retrospective 完了" >> "$LOGFILE"
