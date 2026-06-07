#!/bin/bash
# Prevent autosave commits from bundling unrelated work scopes.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MODE="${1:---staged}"
case "$MODE" in
  --staged)
    ;;
  *)
    echo "usage: autosave-scope-check.sh [--staged]" >&2
    exit 2
    ;;
esac

scope_for_path() {
  path="$1"

  case "$path" in
    開発部/*/*)
      first="${path#開発部/}"
      project="${first%%/*}"
      printf '開発部/%s\n' "$project"
      ;;
    */*)
      printf '%s\n' "${path%%/*}"
      ;;
    *)
      printf '%s\n' "$path"
      ;;
  esac
}

tmp_paths="$(mktemp)"
tmp_scopes="$(mktemp)"
trap 'rm -f "$tmp_paths" "$tmp_scopes"' EXIT

git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMRT > "$tmp_paths"

if [ ! -s "$tmp_paths" ]; then
  echo "autosave-scope: ok" >&2
  exit 0
fi

while IFS= read -r path; do
  [ -z "$path" ] && continue
  scope_for_path "$path"
done < "$tmp_paths" | sort -u > "$tmp_scopes"

if [ -n "${AUTOSAVE_SCOPE:-}" ]; then
  if grep -Fvx "$AUTOSAVE_SCOPE" "$tmp_scopes" >/dev/null; then
    echo "autosave-scope: staged files exceed AUTOSAVE_SCOPE=$AUTOSAVE_SCOPE" >&2
    sed 's/^/  scope: /' "$tmp_scopes" >&2
    exit 1
  fi
fi

scope_count="$(wc -l < "$tmp_scopes" | tr -d ' ')"
if [ "$scope_count" -gt 1 ]; then
  echo "autosave-scope: autosave may not commit multiple work scopes" >&2
  sed 's/^/  scope: /' "$tmp_scopes" >&2
  echo "autosave-scope: commit manually in smaller units, or set AUTOSAVE_SCOPE for a single intended scope" >&2
  exit 1
fi

echo "autosave-scope: ok" >&2
