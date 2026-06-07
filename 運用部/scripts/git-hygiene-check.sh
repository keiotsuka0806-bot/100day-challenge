#!/bin/bash
# Prevent local/cache/runtime files from being committed.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MODE="${1:-}"
FAILED=0

warn() {
  printf 'git-hygiene: %s\n' "$*" >&2
}

fail() {
  warn "$*"
  FAILED=1
}

check_path() {
  path="$1"

  case "$path" in
    .DS_Store|*/.DS_Store)
      fail "macOS metadata must not be committed: $path"
      ;;
    .claude/scheduled_tasks.lock)
      fail "Claude runtime lock must not be committed: $path"
      ;;
    .agents/*|*/.agents/*)
      fail "agent skill/cache catalogue must not be committed: $path"
      ;;
    .firebase/*|*/.firebase/*)
      fail "Firebase deploy cache must not be committed: $path"
      ;;
    node_modules/*|*/node_modules/*)
      fail "dependency directory must not be committed: $path"
      ;;
    .env|*.env|*.env.*)
      fail "environment file must not be committed: $path"
      ;;
    "企画部/specs/運用部/"*)
      fail "operation log is misplaced under specs: $path"
      ;;
    *.log)
      case "$path" in
        運用部/reports/session-*.log|運用部/sessions/cron-cleanup.log)
          ;;
        *)
          fail "log file needs explicit review before commit: $path"
          ;;
      esac
      ;;
    .claude/skills/*)
      case "$path" in
        .claude/skills/genius-audit/*|.claude/skills/genius-consultant/*|.claude/skills/project-kickoff/*|.claude/skills/retrospective/*)
          ;;
        *)
          fail "copied Claude skill catalogue must not be committed: $path"
          ;;
      esac
      ;;
  esac
}

tmp="$(mktemp)"
if [ "$MODE" = "--staged" ]; then
  git diff --cached --name-only --diff-filter=ACMRT > "$tmp"
else
  warn "checking tracked workspace hygiene"
  git ls-files > "$tmp"
fi

while IFS= read -r path; do
  [ -z "$path" ] && continue
  check_path "$path"
done < "$tmp"
rm -f "$tmp"

if [ "$MODE" != "--staged" ] && git status --short | grep -q '^?? '; then
  warn "untracked files exist; review before running automation that commits"
  git status --short | sed -n 's/^?? /  untracked: /p' >&2
fi

if git diff --cached --name-only | grep -Eq '(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$'; then
  warn "lockfile is staged; make sure dependency changes are intentional"
fi

if [ "$FAILED" -ne 0 ]; then
  warn "failed"
  exit 1
fi

warn "ok"
