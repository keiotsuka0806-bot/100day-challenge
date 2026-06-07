#!/bin/bash
# Push an automation worktree commit to main with conflict reporting.

set -euo pipefail

ROUTINE="${1:-${AUTOMATION_ROUTINE:-unknown}}"
SOURCE_ROOT="${AUTOMATION_SOURCE_ROOT:-/Users/kei/dev/100day-challenge}"
REPORT_FILE="$SOURCE_ROOT/運用部/reports/automation-$(date '+%Y-%m-%d').md"
LOG_FILE="$SOURCE_ROOT/運用部/logs/automation-push-$ROUTINE.log"

mkdir -p "$(dirname "$REPORT_FILE")" "$(dirname "$LOG_FILE")"

report_failure() {
  reason="$1"
  {
    if [ ! -f "$REPORT_FILE" ]; then
      echo "# Automation Report $(date '+%Y-%m-%d')"
      echo
    fi
    echo "## push failure: $ROUTINE — $(date '+%H:%M:%S')"
    echo "- reason: $reason"
    echo "- worktree: $(pwd)"
    echo "- branch: $(git branch --show-current)"
    echo "- head: $(git rev-parse --short HEAD)"
    echo "- status:"
    git status --short | sed 's/^/  /'
    echo "- log: $LOG_FILE"
    echo
  } >> "$REPORT_FILE"
}

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] automation push start: $ROUTINE"

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "working tree is not clean before push" >&2
    report_failure "dirty tree before push"
    exit 1
  fi

  if ! git fetch origin main; then
    echo "fetch failed before push" >&2
    report_failure "fetch origin/main failed"
    exit 1
  fi

  if ! git rebase origin/main; then
    echo "rebase conflict while updating from origin/main" >&2
    report_failure "rebase conflict with origin/main"
    git rebase --abort || true
    exit 1
  fi

  if git push origin HEAD:main; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] automation push complete: $ROUTINE"
    exit 0
  fi

  echo "first push failed; retrying after fetch/rebase" >&2
  if ! git fetch origin main; then
    echo "retry fetch failed before push" >&2
    report_failure "retry fetch origin/main failed"
    exit 1
  fi
  if ! git rebase origin/main; then
    echo "retry rebase conflict while updating from origin/main" >&2
    report_failure "retry rebase conflict with origin/main"
    git rebase --abort || true
    exit 1
  fi

  if ! git push origin HEAD:main; then
    echo "retry push failed" >&2
    report_failure "push rejected after retry"
    exit 1
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] automation push complete after retry: $ROUTINE"
} >> "$LOG_FILE" 2>&1
