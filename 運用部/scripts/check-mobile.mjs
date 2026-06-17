#!/usr/bin/env node
// モバイル崩れの静的プリチェック（ブラウザ・依存パッケージ不要）。
// 高確度の崩れ予備軍だけを拾う。最終確認は幅320pxの実機チェック（開発部/CLAUDE.md参照）。
//
// 使い方:
//   node 運用部/scripts/check-mobile.mjs 開発部/receipt-warikan
//   node 運用部/scripts/check-mobile.mjs receipt-warikan   （開発部/配下を自動補完）

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node 運用部/scripts/check-mobile.mjs <project-dir or project-name>');
  process.exit(2);
}

const root = process.cwd();
let dir = path.resolve(root, arg);
if (!fs.existsSync(dir)) dir = path.resolve(root, '開発部', arg);
if (!fs.existsSync(dir)) {
  console.error(`プロジェクトが見つかりません: ${arg}`);
  process.exit(2);
}

const SKIP = new Set(['node_modules', 'dist', '.git', '.vercel', '.firebase']);
function walk(d, exts, acc = []) {
  for (const name of fs.readdirSync(d)) {
    if (SKIP.has(name)) continue;
    const p = path.join(d, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, exts, acc);
    else if (exts.some((e) => name.endsWith(e))) acc.push(p);
  }
  return acc;
}

const findings = []; // {sev:'high'|'warn', file, line, msg}
function add(sev, file, line, msg) {
  findings.push({ sev, file: path.relative(root, file), line, msg });
}

// --- HTML: viewport ---
for (const file of walk(dir, ['.html'])) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const hasViewport = /name=["']viewport["']/i.test(text);
  if (!hasViewport) {
    add('high', file, 1, 'viewportメタタグが無い（スマホで必ず崩れる）。<meta name="viewport" content="width=device-width, initial-scale=1.0"> を追加');
  }
  lines.forEach((ln, i) => {
    if (/name=["']viewport["']/i.test(ln) && /maximum-scale|user-scalable\s*=\s*no/i.test(ln)) {
      add('high', file, i + 1, 'viewportでズーム禁止（maximum-scale/user-scalable=no）。スマホで不便なので外す');
    }
  });
}

// --- CSS: 固定幅・100vh ---
for (const file of walk(dir, ['.css'])) {
  const text = fs.readFileSync(file, 'utf8');
  const hasDvh = /dvh/i.test(text); // dvh併記済みなら100vhは指摘しない
  text.split('\n').forEach((ln, i) => {
    if (/@media/i.test(ln)) return; // メディアクエリの条件式（min-width:420px等）は対象外
    const minW = ln.match(/min-width:\s*(\d{3,})px/i);
    if (minW && Number(minW[1]) >= 320) {
      add('high', file, i + 1, `min-width:${minW[1]}px は320px画面を超える＝はみ出し/見切れの原因。max-widthに変えるか@mediaで縦積みに`);
    }
    const w = ln.match(/(?<!max-)(?<!min-)width:\s*(\d{3,})px/i);
    if (w && Number(w[1]) >= 400) {
      add('warn', file, i + 1, `width:${w[1]}px の固定幅。max-widthにして画面に収まるように`);
    }
    if (/(?<!-)height:\s*100vh/i.test(ln) && !hasDvh) {
      add('warn', file, i + 1, 'height:100vh はスマホのツールバーで崩れる。100dvh を併記する');
    }
  });
}

// --- レポート ---
const high = findings.filter((f) => f.sev === 'high');
const warn = findings.filter((f) => f.sev === 'warn');
const proj = path.relative(root, dir) || dir;

if (findings.length === 0) {
  console.log(`OK モバイル静的チェック: ${proj} — 既知の崩れパターンは見つからず（最終確認は幅320pxの実機チェックで）`);
  process.exit(0);
}

console.log(`モバイル静的チェック: ${proj}`);
for (const f of [...high, ...warn]) {
  console.log(`  [${f.sev === 'high' ? 'NG' : '注意'}] ${f.file}:${f.line} — ${f.msg}`);
}
console.log(`\n高リスク ${high.length}件 / 注意 ${warn.length}件。最終確認は幅320pxの実機チェック（横はみ出し0）を必ず行うこと。`);
process.exit(high.length > 0 ? 1 : 0);
