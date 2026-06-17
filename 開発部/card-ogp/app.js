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
  image: null,        // HTMLImageElement | null
  imageMode: 'bottom', // 'bottom' | 'bg' | 'side'
};

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
  imageDrop: document.getElementById('imageDrop'),
  imageDropLabel: document.getElementById('imageDropLabel'),
  imageInput: document.getElementById('imageInput'),
  removeImage: document.getElementById('removeImage'),
  imageModeField: document.getElementById('imageModeField'),
  imageModeRow: document.getElementById('imageModeRow'),
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
  setActiveChip(el.templateRow, chip);
  render();
});

// --- 画像の入れ方切替 ---
el.imageModeRow.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.imageMode = chip.dataset.mode;
  setActiveChip(el.imageModeRow, chip);
  render();
});

function setActiveChip(row, chip) {
  row.querySelectorAll('.chip').forEach(c => {
    const active = c === chip;
    c.classList.toggle('is-active', active);
    c.setAttribute('aria-checked', String(active));
  });
}

// --- 画像読み込み ---
el.imageDrop.addEventListener('click', () => el.imageInput.click());
el.imageDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.imageInput.click(); }
});
el.imageInput.addEventListener('change', (e) => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
});
['dragover', 'dragenter'].forEach(ev =>
  el.imageDrop.addEventListener(ev, (e) => { e.preventDefault(); el.imageDrop.classList.add('is-drag'); })
);
['dragleave', 'drop'].forEach(ev =>
  el.imageDrop.addEventListener(ev, (e) => { e.preventDefault(); el.imageDrop.classList.remove('is-drag'); })
);
el.imageDrop.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadImage(f);
});
el.removeImage.addEventListener('click', () => {
  state.image = null;
  el.imageInput.value = '';
  el.imageDropLabel.textContent = 'ここに画像をドラッグ、またはクリックして選択';
  el.removeImage.hidden = true;
  el.imageModeField.hidden = true;
  render();
});

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      el.imageDropLabel.textContent = '画像を読み込みました（クリックで差し替え）';
      el.removeImage.hidden = false;
      el.imageModeField.hidden = false;
      render();
    };
    img.onerror = () => alert('画像を読み込めませんでした。別のファイルを試してください。');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

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

// --- 画像を領域にcover配置（中央クロップ） ---
function drawCover(img, dx, dy, dw, dh) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sw, sh, sx, sy;
  if (ir > dr) { sh = img.height; sw = sh * dr; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / dr; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// --- 画像を領域にcontain配置（全体を収める・中央） ---
function drawContain(img, dx, dy, dw, dh) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let w, h;
  if (ir > dr) { w = dw; h = dw / ir; } else { h = dh; w = dh * ir; }
  ctx.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
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
  const { bg, fg, accent, template, image, imageMode } = state;
  const title = state.title || 'ここにタイトルが入ります';
  const subtitle = state.subtitle;
  const author = state.author;

  // 背景
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // テキストを置ける領域（画像の入れ方で変える）
  let textArea = { x: 0, y: 0, w: W, h: H };

  if (image) {
    if (imageMode === 'bg') {
      drawCover(image, 0, 0, W, H);
      // 文字を読めるように背景色のスクリーンを重ねる
      ctx.globalAlpha = 0.58;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    } else if (imageMode === 'bottom') {
      const bandH = Math.round(H * 0.42);
      drawContain(image, 40, H - bandH, W - 80, bandH - 30);
      textArea = { x: 0, y: 0, w: W, h: H - bandH };
    } else if (imageMode === 'side') {
      const imgW = Math.round(W * 0.40);
      drawContain(image, W - imgW, 60, imgW - 50, H - 120);
      textArea = { x: 0, y: 0, w: W - imgW, h: H };
    }
  }

  const pad = 90;

  if (template === 'band') {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, 16);
    ctx.fillRect(0, H - 16, W, 16);
  }

  // タイトル：領域に合わせてフォントサイズを自動調整
  const centered = template === 'center';
  const maxTextWidth = textArea.w - pad * 2;
  let fontSize = 72;
  let lines = [];
  for (; fontSize >= 36; fontSize -= 4) {
    ctx.font = `700 ${fontSize}px -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    lines = wrapText(title, maxTextWidth);
    const totalH = lines.length * fontSize * 1.32;
    if (lines.length <= 4 && totalH <= textArea.h - pad * 2 - 60) break;
  }

  const lineH = fontSize * 1.32;
  const blockH = lines.length * lineH;
  let y;
  if (centered) {
    y = textArea.y + (textArea.h - blockH) / 2 + fontSize;
    ctx.textAlign = 'center';
  } else {
    y = textArea.y + pad + fontSize + (subtitle ? 0 : 20);
    ctx.textAlign = 'left';
  }
  const x = centered ? textArea.x + textArea.w / 2 : textArea.x + pad;

  if (template === 'left') {
    ctx.fillStyle = accent;
    ctx.fillRect(textArea.x + pad, textArea.y + pad - 18, 70, 10);
    y += 6;
  }

  ctx.fillStyle = fg;
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH));

  // サブタイトル
  if (subtitle) {
    ctx.font = `400 30px -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText(subtitle, x, y + blockH + 12);
  }

  // 著者
  if (author) {
    ctx.font = `500 26px -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.78;
    ctx.textAlign = centered ? 'center' : 'left';
    const ay = (image && imageMode === 'bottom') ? textArea.h - 28 : H - pad + 30;
    ctx.fillText(author, centered ? textArea.x + textArea.w / 2 : textArea.x + pad, ay);
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
