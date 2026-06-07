#!/bin/bash
# Job Scout — 毎朝3:33に実行

if [ -z "${AUTOMATION_WORKDIR:-}" ]; then
  exec /Users/kei/dev/100day-challenge/運用部/scripts/run-in-automation-worktree.sh job-scout 運用部/scripts/routine-job-scout.sh "$@"
fi

WORKDIR="${AUTOMATION_WORKDIR:-/Users/kei/dev/100day-challenge}"
LOGROOT="${AUTOMATION_LOG_ROOT:-$WORKDIR}"
LOGFILE="$LOGROOT/運用部/logs/routine-job-scout.log"
CLAUDE="/Users/kei/.local/bin/claude"
PROMPT_FILE="$WORKDIR/運用部/job-scout/AGENT-PROMPT.md"
HYGIENE="$WORKDIR/運用部/scripts/git-hygiene-check.sh"

mkdir -p "$(dirname "$LOGFILE")"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Job Scout 開始" >> "$LOGFILE"

cd "$WORKDIR" || exit 1

if ! "$HYGIENE" --strict >> "$LOGFILE" 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Job Scout 中止: git hygiene check failed" >> "$LOGFILE"
  exit 1
fi

"$CLAUDE" --print --permission-mode bypassPermissions -p "$(cat "$PROMPT_FILE")" >> "$LOGFILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Job Scout 完了" >> "$LOGFILE"
