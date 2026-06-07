#!/bin/bash
# Job Scout — 毎朝3:33に実行

WORKDIR="/Users/kei/dev/100day-challenge"
LOGFILE="$WORKDIR/運用部/logs/routine-job-scout.log"
CLAUDE="/Users/kei/.local/bin/claude"
PROMPT_FILE="$WORKDIR/運用部/job-scout/AGENT-PROMPT.md"

mkdir -p "$(dirname "$LOGFILE")"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Job Scout 開始" >> "$LOGFILE"

cd "$WORKDIR" || exit 1

"$CLAUDE" --print --permission-mode bypassPermissions -p "$(cat "$PROMPT_FILE")" >> "$LOGFILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Job Scout 完了" >> "$LOGFILE"
