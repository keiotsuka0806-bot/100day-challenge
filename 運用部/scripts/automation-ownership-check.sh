#!/bin/bash
# Enforce file ownership boundaries for automation routines.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: automation-ownership-check.sh <routine> [--staged]" >&2
  exit 2
fi

ROUTINE="$1"
MODE="${2:-}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

case "$MODE" in
  ""|--staged)
    ;;
  *)
    echo "unknown mode: $MODE" >&2
    exit 2
    ;;
esac

allowed() {
  path="$1"

  case "$ROUTINE:$path" in
    kikakubu:企画部/specs/*-idea*.md|\
    kikakubu:企画部/research/*.md|\
    kikakubu:企画部/IDEA_LOG.md)
      return 0
      ;;
    org-report:運用部/reports/org-improvement-*.md|\
    org-report:運用部/org-improvement/*.md)
      return 0
      ;;
    retrospective:記憶庫/lessons.md|\
    retrospective:記憶庫/reusable-patterns.md|\
    retrospective:記憶庫/decisions.md)
      return 0
      ;;
    job-scout:運用部/reports/job-scout-*.md|\
    job-scout:運用部/job-scout/seen-jobs.json)
      return 0
      ;;
  esac

  return 1
}

FAILED=0
tmp="$(mktemp)"
if [ "$MODE" = "--staged" ]; then
  git diff --cached --name-only --diff-filter=ACMRT > "$tmp"
else
  git status --porcelain | sed 's/^...//' > "$tmp"
fi

while IFS= read -r path; do
  [ -z "$path" ] && continue
  if ! allowed "$path"; then
    echo "automation-ownership: $ROUTINE may not modify $path" >&2
    FAILED=1
  fi
done < "$tmp"
rm -f "$tmp"

if [ "$FAILED" -ne 0 ]; then
  echo "automation-ownership: failed" >&2
  exit 1
fi

echo "automation-ownership: ok" >&2
