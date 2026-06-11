#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--project') args.project = argv[i + 1];
    if (argv[i] === '--url') args.url = argv[i + 1];
    if (argv[i] === '--date') args.date = argv[i + 1];
  }
  return args;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', '.git', '.vercel', '.firebase', 'dist'].includes(entry.name)) {
        return listFiles(full);
      }
      return entry.isFile() ? [full] : [];
    });
}

function detectProjectType(projectDir, text) {
  const name = path.basename(projectDir).toLowerCase();
  if (/kanban|todo|crm|admin|dashboard/.test(name)) return 'ops-tool';
  if (/food|photo|camera|image|chart/.test(name)) return 'visual-share';
  if (/lexworld|quote-court|board-game|game|puzzle|quiz/.test(name)) return 'game';

  const lower = `${projectDir} ${text}`.toLowerCase();
  if (/\b(openai|anthropic|claude|gpt|prompt|vision|serverless)\b|api\//.test(lower)) return 'ai';
  if (/kanban|todo|crm|admin|dashboard|workflow|task/.test(lower)) return 'ops-tool';
  if (/photo|image|camera|canvas|sns|food|chart|food-score/.test(lower)) return 'visual-share';
  if (/lexworld|quote-court|game|puzzle|quiz|level|stage|player|rank/.test(lower)) return 'game';
  if (/word|flash|learn|study|typing|language|english|lex|book|haiku/.test(lower)) return 'learning';
  return 'general';
}

const councils = {
  game: {
    name: 'Game Master Council',
    experts: ['天才プロゲーマー', 'レベルデザイナー', 'RTA走者', 'ゲームUXデザイナー'],
    loop1: '初見プレイで目的、操作、勝利条件、失敗理由が即座に読めるかを評価する。',
    loop2: '簡単すぎる抜け道、意味のないギミック、単調なステージ、緊張感の欠落を潰す。',
    loop3: 'ランク、自己ベスト、再挑戦導線、友達に見せたくなる達成感を作る。',
    debate: [
      ['天才プロゲーマー', '攻略の選択肢が薄いと、1回クリアで終わる。手数評価や罠の読み合いが必要。'],
      ['レベルデザイナー', '序盤は理解を優先し、後半は複数連鎖と抜け道防止を要求するべき。'],
      ['RTA走者', '自己ベスト更新の導線がないと走る理由がない。ParとBestは必須。'],
      ['ゲームUXデザイナー', 'ルールが難しいので、初見で勝利条件と有効化条件を読めるUIが必要。'],
    ],
  },
  ai: {
    name: 'AI Product Council',
    experts: ['AIプロダクト設計者', 'プロンプトエンジニア', 'セキュリティ監査者', 'UXリサーチャー'],
    loop1: 'ユーザーがAIに何を頼めるか、入力後に何が返るかを迷わない状態にする。',
    loop2: 'プロンプト、JSON検証、APIキー秘匿、レート制限、エラー時UXを精査する。',
    loop3: '共有、再利用、コスト管理、本格公開前の運用リスクを整理する。',
    debate: [
      ['AIプロダクト設計者', 'AIの価値が入力前に伝わらないと試されない。期待値の設計が必要。'],
      ['プロンプトエンジニア', '出力形式と失敗時のフォールバックが弱いとUI全体が壊れる。'],
      ['セキュリティ監査者', 'APIキー、レート制限、入力サイズ制限は共有前の最低条件。'],
      ['UXリサーチャー', 'AI待ち時間には不安が出る。状態表示と次の行動を明確にする。'],
    ],
  },
  'visual-share': {
    name: 'Visual Share Council',
    experts: ['写真家', 'SNSグロース専門家', 'モバイルUXデザイナー', 'ブランドデザイナー'],
    loop1: '最初の画面で撮影・選択・共有の流れが自然に伝わるかを見る。',
    loop2: '画像の見切れ、生成物の品質、スマホ表示、保存や共有の詰まりを直す。',
    loop3: '友達に送る文言、OGP、共有画像、再利用したくなる体験を整える。',
    debate: [
      ['写真家', '画像が主役なら、見切れ・明るさ・構図の扱いが体験品質を決める。'],
      ['SNSグロース専門家', '共有文とスクショ映えが弱いと、URLは広がらない。'],
      ['モバイルUXデザイナー', 'スマホでの選択、撮影、保存、共有の導線を最短にするべき。'],
      ['ブランドデザイナー', '初見の印象が安っぽいと、結果が良くても人に渡されない。'],
    ],
  },
  'ops-tool': {
    name: 'Operational Excellence Council',
    experts: ['SaaS PM', '業務改善コンサル', 'アクセシビリティ専門家', 'QAエンジニア'],
    loop1: '主要作業が迷わず、少ないクリックで完了するかを見る。',
    loop2: '一覧性、状態管理、入力ミス、空状態、削除や復元の安全性を確認する。',
    loop3: '継続利用、記録、エクスポート、チーム共有の価値を高める。',
    debate: [
      ['SaaS PM', '業務ツールは初回の派手さより、繰り返し操作の摩擦が重要。'],
      ['業務改善コンサル', '状態、責任者、次アクションが曖昧だと運用に乗らない。'],
      ['アクセシビリティ専門家', '情報密度を上げても、読めない・押せないUIは失格。'],
      ['QAエンジニア', '削除、空状態、重複、権限境界のテストが必要。'],
    ],
  },
  learning: {
    name: 'Learning Science Council',
    experts: ['教育設計者', '認知科学者', '教材編集者', '学習UXデザイナー'],
    loop1: '学習者が何を覚え、どう正解へ近づくかをすぐ理解できるかを見る。',
    loop2: '難易度曲線、フィードバック、反復、記憶定着の仕組みを確認する。',
    loop3: '復習、進捗、達成感、継続したくなる短いサイクルを作る。',
    debate: [
      ['教育設計者', '学習目標とフィードバックが曖昧だと教材ではなく遊びで終わる。'],
      ['認知科学者', '記憶には反復と想起が必要。正誤だけでは定着しない。'],
      ['教材編集者', '例題、難易度順、誤答解説の質で学習体験が決まる。'],
      ['学習UXデザイナー', '短い達成感と次回復習導線がないと継続しない。'],
    ],
  },
  general: {
    name: 'Product Genius Council',
    experts: ['プロダクトマネージャー', 'UXデザイナー', 'QAエンジニア', 'グロース担当'],
    loop1: '初見で何の価値があり、次に何をすればいいか分かるかを見る。',
    loop2: '中核機能の破綻、UIの迷い、エラー、モバイル表示を確認する。',
    loop3: '共有、再訪、運用、改善ログの残し方を整える。',
    debate: [
      ['プロダクトマネージャー', '誰のどの問題を解くかが曖昧だと改善優先度が決まらない。'],
      ['UXデザイナー', '初見の行動導線とエラー時の復帰が必要。'],
      ['QAエンジニア', '最低限の操作確認とデータ破壊リスクを見るべき。'],
      ['グロース担当', '共有する理由と再訪する理由を作る必要がある。'],
    ],
  },
};

function inspectProject(projectDir, overrides = {}) {
  const files = listFiles(projectDir);
  const interesting = files.filter((file) => /\.(html|css|js|mjs|json|md)$/.test(file));
  const text = interesting.map((file) => readIfExists(file).slice(0, 8000)).join('\n');
  const type = overrides.typeOverride || detectProjectType(projectDir, text);
  const hasManifest = files.some((file) => path.basename(file) === 'manifest.json');
  const hasVercel = files.some((file) => path.basename(file) === 'vercel.json' || file.includes(`${path.sep}.vercel${path.sep}`));
  const hasFirebase = files.some((file) => path.basename(file) === 'firebase.json' || path.basename(file) === '.firebaserc');
  const hasPackage = files.some((file) => path.basename(file) === 'package.json');
  const hasApi = files.some((file) => file.includes(`${path.sep}api${path.sep}`) || file.includes(`${path.sep}functions${path.sep}`));
  const hasShare = files.some((file) => path.basename(file) === 'SHARE.md');
  return { files, text, type, hasManifest, hasVercel, hasFirebase, hasPackage, hasApi, hasShare };
}

function closeTicket(ticket, projectInfo, url) {
  const text = projectInfo.text.toLowerCase();
  const japanese = projectInfo.text;

  if (ticket.id === 'GC-L1') {
    const firstUseSignals = [
      /遊び方|使い方|guide|hint|help/i.test(projectInfo.text),
      /button|ボタン|cta|start|開始|upload|入力/i.test(projectInfo.text),
      /viewport|mobile|スマホ|swipe|タップ|wasd|arrow/i.test(projectInfo.text),
    ];
    if (firstUseSignals.filter(Boolean).length >= 2) {
      return { status: 'Done', result: '初回説明、操作導線、モバイル/操作文脈が検出された。' };
    }
    return { status: 'Needs Work', result: '初見説明または最初の操作導線が不足している可能性がある。' };
  }

  if (ticket.id === 'GC-L2') {
    if (projectInfo.type === 'game') {
      const gameSignals = [
        /par|rank|best|score|moves|level|stage/i.test(projectInfo.text),
        /trap|fire|罠|難易度|difficulty|chain|連鎖/i.test(projectInfo.text),
        /undo|reset|リセット/i.test(projectInfo.text),
      ];
      if (gameSignals.filter(Boolean).length >= 2) {
        return { status: 'Done', result: 'ゲームとしての評価軸、難易度要素、リカバリー導線が検出された。' };
      }
    }
    if (projectInfo.type === 'ai') {
      const aiSignals = [
        projectInfo.hasApi,
        /rate|limit|制限|validation|json|schema|error|エラー/i.test(projectInfo.text),
        !/sk-[A-Za-z0-9_-]{20,}/.test(projectInfo.text),
      ];
      if (aiSignals.filter(Boolean).length >= 2) {
        return { status: 'Done', result: 'AI/APIアプリとしての安全性・検証・エラー処理のシグナルが検出された。' };
      }
    }
    const generalSignals = [
      /error|エラー|validation|検証|reset|undo|delete|confirm|確認/i.test(projectInfo.text),
      /localstorage|firestore|state|状態|history|履歴/i.test(text),
      projectInfo.hasManifest || projectInfo.hasApi,
    ];
    if (generalSignals.filter(Boolean).length >= 2) {
      return { status: 'Done', result: '中核品質に関する状態管理、復帰、検証のシグナルが検出された。' };
    }
    return { status: 'Needs Work', result: '中核品質を示す状態管理、検証、復帰導線が不足している可能性がある。' };
  }

  if (ticket.id === 'GC-L3') {
    const shareSignals = [
      projectInfo.hasShare,
      Boolean(url),
      /share|共有|og:|twitter:|best|rank|履歴|history|localstorage|再挑戦/i.test(projectInfo.text),
    ];
    if (shareSignals.filter(Boolean).length >= 2) {
      return { status: 'Done', result: '共有メモ、本番URL、再訪/共有シグナルが検出された。' };
    }
    return { status: 'Needs Work', result: '共有URL、共有メモ、再訪理由のいずれかが不足している可能性がある。' };
  }

  return { status: 'Open', result: '自動判定対象外。' };
}

function buildRecommendations(projectName, url, projectInfo, council) {
  const tickets = [];

  tickets.push({
    id: 'GC-L1',
    loop: 'Loop 1: First-Use / Core Value',
    owner: 'デザイン部 + 開発部',
    purpose: '初回ユーザーを最初の成功体験まで連れていく。',
    problem: council.loop1,
    implementationTargets: 'index.html / styles.css / app.js / 主要導線の文言',
    done: '初見ユーザーが3秒以内に目的を理解し、最初の操作を迷わず開始できる。',
    verification: '公開URLを開き、ファーストビュー、操作説明、最初のCTA、モバイル表示を確認する。',
  });

  tickets.push({
    id: 'GC-L2',
    loop: 'Loop 2: Expert Quality / Domain Depth',
    owner: 'QA部 + 開発部 + 選定Council',
    purpose: '領域のプロが見ても中核体験が浅くない状態にする。',
    problem: council.loop2,
    implementationTargets: '中核ロジック / エラー処理 / 難易度設計 / API安全性 / 状態管理',
    done: '抜け道、意味のないギミック、危険な実装、退屈な導線への主要指摘が処理済み。',
    verification: '主要機能を1通り操作し、Council種別ごとの専門観点で破綻がないことを確認する。',
  });

  tickets.push({
    id: 'GC-L3',
    loop: 'Loop 3: Replay / Share / Operation',
    owner: '広報部 + 運用部 + 開発部',
    purpose: '友達に渡す理由、再訪する理由、運用で抜けない仕組みを作る。',
    problem: council.loop3,
    implementationTargets: 'SHARE.md / OGP / 結果画面 / 履歴・ベスト・保存 / 運用日報',
    done: '共有文、共有URL、再利用導線、運用ログが揃い、再デプロイ後のURL確認が完了。',
    verification: '友達に送る文面でURLを開き、追加説明なしで主要価値に到達できることを確認する。',
  });

  const flags = [];
  if (!projectInfo.hasManifest) flags.push('PWA/manifest がない。必要なプロジェクトでは追加を検討する。');
  if (!projectInfo.hasVercel && !projectInfo.hasFirebase) flags.push('ホスティング設定が検出できない。デプロイ手順を明示する。');
  if (projectInfo.hasApi) flags.push('API/Functions がある。APIキー秘匿、レート制限、エラー処理を重点確認する。');
  if (!url) flags.push('本番URLが未指定。共有完了にはURL疎通確認が必要。');

  return {
    tickets: tickets.map((ticket) => ({
      ...ticket,
      closure: closeTicket(ticket, projectInfo, url),
    })),
    flags,
  };
}

function updateRegistry({ projectName, projectPath, url, date, projectInfo, council }) {
  const registryPath = path.join(ROOT, '運用部', 'project-registry.json');
  const registry = readJson(registryPath, { updatedAt: null, projects: {} });

  const existing = registry.projects[projectName] || {};
  registry.updatedAt = new Date().toISOString();
  registry.projects[projectName] = {
    ...existing,
    path: projectPath,
    url: url || existing.url || '',
    type: projectInfo.type,
    council: council.name,
    status: 'デプロイ後改善中',
    lastCouncil: date,
    lastDeploy: date,
    councilReport: `デザイン部/reports/${date}-${projectName}-genius-council.md`,
  };

  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  return registryPath;
}

function writeReport({ projectName, projectPath, url, date, projectInfo, council, tickets, flags }) {
  const reportDir = path.join(ROOT, 'デザイン部', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${date}-${projectName}-genius-council.md`);
  const report = [
    `# Genius Council Cycle ${date} ${projectName}`,
    '',
    '## 対象',
    '',
    `- プロジェクト: ${projectName}`,
    `- ディレクトリ: ${projectPath}`,
    `- URL: ${url || '未指定'}`,
    `- 判定カテゴリ: ${projectInfo.type}`,
    `- Council: ${council.name}`,
    '',
    '## 参加プロ集団',
    '',
    ...council.experts.map((expert) => `- ${expert}`),
    '',
    '## Council 議論',
    '',
    ...(council.debate || []).map(([expert, opinion]) => `- **${expert}**: ${opinion}`),
    '',
    '## CEO Claude 優先判断',
    '',
    '1. まずGC-L1で初見の価値理解と最初の成功体験を固める。',
    '2. 次にGC-L2で専門領域として浅い部分、抜け道、危険な実装を潰す。',
    '3. 最後にGC-L3で共有・再訪・運用ログを整え、共有可能ステータスへ進める。',
    '',
    '## 自動検出',
    '',
    `- ファイル数: ${projectInfo.files.length}`,
    `- manifest: ${projectInfo.hasManifest ? 'あり' : 'なし'}`,
    `- Vercel設定: ${projectInfo.hasVercel ? 'あり' : 'なし'}`,
    `- Firebase設定: ${projectInfo.hasFirebase ? 'あり' : 'なし'}`,
    `- package.json: ${projectInfo.hasPackage ? 'あり' : 'なし'}`,
    `- API/Functions: ${projectInfo.hasApi ? 'あり' : 'なし'}`,
    '',
    '## 3ループ改善チケット',
    '',
    ...tickets.flatMap((ticket) => [
      `### ${ticket.id}: ${ticket.loop}`,
      '',
      `- **担当**: ${ticket.owner}`,
      `- **目的**: ${ticket.purpose}`,
      `- **問題**: ${ticket.problem}`,
      `- **実装対象**: ${ticket.implementationTargets}`,
      `- **完了条件**: ${ticket.done}`,
      `- **確認方法**: ${ticket.verification}`,
      `- **実装結果**: ${ticket.closure.result}`,
      `- **判定**: ${ticket.closure.status}`,
      '',
    ]),
    '## 完了チェック',
    '',
    ...tickets.map((ticket) => `- [${['Done', 'Skipped'].includes(ticket.closure.status) ? 'x' : ' '}] ${ticket.id} 実装または見送り判断が記録されている`),
    '- [ ] 変更後に再デプロイ済み',
    '- [ ] 公開URLのHTTP 200確認済み',
    '- [ ] 日報またはDaily Control Sheetに反映済み',
    '',
    '## 注意フラグ',
    '',
    ...(flags.length ? flags.map((flag) => `- ${flag}`) : ['- 重大な自動検出フラグなし']),
    '',
    '## 運用ルール',
    '',
    '- このレポート生成だけで完了にしない。',
    '- 開発担当は3ループ分の改善を実装するか、改善不要の理由をこのレポートまたは運用日報に追記する。',
    '- 改善後は再デプロイし、本番URLの疎通確認を行う。',
    '',
  ].join('\n');

  fs.writeFileSync(reportPath, report);
  return { reportPath, report };
}

function writeTaskFiles({ projectName, date, council, tickets }) {
  const taskDir = path.join(ROOT, '運用部', 'tasks', projectName);
  fs.mkdirSync(taskDir, { recursive: true });

  tickets.forEach((ticket) => {
    const taskPath = path.join(taskDir, `${ticket.id}.md`);
    const task = [
      `# ${ticket.id} ${projectName}`,
      '',
      `## Council`,
      council.name,
      '',
      `## 作成日`,
      date,
      '',
      `## 担当`,
      ticket.owner,
      '',
      `## 目的`,
      ticket.purpose,
      '',
      `## 問題`,
      ticket.problem,
      '',
      `## 実装対象`,
      ticket.implementationTargets,
      '',
      `## 完了条件`,
      ticket.done,
      '',
      `## 確認方法`,
      ticket.verification,
      '',
      `## 実装結果`,
      ticket.closure.result,
      '',
      `## 状態`,
      ticket.closure.status,
      '',
      `## 状態遷移`,
      '- Open: 未着手',
      '- Doing: 実装中',
      '- Done: 実装または妥当な見送り判断が完了',
      '- Skipped: 明確な理由つきで対象外',
      '',
      `## 証拠`,
      `- 変更ファイル: 未記録`,
      `- 確認コマンド: 未記録`,
      `- 公開URL確認: 未記録`,
      '',
    ].join('\n');
    fs.writeFileSync(taskPath, task);
  });

  return taskDir;
}

const args = parseArgs(process.argv.slice(2));
if (!args.project) {
  console.error('Usage: node 運用部/scripts/post-deploy-genius-cycle.mjs --project 開発部/[project-name] --url https://...');
  process.exit(1);
}

const projectPath = args.project;
const projectDir = path.isAbsolute(projectPath) ? projectPath : path.join(ROOT, projectPath);
if (!fs.existsSync(projectDir)) {
  console.error(`Project not found: ${projectDir}`);
  process.exit(1);
}

const projectName = path.basename(projectDir);
const date = args.date || new Date().toISOString().slice(0, 10);
const registryPathForOverrides = path.join(ROOT, '運用部', 'council-overrides.json');
const registryForOverrides = readJson(registryPathForOverrides, { projects: {} });
const projectOverrides = registryForOverrides.projects[projectName] || {};
const projectInfo = inspectProject(projectDir, projectOverrides);
const baseCouncil = councils[projectInfo.type] || councils.general;
const council = projectOverrides.councilOverride
  ? { ...baseCouncil, name: projectOverrides.councilOverride }
  : baseCouncil;
const { tickets, flags } = buildRecommendations(projectName, args.url, projectInfo, council);
const registryPath = updateRegistry({
  projectName,
  projectPath,
  url: args.url,
  date,
  projectInfo,
  council,
});
const { reportPath, report } = writeReport({
  projectName,
  projectPath,
  url: args.url,
  date,
  projectInfo,
  council,
  tickets,
  flags,
});
const taskDir = writeTaskFiles({ projectName, date, council, tickets });

console.log(report);
console.log(`Report written: ${reportPath}`);
console.log(`Registry updated: ${registryPath}`);
console.log(`Task files written: ${taskDir}`);
