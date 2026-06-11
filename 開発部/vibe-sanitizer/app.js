'use strict';

// ── DOM ────────────────────────────────────────────────
const codeInput    = document.getElementById('code-input');
const scanBtn      = document.getElementById('scan-btn');
const clearBtn     = document.getElementById('clear-btn');
const lineCount    = document.getElementById('line-count');
const langBadge    = document.getElementById('lang-badge');
const copyBtn      = document.getElementById('copy-btn');

const stateEmpty   = document.getElementById('state-empty');
const stateLoading = document.getElementById('state-loading');
const stateResult  = document.getElementById('state-result');

const ringFill     = document.getElementById('ring-fill');
const scoreNum     = document.getElementById('score-num');
const scoreVerdict = document.getElementById('score-verdict');
const issueSummary = document.getElementById('issue-summary');
const issueList    = document.getElementById('issue-list');
const noIssues     = document.getElementById('no-issues');

// ── Language detection ─────────────────────────────────
const LANGS = [
  { name: 'PHP',        re: /^<\?php/m },
  { name: 'Python',     re: /^\s*(def |import |from .+ import|class .+:)/m },
  { name: 'TypeScript', re: /:\s*(string|number|boolean|void|any)\b|interface\s+\w+|type\s+\w+\s*=/ },
  { name: 'React/JSX',  re: /import React|jsx|\.tsx?'|from ['"]react['"]/ },
  { name: 'Go',         re: /^package\s+\w+|^func\s+\w+/m },
  { name: 'Ruby',       re: /^def\s+\w+|require ['"]|\.rb'/ },
  { name: 'SQL',        re: /SELECT\s+.+FROM|INSERT INTO|UPDATE\s+\w+\s+SET/i },
  { name: 'JavaScript', re: /const |let |var |=>|require\(|module\.exports/ },
];

function detectLang(code) {
  for (const { name, re } of LANGS) {
    if (re.test(code)) return name;
  }
  return null;
}

// ── Input handling ─────────────────────────────────────
codeInput.addEventListener('input', () => {
  const code  = codeInput.value;
  const lines = code === '' ? 0 : code.split('\n').length;
  lineCount.textContent = `${lines} 行`;
  scanBtn.disabled      = code.trim().length < 10;

  const lang = detectLang(code);
  if (lang) {
    langBadge.textContent = lang;
    langBadge.classList.remove('hidden');
  } else {
    langBadge.classList.add('hidden');
  }
});

clearBtn.addEventListener('click', () => {
  codeInput.value    = '';
  lineCount.textContent = '0 行';
  langBadge.classList.add('hidden');
  scanBtn.disabled   = true;
  showState('empty');
});

// ── Scan ───────────────────────────────────────────────
let lastResult = null;

scanBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  if (!code) return;

  scanBtn.disabled = true;
  showState('loading');

  try {
    const res  = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: detectLang(code) }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    lastResult = data;
    renderResult(data);
    showState('result');
  } catch (err) {
    alert(`スキャンエラー: ${err.message}`);
    showState('empty');
  } finally {
    scanBtn.disabled = false;
  }
});

// ── Render result ──────────────────────────────────────
function renderResult({ safety_score, issues }) {
  // Score ring
  const score = Math.max(0, Math.min(100, Math.round(safety_score)));
  const circ  = 2 * Math.PI * 42;   // 264
  const fill  = circ * (score / 100);
  scoreNum.textContent          = score;
  ringFill.style.strokeDashoffset = circ - fill;

  // Color by score
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f5c518' : '#ff4444';
  ringFill.style.stroke = color;
  scoreNum.style.color  = color;

  // Verdict
  const VERDICTS = [
    [80, '✅ 安全', 'var(--safe)'],
    [50, '⚠️ 要注意', 'var(--medium)'],
    [0,  '🚨 危険', 'var(--critical)'],
  ];
  const [, text, c] = VERDICTS.find(([min]) => score >= min);
  scoreVerdict.textContent  = text;
  scoreVerdict.style.color  = c;

  // Summary
  const critical = issues.filter(i => i.severity === 'CRITICAL').length;
  const high     = issues.filter(i => i.severity === 'HIGH').length;
  const medium   = issues.filter(i => i.severity === 'MEDIUM').length;
  const parts = [];
  if (critical) parts.push(`🔴 Critical ${critical}`);
  if (high)     parts.push(`🟠 High ${high}`);
  if (medium)   parts.push(`🟡 Medium ${medium}`);
  issueSummary.textContent = parts.length ? parts.join('　') : '問題なし';

  // Issue cards
  issueList.innerHTML = '';
  if (issues.length === 0) {
    noIssues.classList.remove('hidden');
    return;
  }
  noIssues.classList.add('hidden');

  const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  [...issues]
    .sort((a, b) => (ORDER[a.severity] ?? 3) - (ORDER[b.severity] ?? 3))
    .forEach(issue => {
      const VALID_SEV = ['critical', 'high', 'medium'];
      const sev   = VALID_SEV.includes((issue.severity || '').toLowerCase()) ? issue.severity.toLowerCase() : 'medium';
      const lines = (issue.line_numbers || []).length
        ? `L${issue.line_numbers.join(', L')}`
        : '';

      const card = document.createElement('div');
      card.className = `issue-card ${sev}`;
      card.innerHTML = `
        <div class="issue-top">
          <span class="severity-badge ${sev}">${sev.toUpperCase()}</span>
          <span class="issue-title">${escHtml(issue.title)}</span>
          ${lines ? `<span class="issue-lines">${escHtml(lines)}</span>` : ''}
        </div>
        <p class="issue-desc">${escHtml(issue.description)}</p>
        <div class="issue-fix">
          <div class="issue-fix-label">💡 修正方法</div>
          ${escHtml(issue.fix)}
        </div>`;
      issueList.appendChild(card);
    });
}

// ── Copy ───────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const { safety_score, issues } = lastResult;
  const lines = [
    `VibeSanitizer スキャン結果`,
    `安全度スコア: ${safety_score}/100`,
    '',
    ...issues.map(i =>
      `[${i.severity}] ${i.title}\n  ${i.description}\n  修正: ${i.fix}`
    ),
    issues.length === 0 ? '問題は検出されませんでした' : '',
  ];
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    copyBtn.textContent = '✅ コピー済み';
    setTimeout(() => { copyBtn.textContent = '📋 コピー'; }, 2000);
  });
});

// ── Helpers ────────────────────────────────────────────
function showState(name) {
  stateEmpty.classList.toggle('hidden',   name !== 'empty');
  stateLoading.classList.toggle('hidden', name !== 'loading');
  stateResult.classList.toggle('hidden',  name !== 'result');
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── PWA ───────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js');
