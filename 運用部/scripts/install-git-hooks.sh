#!/bin/bash
# Install local git hooks used by the 100day automation workspace.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$ROOT/.git/hooks"

mkdir -p "$HOOK_DIR"

cat > "$HOOK_DIR/pre-commit" <<'HOOK'
#!/bin/bash
exec /Users/kei/dev/100day-challenge/運用部/scripts/git-hygiene-check.sh --staged
HOOK

cat > "$HOOK_DIR/prepare-commit-msg" <<'HOOK'
#!/bin/bash
set -euo pipefail

MSG_FILE="$1"
ROOT="$(git rev-parse --show-toplevel)"

if head -n 1 "$MSG_FILE" | grep -Eq '^autosave:'; then
  "$ROOT/運用部/scripts/autosave-scope-check.sh" --staged
fi
HOOK

chmod +x "$HOOK_DIR/pre-commit" "$HOOK_DIR/prepare-commit-msg"
echo "installed git hooks in $HOOK_DIR"
