#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DEV_DIR = path.join(ROOT, '開発部');
const REGISTRY_PATH = path.join(ROOT, '運用部', 'project-registry.json');
const OVERRIDES_PATH = path.join(ROOT, '運用部', 'council-overrides.json');

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function listProjectDirs() {
  return fs.readdirSync(DEV_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
    .map((entry) => path.join(DEV_DIR, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'index.html')) || fs.existsSync(path.join(dir, 'package.json')));
}

function detectUrl(projectDir) {
  const share = readIfExists(path.join(projectDir, 'SHARE.md'));
  const urlMatch = share.match(/https:\/\/[^\s)]+/);
  if (urlMatch) return urlMatch[0];

  const firebase = readIfExists(path.join(projectDir, '.firebaserc'));
  const projectMatch = firebase.match(/"default"\s*:\s*"([^"]+)"/);
  if (projectMatch) return `https://${projectMatch[1]}.web.app`;

  return '';
}

function detectHosting(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'vercel.json')) || fs.existsSync(path.join(projectDir, '.vercel'))) return 'vercel';
  if (fs.existsSync(path.join(projectDir, 'firebase.json'))) return 'firebase';
  return 'unknown';
}

function detectType(projectName, text) {
  const name = projectName.toLowerCase();
  if (/kanban|todo|crm|admin|dashboard/.test(name)) return 'ops-tool';
  if (/food|photo|camera|image|chart/.test(name)) return 'visual-share';
  if (/lexworld|quote-court|board-game|game|puzzle|quiz/.test(name)) return 'game';

  const lower = `${projectName} ${text}`.toLowerCase();
  if (/\b(openai|anthropic|claude|gpt|prompt|vision|serverless)\b|api\//.test(lower)) return 'ai';
  if (/kanban|todo|crm|admin|dashboard|workflow|task/.test(lower)) return 'ops-tool';
  if (/photo|image|camera|canvas|sns|food|chart|food-score/.test(lower)) return 'visual-share';
  if (/lexworld|quote-court|game|puzzle|quiz|level|stage|player|rank/.test(lower)) return 'game';
  if (/word|flash|learn|study|typing|language|english|lex|book|haiku/.test(lower)) return 'learning';
  return 'general';
}

function detectCouncil(type) {
  return {
    game: 'Game Master Council',
    ai: 'AI Product Council',
    'visual-share': 'Visual Share Council',
    'ops-tool': 'Operational Excellence Council',
    learning: 'Learning Science Council',
    general: 'Product Genius Council',
  }[type] || 'Product Genius Council';
}

function resolveType(projectName, text, existing) {
  return existing.typeOverride || detectType(projectName, text);
}

function resolveCouncil(type, existing) {
  return existing.councilOverride || (existing.type === type && existing.council ? existing.council : detectCouncil(type));
}

const registry = readJson(REGISTRY_PATH, { updatedAt: null, projects: {} });
const overrides = readJson(OVERRIDES_PATH, { projects: {} });

for (const projectDir of listProjectDirs()) {
  const projectName = path.basename(projectDir);
  const existing = registry.projects[projectName] || {};
  const projectOverride = overrides.projects[projectName] || {};
  const text = [
    readIfExists(path.join(projectDir, 'index.html')),
    readIfExists(path.join(projectDir, 'app.js')),
    readIfExists(path.join(projectDir, 'README.md')),
    readIfExists(path.join(projectDir, 'SHARE.md')),
  ].join('\n');
  const type = resolveType(projectName, text, projectOverride);
  const url = existing.url || detectUrl(projectDir);
  const hasCouncilReport = existing.councilReport && fs.existsSync(path.join(ROOT, existing.councilReport));
  const status = existing.status || (url ? (hasCouncilReport ? 'デプロイ後改善中' : 'デプロイ済み') : '開発中');

  registry.projects[projectName] = {
    path: `開発部/${projectName}`,
    url,
    type,
    council: resolveCouncil(type, projectOverride),
    status,
    hosting: detectHosting(projectDir),
    lastDeploy: existing.lastDeploy || '',
    lastCouncil: existing.lastCouncil || '',
    councilReport: existing.councilReport || '',
    lastReleaseCheck: existing.lastReleaseCheck || '',
  };
}

registry.updatedAt = new Date().toISOString();
fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);

console.log(`Registry synced: ${REGISTRY_PATH}`);
console.log(`Projects: ${Object.keys(registry.projects).length}`);
