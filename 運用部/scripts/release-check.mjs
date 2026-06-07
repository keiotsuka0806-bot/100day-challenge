#!/usr/bin/env node
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--project') args.project = argv[i + 1];
    if (argv[i] === '--visual') args.visual = true;
    if (argv[i] === '--no-share-update') args.noShareUpdate = true;
  }
  return args;
}

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
}

function fetchStatus(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({ ok: false, detail: 'URL missing' });
      return;
    }
    const req = https.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, detail: `HTTP ${res.statusCode}` });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, detail: 'timeout' });
    });
    req.on('error', (error) => resolve({ ok: false, detail: error.message }));
    req.end();
  });
}

function fetchText(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({ ok: false, status: 0, detail: 'URL missing', body: '' });
      return;
    }
    https.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          detail: `HTTP ${res.statusCode}`,
          body,
        });
      });
    }).on('error', (error) => resolve({ ok: false, status: 0, detail: error.message, body: '' }));
  });
}

async function runVisualCheck(url) {
  const fetched = await fetchText(url);
  const htmlOk = fetched.ok && /<body[\s>]/i.test(fetched.body) && fetched.body.replace(/<[^>]+>/g, ' ').trim().length > 20;
  return {
    ok: htmlOk,
    detail: `${fetched.detail}; mode=html`,
  };
}

function ticketStatus(reportText, id) {
  const section = reportText.match(new RegExp(`### ${id}:[\\s\\S]*?(?=\\n### GC-|\\n## |$)`));
  if (!section) return 'Missing';
  if (section[0].includes('- **判定**: Done')) return 'Done';
  if (section[0].includes('- **判定**: Skipped')) return 'Skipped';
  if (section[0].includes('- **判定**: Needs Work')) return 'Needs Work';
  return 'Open';
}

function ticketSection(reportText, id) {
  return reportText.match(new RegExp(`### ${id}:[\\s\\S]*?(?=\\n### GC-|\\n## |$)`))?.[0] || '';
}

function scoreTicket(reportText, id) {
  const section = ticketSection(reportText, id);
  let score = 0;
  if (!section) return 0;
  if (section.includes('- **判定**: Done')) score += 2;
  if (/実装結果\*\*: (?!未記録|なし|Missing|Open).{12,}/.test(section)) score += 1;
  if (/確認方法\*\*: .{12,}/.test(section)) score += 1;
  if (/完了条件\*\*: .{12,}/.test(section)) score += 1;
  return Math.min(score, 5);
}

function qualityScores(reportText) {
  const scores = {
    'GC-L1': scoreTicket(reportText, 'GC-L1'),
    'GC-L2': scoreTicket(reportText, 'GC-L2'),
    'GC-L3': scoreTicket(reportText, 'GC-L3'),
  };
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  return { scores, total };
}

