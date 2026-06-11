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
REPORT_FILE="$SOURCE_ROOT/運用部/reports/automation-$(date '+%Y-%m-%d').md"

case "$ROUTINE" in
  *[!A-Za-z0-9_-]*|"")
    echo "invalid routine name: $ROUTINE" >&2
    exit 2
    ;;
esac

mkdir -p "$WORKTREE_BASE" "$(dirname "$LOG_FILE")" "$(dirname "$REPORT_FILE")"

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

  BEFORE_COMMIT="$(git -C "$WORKTREE" rev-parse --short HEAD)"
  STARTED_AT="$(date '+%Y-%m-%d %H:%M:%S')"
  set +e
  AUTOMATION_WORKDIR="$WORKTREE" \
  AUTOMATION_SOURCE_ROOT="$SOURCE_ROOT" \
  AUTOMATION_LOG_ROOT="$LOG_ROOT" \
  AUTOMATION_ROUTINE="$ROUTINE" \
    "$WORKTREE/$SCRIPT_REL" "$@"
  EXIT_CODE="$?"
  set -e

  AFTER_COMMIT="$(git -C "$WORKTREE" rev-parse --short HEAD)"
  STATUS_SUMMARY="$(git -C "$WORKTREE" status --short | sed 's/^/  /')"
  [ -n "$STATUS_SUMMARY" ] || STATUS_SUMMARY="  clean"

  {
    if [ ! -f "$REPORT_FILE" ]; then
      echo "# Automation Report $(date '+%Y-%m-%d')"
      echo
    fi
    echo "## $ROUTINE — $(date '+%H:%M:%S')"
    echo "- started: $STARTED_AT"
    echo "- exit_code: $EXIT_CODE"
    echo "- worktree: $WORKTREE"
    echo "- branch: $BRANCH"
    echo "- commit_before: $BEFORE_COMMIT"
    echo "- commit_after: $AFTER_COMMIT"
    echo "- status:"
    echo "$STATUS_SUMMARY"
    echo "- log: $LOG_FILE"
    echo
  } >> "$REPORT_FILE"

  if [ "$EXIT_CODE" -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] worktree runner failed: $ROUTINE exit=$EXIT_CODE"
    exit "$EXIT_CODE"
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] worktree runner complete: $ROUTINE"
} >> "$LOG_FILE" 2>&1
