'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 1200, H = 630;

// --- 配色プリセット（背景 / 文字 / 差し色） ---
const PALETTES = [
  { name: 'ミッドナイト', bg: '#1a1a2e', fg: '#ffffff', accent: '#e94560' },
  { name: 'ペーパー',     bg: '#f7f5f0', fg: '#1f1f24', accent: '#e94560' },
  { name: 'フォレスト',   bg: '#10241b', fg: '#f2fff6', accent: '#43d17a' },
  { name: 'オーシャン',   bg: '#0d1b2a', fg: '#e0f2ff', accent: '#4cc9f0' },
  { name: 'サンセット',   bg: '#2b1331', fg: '#fff0f5', accent: '#ff8c42' },
  { name: 'モノクロ',     bg: '#111111', fg: '#fafafa', accent: '#888888' },
];

const state = {
  title: '',
  subtitle: '',
  author: '',
  template: 'left',
  bg: '#1a1a2e',
  fg: '#ffffff',
  accent: '#e94560',
};

// --- DOM ---
const el = {
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  author: document.getElementById('author'),
  templateRow: document.getElementById('templateRow'),
  paletteRow: document.getElementById('paletteRow'),
  bgColor: document.getElementById('bgColor'),
  fgColor: document.getElementById('fgColor'),
  accentColor: document.getElementById('accentColor'),
  downloadBtn: document.getElementById('downloadBtn'),
};

// --- パレットチップ生成 ---
PALETTES.forEach((p, i) => {
  const b = document.createElement('button');
  b.className = 'swatch' + (i === 0 ? ' is-active' : '');
  b.style.background = p.bg;
  b.style.borderColor = p.accent;
  b.title = p.name;
  b.setAttribute('aria-label', p.name);
  b.addEventListener('click', () => {
    state.bg = p.bg; state.fg = p.fg; state.accent = p.accent;
    el.bgColor.value = p.bg; el.fgColor.value = p.fg; el.accentColor.value = p.accent;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('is-active'));
    b.classList.add('is-active');
    render();
  });
  el.paletteRow.appendChild(b);
});

// --- テンプレ切替 ---
el.templateRow.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.template = chip.dataset.template;
  el.templateRow.querySelectorAll('.chip').forEach(c => {
    const active = c === chip;
    c.classList.toggle('is-active', active);
    c.setAttribute('aria-checked', String(active));
  });
  render();
});

// --- 入力バインド ---
el.title.addEventListener('input', () => { state.title = el.title.value; render(); });
el.subtitle.addEventListener('input', () => { state.subtitle = el.subtitle.value; render(); });
el.author.addEventListener('input', () => { state.author = el.author.value; render(); });
el.bgColor.addEventListener('input', () => { state.bg = el.bgColor.value; clearSwatch(); render(); });
el.fgColor.addEventListener('input', () => { state.fg = el.fgColor.value; clearSwatch(); render(); });
el.accentColor.addEventListener('input', () => { state.accent = el.accentColor.value; clearSwatch(); render(); });

function clearSwatch() {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('is-active'));
}

// --- 文字列を最大幅で折り返し（日本語は1文字ずつ判定） ---
function wrapText(text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

// --- 描画本体 ---
function render() {
  const { bg, fg, accent, template } = state;
  const title = state.title || 'ここにタイトルが入ります';
  const subtitle = state.subtitle;
  const author = state.author;

  // 背景
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const pad = 90;

  if (template === 'band') {
    // 上下に差し色の帯
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, 16);
    ctx.fillRect(0, H - 16, W, 16);
  }

  // タイトル：長さに応じてフォントサイズを自動調整
  const centered = template === 'center';
  const maxTextWidth = W - pad * 2;
  let fontSize = 72;
  let lines = [];
  for (; fontSize >= 40; fontSize -= 4) {
    ctx.font = `700 ${fontSize}px -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    lines = wrapText(title, maxTextWidth);
    const totalH = lines.length * fontSize * 1.32;
    if (lines.length <= 4 && totalH <= H - pad * 2 - 80) break;
  }

  const lineH = fontSize * 1.32;
  const blockH = lines.length * lineH;
  let y;
  if (centered) {
    y = (H - blockH) / 2 + fontSize;
    ctx.textAlign = 'center';
  } else {
    y = pad + fontSize + (subtitle ? 0 : 30);
    ctx.textAlign = 'left';
  }
  const x = centered ? W / 2 : pad;

  // 左寄せテンプレは差し色のアクセントバー
  if (template === 'left') {
    ctx.fillStyle = accent;
    ctx.fillRect(pad, pad - 18, 70, 10);
    y += 6;
  }

  ctx.fillStyle = fg;
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH));

  // サブタイトル
  if (subtitle) {
    ctx.font = `400 30px -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = accent;
    const sy = y + blockH + 12;
    ctx.fillText(subtitle, x, sy);
  }

  // 著者（左下 or 中央下）
  if (author) {
    ctx.font = `500 26px -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.75;
    ctx.textAlign = centered ? 'center' : 'left';
    ctx.fillText(author, centered ? W / 2 : pad, H - pad + 30);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'left';
}

// --- ダウンロード ---
el.downloadBtn.addEventListener('click', () => {
  render();
  const link = document.createElement('a');
  const slug = (state.title || 'ogp').slice(0, 20).replace(/[\s\/\\:*?"<>|]+/g, '-');
  link.download = `ogp-${slug}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

render();
