// TokenDiet — トークン数・料金の可視化と削減提案(すべて端末内で計算)

const $ = (id) => document.getElementById(id);

// 入力トークン単価(USD / 100万トークン、2026年6月時点)
const MODELS = [
  { name: 'GPT-4o-mini', tag: 'OpenAI / 軽量', price: 0.15 },
  { name: 'Claude Haiku 4.5', tag: 'Anthropic / 軽量', price: 1.0 },
  { name: 'Claude Sonnet 4.6', tag: 'Anthropic / 標準', price: 3.0 },
  { name: 'Claude Fable 5', tag: 'Anthropic / Mythos級', price: 10.0 },
];

/* ---------- トークン計算 ----------
   まず正確なトークナイザ(gpt-tokenizer / o200k)のCDN読み込みを試み、
   失敗したら言語別の概算式にフォールバックする */

let encodeFn = null;
let exactMode = false;

async function initTokenizer() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/gpt-tokenizer@3.0.1/esm/encoding/o200k_base.js',
    'https://cdn.jsdelivr.net/npm/gpt-tokenizer@2.9.0/esm/encoding/o200k_base.js',
  ];
  for (const url of urls) {
    try {
      const mod = await import(url);
      if (typeof mod.encode === 'function') {
        encodeFn = mod.encode;
        exactMode = true;
        $('tokenLabel').textContent = 'トークン(o200k実測)';
        recount();
        return;
      }
    } catch (_) { /* 次のURLへ */ }
  }
  $('tokenLabel').textContent = 'トークン(概算)';
  recount();
}

// 概算: CJK(日本語等)は約0.9トークン/文字、英数はおおよそ4文字で3トークン
function estimateTokens(text) {
  if (!text) return 0;
  const cjk = (text.match(/[　-鿿＀-￯぀-ヿ]/g) || []).length;
  const rest = text.length - cjk;
  return Math.round(cjk * 0.9 + rest / 4 * 3);
}

function countTokens(text) {
  if (!text) return 0;
  if (exactMode && encodeFn) {
    try { return encodeFn(text).length; } catch (_) { return estimateTokens(text); }
  }
  return estimateTokens(text);
}

/* ---------- 表示更新 ---------- */

let recountTimer = null;
$('textInput').addEventListener('input', () => {
  clearTimeout(recountTimer);
  recountTimer = setTimeout(recount, 200);
});
$('jpyRate').addEventListener('input', recount);
$('dailyCalls').addEventListener('input', recount);

function recount() {
  const text = $('textInput').value;
  const tokens = countTokens(text);

  $('charCount').textContent = text.length.toLocaleString();
  $('tokenCount').textContent = tokens.toLocaleString();
  $('lineCount').textContent = text ? text.split('\n').length.toLocaleString() : 0;

  renderPrices(tokens);
  renderSuggestions(text, tokens);
}

function renderPrices(tokens) {
  const rate = parseFloat($('jpyRate').value) || 150;
  const daily = parseInt($('dailyCalls').value, 10) || 10;
  const body = $('priceBody');
  body.innerHTML = '';
  for (const m of MODELS) {
    const oneUsd = tokens / 1_000_000 * m.price;
    const oneJpy = oneUsd * rate;
    const monthJpy = oneJpy * daily * 30;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="model-name">${m.name}</span><span class="model-tag">${m.tag}</span></td>
      <td>${fmtYen(oneJpy)}</td>
      <td>${fmtYen(monthJpy)}</td>`;
    body.appendChild(tr);
  }
}

function fmtYen(v) {
  if (v === 0) return '—';
  if (v < 0.01) return '0.01円未満';
  if (v < 1) return v.toFixed(2) + '円';
  if (v < 100) return v.toFixed(1) + '円';
  return Math.round(v).toLocaleString() + '円';
}

/* ---------- ダイエット提案(ルールベース・端末内) ---------- */

const RULES = [
  { name: '連続する空白・空行', re: /[ \t]{2,}|\n{3,}/g, fix: (t) => t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n') },
  { name: '定型の前置き(「よろしくお願いします」等)', re: /(お忙しいところ恐れ入りますが|よろしくお願い(いた)?します|お疲れ様です)[。、]?/g, fix: (t) => t.replace(/(お忙しいところ恐れ入りますが|よろしくお願い(いた)?します|お疲れ様です)[。、]?/g, '') },
  { name: '冗長なクッション言葉(「basically」「ちなみに」等)', re: /(基本的に|ちなみに|なお、|また、なお|つまり、要するに|be sure to|please note that)/gi, fix: (t) => t.replace(/(つまり、要するに)/g, 'つまり') },
  { name: '同じ語の3回以上の繰り返し行', re: null, fix: null },
];

function renderSuggestions(text, tokens) {
  const box = $('suggestions');
  box.innerHTML = '';
  if (!text.trim()) {
    box.innerHTML = '<p class="hint">文章を入力すると、削っても意味が変わりにくい箇所を検出します</p>';
    $('dietBtn').classList.add('hidden');
    $('dietResult').classList.add('hidden');
    return;
  }

  let found = 0;
  for (const rule of RULES) {
    if (!rule.re) continue;
    const matches = text.match(rule.re);
    if (matches && matches.length) {
      found++;
      const div = document.createElement('div');
      div.className = 'sug';
      div.innerHTML = `<b>${matches.length}箇所</b> — ${rule.name}`;
      box.appendChild(div);
    }
  }

  // 重複行の検出
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 8);
  const dup = lines.length - new Set(lines).size;
  if (dup > 0) {
    found++;
    const div = document.createElement('div');
    div.className = 'sug';
    div.innerHTML = `<b>${dup}行</b> — まったく同じ行の重複`;
    box.appendChild(div);
  }

  if (found === 0) {
    const div = document.createElement('div');
    div.className = 'sug sug-ok';
    div.innerHTML = '<b>スリム!</b> 機械的に削れる箇所は見つかりませんでした';
    box.appendChild(div);
    $('dietBtn').classList.add('hidden');
  } else {
    $('dietBtn').classList.remove('hidden');
  }
}

$('dietBtn').addEventListener('click', () => {
  const original = $('textInput').value;
  let slim = original;
  for (const rule of RULES) {
    if (rule.fix) slim = rule.fix(slim);
  }
  // 重複行の除去(順序維持)
  const seen = new Set();
  slim = slim.split('\n').filter((l) => {
    const key = l.trim();
    if (key.length <= 8) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join('\n').trim();

  const before = countTokens(original);
  const after = countTokens(slim);
  const saved = before - after;
  const pct = before ? Math.round(saved / before * 100) : 0;

  $('dietOutput').value = slim;
  $('dietSummary').innerHTML =
    `${before.toLocaleString()} → <b>${after.toLocaleString()}</b> トークン(<b>−${pct}%</b> / ${saved.toLocaleString()}トークン節約)`;
  $('dietResult').classList.remove('hidden');
});

$('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('dietOutput').value);
  $('copyBtn').textContent = '✅ コピーしました';
  setTimeout(() => { $('copyBtn').textContent = '📋 スリム版をコピー'; }, 1500);
});

/* ---------- 起動 ---------- */
renderPrices(0);
initTokenizer();
