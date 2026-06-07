#!/bin/bash
# Generate a daily health report for the AI organization.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

DATE="${ORG_HEALTH_DATE:-$(date '+%Y-%m-%d')}"
REPORT_DIR="$ROOT/運用部/reports"
REPORT_FILE="$REPORT_DIR/organization-health-$DATE.md"
SESSION_LOG="$ROOT/運用部/sessions/$DATE.md"

mkdir -p "$REPORT_DIR" "$(dirname "$SESSION_LOG")"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

ORG_HEALTH_DATE="$DATE" node <<'NODE' > "$tmp"
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const date = process.env.ORG_HEALTH_DATE;
const registryPath = path.join(root, '運用部/project-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const projects = Object.entries(registry.projects || {}).map(([name, project]) => ({
  name,
  ...project,
}));

const counts = new Map();
for (const project of projects) {
  counts.set(project.status, (counts.get(project.status) || 0) + 1);
}

const shareableProjects = projects.filter((project) => ['共有可能', '稼働中'].includes(project.status));
const deployReadyProjects = projects.filter((project) => ['デプロイ済み', 'デプロイ後改善中'].includes(project.status));
const needsFixProjects = projects.filter((project) => project.status === '要修正');
const nextTarget = deployReadyProjects[0] || needsFixProjects[0] || null;
const gitStatus = execSync('git status --short', { encoding: 'utf8' }).trim();
const localOnlyExists = fs.existsSync(path.join(root, 'CLAUDE.local.md'));

const lines = [];
lines.push(`# Organization Health Report ${date}`);
lines.push('');
lines.push('## Summary');
lines.push(`- total_projects: ${projects.length}`);
lines.push(`- shareable_ready: ${shareableProjects.length}`);
lines.push(`- deploy_ready: ${deployReadyProjects.length}`);
lines.push(`- needs_fix: ${needsFixProjects.length}`);
lines.push('');
lines.push('## Status Breakdown');
lines.push('| Status | Count |');
lines.push('| --- | --- |');
for (const status of ['共有可能', '稼働中', 'デプロイ済み', 'デプロイ後改善中', '開発中', '要修正', '休止']) {
  if (counts.has(status)) {
    lines.push(`| ${status} | ${counts.get(status)} |`);
  }
}
for (const [status, count] of counts.entries()) {
  if (!['共有可能', '稼働中', 'デプロイ済み', 'デプロイ後改善中', '開発中', '要修正', '休止'].includes(status)) {
    lines.push(`| ${status} | ${count} |`);
  }
}
lines.push('');
lines.push('## Today\'s Learning');
lines.push('- 組織の方針、部署ルール、Step 0の文脈は versioned にして共有資産にする。秘密情報と端末依存の設定だけ local-only に分ける。');
lines.push('');
lines.push('## Shareable Output');
if (shareableProjects.length > 0) {
  for (const project of shareableProjects) {
    lines.push(`- ${project.name} (${project.status}) — ${project.url || 'URLなし'}`);
  }
} else {
  lines.push('- 共有可能な成果はまだない');
}
lines.push('');
lines.push('## Risk Notes');
if (deployReadyProjects.length > 0) {
  lines.push(`- 共有可能目前のプロジェクトが ${deployReadyProjects.length} 件ある: ${deployReadyProjects.map((project) => project.name).join(', ')}`);
}
if (needsFixProjects.length > 0) {
  lines.push(`- 要修正のプロジェクトが ${needsFixProjects.length} 件ある: ${needsFixProjects.map((project) => project.name).join(', ')}`);
}
if (localOnlyExists) {
  lines.push('- `CLAUDE.local.md` が存在し、秘密情報の退避先がある');
}
if (gitStatus) {
  lines.push(`- working tree dirty:`);
  for (const line of gitStatus.split('\n')) lines.push(`  - ${line}`);
} else {
  lines.push('- working tree clean');
}
lines.push('');
lines.push('## Next Best Action');
if (nextTarget) {
  lines.push(`- ${nextTarget.name} を次に共有可能へ進める`);
  lines.push(`- 推奨コマンド: \`cd /Users/kei/dev/100day-challenge && node 運用部/scripts/release-check.mjs --project ${nextTarget.name}\``);
} else {
  lines.push('- 次に進める対象がないため、新規プロジェクトか共有改善を選ぶ');
}
lines.push('');

process.stdout.write(lines.join('\n'));
NODE

cp "$tmp" "$REPORT_FILE"

{
  echo "[$(date '+%H:%M')] organization-health: ${DATE} report=$REPORT_FILE"
  echo "[$(date '+%H:%M')] organization-health summary:"
  sed -n '1,80p' "$REPORT_FILE"
} >> "$SESSION_LOG"

echo "organization-health: wrote $REPORT_FILE"
