#!/bin/bash
# 不要ファイルの自動整理スクリプト
# - ルートのスクリーンショット → スクリーンショット/YYYY-MM/ へ移動
# - 古い企画書（14日以上前）→ 企画部/specs/archive/ へアーカイブ
# - .DS_Store を削除
# - 古い運用部レポート（30日以上前）→ 運用部/archive/ へアーカイブ

BASEDIR="/Users/kei/dev/100day-challenge"
cd "$BASEDIR" || exit 1

DATE=$(date '+%Y-%m-%d')
SESSION_LOG="運用部/sessions/$DATE.md"
SUMMARY=""

# 1. ルートのスクリーンショット移動
SCREENSHOT_DIR="スクリーンショット/$(date '+%Y-%m')"
mkdir -p "$SCREENSHOT_DIR"
moved=0
for f in *.png *.jpg *.jpeg; do
  [ -f "$f" ] || continue
  mv "$f" "$SCREENSHOT_DIR/"
  moved=$((moved + 1))
done
[ $moved -gt 0 ] && SUMMARY="$SUMMARY スクリーンショット${moved}件移動→$SCREENSHOT_DIR;"

# 2. 古いスペックファイルをアーカイブ（14日以上前）
SPEC_ARCHIVE="企画部/specs/archive"
mkdir -p "$SPEC_ARCHIVE"
archived_specs=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  mv "$f" "$SPEC_ARCHIVE/"
  archived_specs=$((archived_specs + 1))
done < <(find "企画部/specs" -maxdepth 1 -name "*.md" -mtime +14)
[ $archived_specs -gt 0 ] && SUMMARY="$SUMMARY 企画書${archived_specs}件アーカイブ;"

# 3. .DS_Store 削除
ds_count=$(find . -name ".DS_Store" | wc -l | tr -d ' ')
find . -name ".DS_Store" -delete
[ "$ds_count" -gt 0 ] && SUMMARY="$SUMMARY .DS_Store${ds_count}件削除;"

# 3.5. Git hygiene check
if 運用部/scripts/git-hygiene-check.sh >/tmp/100day-git-hygiene.log 2>&1; then
  SUMMARY="$SUMMARY git hygiene OK;"
else
  mkdir -p "$(dirname "$SESSION_LOG")"
  echo "[$(date '+%H:%M')] git hygiene NG — 詳細: /tmp/100day-git-hygiene.log" >> "$SESSION_LOG"
  cat /tmp/100day-git-hygiene.log
  exit 1
fi

# 4. 古い運用レポートをアーカイブ（30日以上前）
LOG_ARCHIVE="運用部/archive"
mkdir -p "$LOG_ARCHIVE"
archived_logs=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  mv "$f" "$LOG_ARCHIVE/"
  archived_logs=$((archived_logs + 1))
done < <(find "運用部/reports" -maxdepth 1 \( -name "*.log" -o -name "*.md" \) -mtime +30 2>/dev/null)
[ $archived_logs -gt 0 ] && SUMMARY="$SUMMARY 運用ログ${archived_logs}件アーカイブ;"

# セッションログに記録（変更があった場合のみ）
if [ -n "$SUMMARY" ]; then
  mkdir -p "$(dirname "$SESSION_LOG")"
  echo "[$(date '+%H:%M')] 自動クリーンアップ —$SUMMARY" >> "$SESSION_LOG"
  echo "✅ cleanup:$SUMMARY"
else
  echo "✅ cleanup: ゴミなし、作業不要"
fi