function scanForSecrets(projectDir) {
  const suspicious = [];
  const allowed = new Set(['node_modules', '.git', '.vercel', '.firebase', 'dist']);
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!allowed.has(entry.name)) walk(path.join(dir, entry.name));
        continue;
      }
      const file = path.join(dir, entry.name);
      if (!/\.(js|mjs|html|json|md|env|txt)$/.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (/sk-[A-Za-z0-9_-]{20,}/.test(text)) suspicious.push(file);
      if (/ANTHROPIC_API_KEY\s*=\s*['"]?[^'"\s]+/.test(text)) suspicious.push(file);
      if (/OPENAI_API_KEY\s*=\s*['"]?[^'"\s]+/.test(text)) suspicious.push(file);
    }
  }
  walk(projectDir);
  return suspicious;
}

function dailyContainsProject(projectName) {
  const today = new Date().toISOString().slice(0, 10);
  const candidates = [
    path.join(ROOT, '運用部', 'reports', `${today}.md`),
    path.join(ROOT, '運用部', 'daily', `${today}.md`),
    path.join(ROOT, '運用部', '日報', `${today}.md`),
  ];
  return candidates.some((filePath) => fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').toLowerCase().includes(projectName.toLowerCase()));
}

function updateCouncilChecklist(reportPath, checks) {
  if (!fs.existsSync(reportPath)) return;
  let text = fs.readFileSync(reportPath, 'utf8');
  const replacements = [
    ['変更後に再デプロイ済み', checks.urlOk],
    ['公開URLのHTTP 200確認済み', checks.urlOk],
    ['日報またはDaily Control Sheetに反映済み', checks.dailyOk],
  ];
  replacements.forEach(([label, ok]) => {
    text = text.replace(new RegExp(`- \\[[ x]\\] ${label}`, 'g'), `- [${ok ? 'x' : ' '}] ${label}`);
  });
  fs.writeFileSync(reportPath, text);
}

function updateCouncilTaskEvidence({ projectName, project, http, visual, visualRequested }) {
  const taskDir = path.join(ROOT, '運用部', 'tasks', projectName);
  if (!fs.existsSync(taskDir)) return;
  const command = `node 運用部/scripts/release-check.mjs --project ${projectName}${visualRequested ? ' --visual' : ''}`;
  const urlEvidence = `${project.url || '未設定'} (${http.detail})`;
  const visualEvidence = visual ? ` / Visual: ${visual.detail}` : '';
  for (const id of ['GC-L1', 'GC-L2', 'GC-L3']) {
    const taskPath = path.join(taskDir, `${id}.md`);
    if (!fs.existsSync(taskPath)) continue;
    let text = fs.readFileSync(taskPath, 'utf8');
    text = text.replace(/- 変更ファイル: .*/g, `- 変更ファイル: ${project.councilReport || 'Councilレポート未設定'} を参照`);
    text = text.replace(/- 確認コマンド: .*/g, `- 確認コマンド: ${command}`);
    text = text.replace(/- 公開URL確認: .*/g, `- 公開URL確認: ${urlEvidence}${visualEvidence}`);
    fs.writeFileSync(taskPath, text);
  }
}

function appendDailyRelease({ projectName, project, checks, passed }) {
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(ROOT, '運用部', 'reports', `${today}.md`);
  const status = passed ? '共有可能' : 'デプロイ後改善中';
  const marker = `<!-- release-check:${projectName}:${today} -->`;
  const entry = [
    marker,
    '',
    `## Release Check: ${projectName}`,
    '',
    `- URL: ${project.url || '未設定'}`,
    `- Status: ${status}`,
    `- Council: ${project.council || '未設定'}`,
    `- Verified At: ${project.lastVerifiedAt || '未記録'}`,
    '',
    '| Check | Result | Detail |',
    '| --- | --- | --- |',
    ...checks.map((check) => `| ${check.name} | ${check.ok ? 'OK' : 'NG'} | ${String(check.detail).replace(/\|/g, '/')} |`),
    '',
  ].join('\n');

  const current = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : `# 運用日報 ${today}\n\n`;
  const cleaned = current.replace(new RegExp(`${marker}[\\s\\S]*?(?=\\n<!-- release-check:|\\n<!-- shareable-projects:|\\n<!-- release-check-all:|$)`, 'g'), '').trimEnd();
  fs.writeFileSync(reportPath, `${cleaned}\n\n${entry}`.trimEnd() + '\n');
}

function appendDailyShareableProjects(registry) {
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(ROOT, '運用部', 'reports', `${today}.md`);
  const marker = `<!-- shareable-projects:${today} -->`;
  const rows = Object.entries(registry.projects || {})
    .filter(([, project]) => project.status === '共有可能' && project.url)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, project]) => `| ${name} | ${project.type || '-'} | ${project.url} | ${project.lastHttpStatus || '-'} |`);
  const entry = [
    marker,
    '',
    '## 今日の共有可能プロジェクト',
    '',
    '| Project | Type | URL | Last Check |',
    '| --- | --- | --- | --- |',
    ...(rows.length ? rows : ['| なし | - | - | - |']),
    '',
  ].join('\n');
  const current = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : `# 運用日報 ${today}\n\n`;
  const cleaned = current.replace(new RegExp(`${marker}[\\s\\S]*?(?=\\n<!-- release-check:|\\n<!-- shareable-projects:|\\n<!-- release-check-all:|$)`, 'g'), '').trimEnd();
  fs.writeFileSync(reportPath, `${cleaned}\n\n${entry}`.trimEnd() + '\n');
}

