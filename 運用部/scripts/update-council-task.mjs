#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

function parseArgs(argv) {
  const args = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--project') args.project = argv[i + 1];
    if (argv[i] === '--ticket') args.ticket = argv[i + 1];
    if (argv[i] === '--status') args.status = argv[i + 1];
    if (argv[i] === '--file') args.files.push(argv[i + 1]);
    if (argv[i] === '--command') args.command = argv[i + 1];
    if (argv[i] === '--url-check') args.urlCheck = argv[i + 1];
    if (argv[i] === '--result') args.result = argv[i + 1];
  }
  return args;
}

function replaceLine(text, label, value) {
  const pattern = new RegExp(`- ${label}: .*`, 'g');
  return pattern.test(text)
    ? text.replace(pattern, `- ${label}: ${value}`)
    : `${text.trimEnd()}\n- ${label}: ${value}\n`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.project || !args.ticket) {
  console.error('Usage: node 運用部/scripts/update-council-task.mjs --project [project] --ticket GC-L1 --status Done --file [path] --command "npm run check" --url-check "HTTP 200"');
  process.exit(1);
}

const allowedStatuses = new Set(['Open', 'Doing', 'Done', 'Skipped', 'Needs Work']);
if (args.status && !allowedStatuses.has(args.status)) {
  console.error(`Invalid status: ${args.status}`);
  process.exit(1);
}

const taskPath = path.join(ROOT, '運用部', 'tasks', args.project, `${args.ticket}.md`);
if (!fs.existsSync(taskPath)) {
  console.error(`Task not found: ${taskPath}`);
  process.exit(1);
}

let text = fs.readFileSync(taskPath, 'utf8');
if (args.status) {
  text = text.replace(/(## 状態\n)([^\n]*)/, `$1${args.status}`);
}
if (args.result) {
  text = text.replace(/(## 実装結果\n)([\s\S]*?)(?=\n## )/, `$1${args.result}\n`);
}
if (args.files.length) {
  text = replaceLine(text, '変更ファイル', args.files.join(', '));
}
if (args.command) {
  text = replaceLine(text, '確認コマンド', args.command);
}
if (args.urlCheck) {
  text = replaceLine(text, '公開URL確認', args.urlCheck);
}

fs.writeFileSync(taskPath, text);
console.log(`Council task updated: ${taskPath}`);
