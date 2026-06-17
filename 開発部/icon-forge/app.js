'use strict';

// 生成するアイコン定義（サイズ / ファイル名 / 用途 / maskableか）
const SPECS = [
  { size: 192, name: 'icon-192.png',        use: 'PWA標準（小）',       maskable: false },
  { size: 512, name: 'icon-512.png',        use: 'PWA標準（大）',       maskable: false },
  { size: 192, name: 'maskable-192.png',    use: 'Android丸切り対応',   maskable: true  },
  { size: 512, name: 'maskable-512.png',    use: 'Android丸切り対応',   maskable: true  },
  { size: 180, name: 'apple-touch-icon.png', use: 'iPhoneホーム画面',   maskable: false },
  { size: 32,  name: 'favicon-32.png',      use: 'ブラウザのタブ',      maskable: false },
];

const el = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  grid: document.getElementById('grid'),
  emptyMsg: document.getElementById('emptyMsg'),
  downloadBtn: document.getElementById('downloadBtn'),
  optMaskable: document.getElementById('optMaskable'),
  optBg: document.getElementById('optBg'),
  manifestBox: document.getElementById('manifestBox'),
  manifestSnippet: document.getElementById('manifestSnippet'),
  copyManifest: document.getElementById('copyManifest'),
};

let sourceImg = null;          // 読み込んだ HTMLImageElement
const generated = new Map();   // name -> { blob, canvas }

// --- ファイル受け取り ---
el.dropzone.addEventListener('click', () => el.fileInput.click());
el.dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
});
el.fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});
['dragover', 'dragenter'].forEach(ev =>
  el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.add('is-drag'); })
);
['dragleave', 'drop'].forEach(ev =>
  el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.remove('is-drag'); })
);
el.dropzone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadFile(f);
});

el.optMaskable.addEventListener('change', regenerate);
el.optBg.addEventListener('input', regenerate);

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => { sourceImg = img; regenerate(); };
    img.onerror = () => alert('画像を読み込めませんでした。別のファイルを試してください。');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// --- 1サイズ分のCanvasを描く ---
function drawIcon(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = spec.size;
  canvas.height = spec.size;
  const ctx = canvas.getContext('2d');

  // 透過画像のための下地（PWAアイコンは透過非推奨なので塗る）
  ctx.fillStyle = el.optBg.value;
  ctx.fillRect(0, 0, spec.size, spec.size);

  // maskable は中央に縮めて安全余白を確保（端が丸く切られても欠けない）
  const pad = (spec.maskable && el.optMaskable.checked) ? spec.size * 0.10 : 0;
  const draw = spec.size - pad * 2;

  // ソースを正方形にフィット（中央クロップ）
  const s = Math.min(sourceImg.width, sourceImg.height);
  const sx = (sourceImg.width - s) / 2;
  const sy = (sourceImg.height - s) / 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImg, sx, sy, s, s, pad, pad, draw, draw);

  return canvas;
}

function regenerate() {
  if (!sourceImg) return;
  el.grid.innerHTML = '';
  generated.clear();

  SPECS.forEach((spec) => {
    const canvas = drawIcon(spec);
    canvas.toBlob((blob) => {
      generated.set(spec.name, { blob });
      if (generated.size === SPECS.length) el.downloadBtn.disabled = false;
    }, 'image/png');

    const tile = document.createElement('div');
    tile.className = 'tile';
    const view = document.createElement('canvas');
    view.width = view.height = 88;
    view.getContext('2d').drawImage(canvas, 0, 0, 88, 88);
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = `${spec.size}px`;
    const use = document.createElement('span');
    use.className = 'use';
    use.textContent = spec.use;
    tile.append(view, label, use);
    el.grid.appendChild(tile);
  });

  el.manifestSnippet.textContent = buildManifestSnippet();
  el.manifestBox.hidden = false;
}

// --- manifest の icons 断片（=どの絵をどう使うかの対応表） ---
function buildManifestSnippet() {
  const icons = SPECS
    .filter(s => s.size >= 192)  // manifestに載せるのは192以上
    .map(s => ({
      src: s.name,
      sizes: `${s.size}x${s.size}`,
      type: 'image/png',
      ...(s.maskable ? { purpose: 'maskable' } : { purpose: 'any' }),
    }));
  return '"icons": ' + JSON.stringify(icons, null, 2);
}

el.copyManifest.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.manifestSnippet.textContent);
    el.copyManifest.textContent = 'コピーしました ✓';
    setTimeout(() => (el.copyManifest.textContent = 'この断片をコピー'), 1500);
  } catch { alert('コピーに失敗しました。手動で選択してください。'); }
});

// --- zipでまとめてDL ---
el.downloadBtn.addEventListener('click', async () => {
  if (typeof JSZip === 'undefined') { alert('zipライブラリの読み込みに失敗しました。'); return; }
  const zip = new JSZip();
  for (const [name, { blob }] of generated) zip.file(name, blob);
  zip.file('manifest-icons-snippet.txt', el.manifestSnippet.textContent);
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pwa-icons.zip';
  a.click();
  URL.revokeObjectURL(url);
});