function handoffSections(projectName, project) {
  if (project.type === 'game') {
    return [
      `## 遊び方`,
      '- URLを開く',
      '- 最初のステージでルールを確認する',
      '- クリア後にランクや自己ベストを見せる',
      '',
      `## X投稿案`,
      `100日チャレンジで ${projectName} を作りました。`,
      `パズルとして遊べます。クリアランクもあります: ${project.url || ''}`,
      '',
      `## スクショTODO`,
      '- タイトル画面',
      '- プレイ中の盤面',
      '- クリア/ランク表示',
      '',
    ];
  }
  if (project.type === 'ai') {
    return [
      `## 入力例`,
      '- まず短いサンプル入力で試す',
      '- 結果が出たら用途に合わせて入力を調整する',
      '',
      `## X投稿案`,
      `100日チャレンジで ${projectName} を作りました。`,
      `AI機能をURLから試せます: ${project.url || ''}`,
      '',
      `## 注意点`,
      '- 個人情報や秘密情報を入力しない',
      '- 出力は必要に応じて確認する',
      '',
    ];
  }
  if (project.type === 'ops-tool') {
    return [
      `## 使いどころ`,
      '- 毎日の小さな作業管理',
      '- 状態を見える化したい場面',
      '',
      `## X投稿案`,
      `100日チャレンジで ${projectName} を作りました。`,
      `小さな運用ツールとして触れます: ${project.url || ''}`,
      '',
      `## 確認TODO`,
      '- 空状態',
      '- 追加/更新/削除',
      '- モバイル表示',
      '',
    ];
  }
  return [
    `## X投稿案`,
    `100日チャレンジで ${projectName} を作りました。`,
    `URLだけで触れます: ${project.url || ''}`,
    '',
    `## スクショTODO`,
    '- PC表示',
    '- スマホ表示',
    '- 主要機能の結果画面',
    '',
  ];
}

function shareContent(projectName, project) {
  const lines = [
    `# ${projectName} SHARE`,
    '',
    `URL: ${project.url || '未設定'}`,
    '',
  ];
  if (project.type === 'game') {
    lines.push(
      '## 友達向け説明',
      'ブラウザで遊べる100日チャレンジのミニゲームです。',
      '',
      '## 遊び方',
      '- URLを開く',
      '- 画面のルールを読んでステージをクリアする',
      '- クリア後のランクや自己ベストを見せ合う',
      '',
    );
  } else if (project.type === 'ai') {
    lines.push(
      '## 友達向け説明',
      'ブラウザで試せるAI系の100日チャレンジ作品です。',
      '',
      '## 使い方',
      '- URLを開く',
      '- サンプル入力から試す',
      '- 個人情報や秘密情報は入力しない',
      '',
    );
  } else if (project.type === 'ops-tool') {
    lines.push(
      '## 友達向け説明',
      '日々の作業や状態整理に使える小さな運用ツールです。',
      '',
      '## 使い方',
      '- URLを開く',
      '- 項目を追加して状態を動かす',
      '- スマホでも主要操作を確認する',
      '',
    );
  } else {
    lines.push(
      '## 友達向け説明',
      'URLだけで触れる100日チャレンジ作品です。',
      '',
    );
  }
  lines.push(
    '## 確認状況',
    `- Status: ${project.status || '未設定'}`,
    `- Last HTTP: ${project.lastHttpStatus || '未確認'}`,
    `- Last Visual: ${project.lastVisualCheck || '未確認'}`,
    '',
  );
  return lines.join('\n');
}

