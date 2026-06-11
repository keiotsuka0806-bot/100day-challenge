#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

function parseArgs(argv) {
  return {
    visual: argv.includes('--visual'),
    includeDev: argv.includes('--include-dev'),
  };
}

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
}

const args = parseArgs(process.argv.slice(2));
const registryPath = path.join(ROOT, '運用部', 'project-registry.json');
const registry = readJson(registryPath, { projects: {} });
const projects = Object.entries(registry.projects)
  .filter(([, project]) => project.url)
  .filter(([, project]) => args.includeDev || project.status !== '開発中');

const results = [];
for (const [name] of projects) {
  const command = ['運用部/scripts/release-check.mjs', '--project', name];
  if (args.visual) command.push('--visual');
  const result = spawnSync(process.execPath, command, { cwd: ROOT, encoding: 'utf8' });
  results.push({ name, ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() });
}

const today = new Date().toISOString().slice(0, 10);
const reportPath = path.join(ROOT, '運用部', 'reports', `${today}.md`);
const marker = `<!-- release-check-all:${today} -->`;
const entry = [
  marker,
  '',
  '## Release Check All',
  '',
  '| Project | Result |',
  '| --- | --- |',
  ...results.map((result) => `| ${result.name} | ${result.ok ? 'OK' : 'NG'} |`),
  '',
].join('\n');
const current = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : `# 運用日報 ${today}\n\n`;
const cleaned = current.replace(new RegExp(`${marker}[\\s\\S]*?(?=\\n<!-- release-check:|\\n<!-- shareable-projects:|\\n<!-- release-check-all:|$)`, 'g'), '').trimEnd();
fs.writeFileSync(reportPath, `${cleaned}\n\n${entry}`.trimEnd() + '\n');

for (const result of results) {
  console.log(`${result.ok ? 'OK' : 'NG'} ${result.name}`);
}
console.log(`Report updated: ${reportPath}`);
process.exit(results.every((result) => result.ok) ? 0 : 1);
