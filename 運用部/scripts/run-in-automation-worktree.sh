#!/bin/bash
# Run an automation routine in an isolated git worktree.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: run-in-automation-worktree.sh <routine-name> <script-relative-path> [args...]" >&2
  exit 2
fi

ROUTINE="$1"
SCRIPT_REL="$2"
shift 2

SOURCE_ROOT="/Users/kei/dev/100day-challenge"
WORKTREE_BASE="/Users/kei/dev/.automation-worktrees/100day-challenge"
WORKTREE="$WORKTREE_BASE/$ROUTINE"
BRANCH="automation/$ROUTINE"
LOG_ROOT="$SOURCE_ROOT"
LOG_FILE="$SOURCE_ROOT/運用部/logs/automation-worktree-$ROUTINE.log"

case "$ROUTINE" in
  *[!A-Za-z0-9_-]*|"")
    echo "invalid routine name: $ROUTINE" >&2
    exit 2
    ;;
esac

mkdir -p "$WORKTREE_BASE" "$(dirname "$LOG_FILE")"

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] worktree runner start: $ROUTINE"

  cd "$SOURCE_ROOT"

  if [ ! -d "$WORKTREE/.git" ]; then
    git worktree add -B "$BRANCH" "$WORKTREE" main
  else
    "$WORKTREE/運用部/scripts/git-hygiene-check.sh" --strict
    git -C "$WORKTREE" merge --ff-only main
  fi

  if [ ! -x "$WORKTREE/$SCRIPT_REL" ]; then
    chmod +x "$WORKTREE/$SCRIPT_REL"
  fi

  AUTOMATION_WORKDIR="$WORKTREE" \
  AUTOMATION_SOURCE_ROOT="$SOURCE_ROOT" \
  AUTOMATION_LOG_ROOT="$LOG_ROOT" \
    "$WORKTREE/$SCRIPT_REL" "$@"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] worktree runner complete: $ROUTINE"
} >> "$LOG_FILE" 2>&1