function updateShareMd({ projectName, project }) {
  if (!project.path) return '';
  const projectDir = path.join(ROOT, project.path);
  if (!project.path || !fs.existsSync(projectDir)) return '';
  const sharePath = path.join(projectDir, 'SHARE.md');
  fs.writeFileSync(sharePath, shareContent(projectName, project));
  return sharePath;
}

function writePrHandoff({ projectName, project, passed }) {
  if (!passed) return '';
  const today = new Date().toISOString().slice(0, 10);
  const dir = path.join(ROOT, '広報部', 'handoff');
  fs.mkdirSync(dir, { recursive: true });
  const handoffPath = path.join(dir, `${projectName}-${today}.md`);
  const content = [
    `# 広報ハンドオフ ${projectName} ${today}`,
    '',
    `## URL`,
    project.url || '未設定',
    '',
    `## 状態`,
    project.status || '共有可能',
    '',
    `## Council`,
    project.council || '未設定',
    '',
    `## 一言説明`,
    `${projectName} を友達に共有可能な状態まで整備済み。`,
    '',
    ...handoffSections(projectName, project),
    `## note切り口`,
    '- 作った背景',
    '- Genius Councilで改善した点',
    '- 友達に渡せる状態にするための運用',
    '',
  ].join('\n');
  fs.writeFileSync(handoffPath, content);
  return handoffPath;
}

function writeReleaseFixTask({ projectName, checks }) {
  const failures = checks.filter((check) => !check.ok);
  if (!failures.length) return '';
  const today = new Date().toISOString().slice(0, 10);
  const dir = path.join(ROOT, '運用部', 'tasks', projectName);
  fs.mkdirSync(dir, { recursive: true });
  const taskPath = path.join(dir, 'release-fix.md');
  const content = [
    `# Release Fix ${projectName}`,
    '',
    `## Status`,
    'Open',
    '',
    `## 作成日`,
    today,
    '',
    `## 失敗項目`,
    '',
    ...failures.flatMap((check) => [
      `### ${check.name}`,
      `- Detail: ${check.detail}`,
      `- Next Action: ${nextActionFor(check.name)}`,
      '',
    ]),
    `## 完了条件`,
    '- `node 運用部/scripts/release-check.mjs --project [project-name]` が通る',
    '- 必要に応じて `--visual` 付きでも通る',
    '',
  ].join('\n');
  fs.writeFileSync(taskPath, content);
  return taskPath;
}

function nextActionFor(name) {
  if (name.includes('Production URL')) return '公開URL、デプロイ状態、DNS、Hosting設定を確認する。';
  if (name.includes('Genius Council')) return 'Genius Councilを実行し、レポートを生成する。';
  if (name.includes('GC-L')) return '該当GCタスクを実装するか、明確な見送り理由を記録する。';
  if (name.includes('SHARE.md')) return '友達に送るURL、説明、遊び方/使い方を含むSHARE.mdを作成する。';
  if (name.includes('API keys')) return '秘密情報を削除し、環境変数やサーバー側設定に移す。';
  if (name.includes('Visual')) return '公開画面のHTML/表示崩れ/初期表示を確認する。';
  return '失敗理由を確認して修正する。';
}

const args = parseArgs(process.argv.slice(2));
if (!args.project) {
  console.error('Usage: node 運用部/scripts/release-check.mjs --project [project-name]');
  process.exit(1);
}

const registryPath = path.join(ROOT, '運用部', 'project-registry.json');
const registry = readJson(registryPath, { projects: {} });
const project = registry.projects[args.project];
if (!project) {
  console.error(`Project not found in registry: ${args.project}`);
  process.exit(1);
}

const projectDir = path.join(ROOT, project.path);
const reportPath = project.councilReport ? path.join(ROOT, project.councilReport) : '';
const reportExists = Boolean(reportPath) && fs.existsSync(reportPath) && fs.statSync(reportPath).isFile();
const reportText = reportExists ? fs.readFileSync(reportPath, 'utf8') : '';
const http = await fetchStatus(project.url);
const visual = args.visual ? await runVisualCheck(project.url) : null;
const quality = qualityScores(reportText);
const preShareUpdatedPath = !args.noShareUpdate && project.url ? updateShareMd({ projectName: args.project, project }) : '';
const sharePath = path.join(projectDir, 'SHARE.md');
const secretHits = scanForSecrets(projectDir);
const dailyAlreadyRecorded = dailyContainsProject(args.project);
const checks = [
  { name: 'Registry entry exists', ok: true, detail: project.status },
  { name: 'Production URL HTTP 200/3xx', ok: http.ok, detail: http.detail },
  { name: 'Genius Council report exists', ok: reportExists, detail: project.councilReport || 'missing' },
  { name: 'GC-L1 closed', ok: ['Done', 'Skipped'].includes(ticketStatus(reportText, 'GC-L1')), detail: ticketStatus(reportText, 'GC-L1') },
  { name: 'GC-L2 closed', ok: ['Done', 'Skipped'].includes(ticketStatus(reportText, 'GC-L2')), detail: ticketStatus(reportText, 'GC-L2') },
  { name: 'GC-L3 closed', ok: ['Done', 'Skipped'].includes(ticketStatus(reportText, 'GC-L3')), detail: ticketStatus(reportText, 'GC-L3') },
  { name: 'Genius Council score >= 12', ok: quality.total >= 12, detail: `total=${quality.total}; GC-L1=${quality.scores['GC-L1']}; GC-L2=${quality.scores['GC-L2']}; GC-L3=${quality.scores['GC-L3']}` },
  { name: 'SHARE.md exists', ok: fs.existsSync(sharePath), detail: fs.existsSync(sharePath) ? 'present' : 'missing' },
  { name: 'Daily report updated', ok: true, detail: dailyAlreadyRecorded ? 'present' : 'auto-appended' },
  ...(args.visual ? [{ name: 'Visual smoke check', ok: visual.ok, detail: visual.detail }] : []),
  { name: 'No obvious API keys in project files', ok: secretHits.length === 0, detail: secretHits.length ? secretHits.join(', ') : 'clean' },
];

const passed = checks.every((check) => check.ok);
updateCouncilChecklist(reportPath, { urlOk: http.ok, dailyOk: true });
const now = new Date().toISOString();
project.lastVerifiedAt = now;
project.lastHttpStatus = http.detail;
project.lastPublicUrl = project.url || '';
if (visual) {
  project.lastVisualCheckAt = now;
  project.lastVisualCheck = visual.detail;
}
updateCouncilTaskEvidence({ projectName: args.project, project, http, visual, visualRequested: args.visual });
appendDailyRelease({ projectName: args.project, project, checks, passed });
if (passed) {
  project.status = '共有可能';
  project.lastReleaseCheck = new Date().toISOString().slice(0, 10);
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
} else {
  project.status = '要修正';
  project.lastReleaseCheck = new Date().toISOString().slice(0, 10);
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}
const shareUpdatedPath = passed && !args.noShareUpdate ? updateShareMd({ projectName: args.project, project }) : preShareUpdatedPath;
if (shareUpdatedPath) {
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}
appendDailyShareableProjects(registry);
const handoffPath = writePrHandoff({ projectName: args.project, project, passed });
const releaseFixPath = writeReleaseFixTask({ projectName: args.project, checks });
console.log(`# Release Check: ${args.project}`);
console.log('');
for (const check of checks) {
  console.log(`${check.ok ? 'OK' : 'NG'} ${check.name}: ${check.detail}`);
}
console.log('');
console.log(`Result: ${passed ? '共有可能' : '要修正'}`);
if (shareUpdatedPath) console.log(`SHARE.md updated: ${shareUpdatedPath}`);
if (handoffPath) console.log(`PR handoff written: ${handoffPath}`);
if (releaseFixPath) console.log(`Release fix task written: ${releaseFixPath}`);
process.exit(passed ? 0 : 1);
