'use strict';

// ── State ──────────────────────────────────────────────
let sourceImage  = null;  // HTMLImageElement
let currentPreset = 'ccd';

// ── Filter definitions ─────────────────────────────────
const PRESETS = {
  ccd: {
    // CCD 2000年代: warm tint, slight oversaturation, digital noise
    rMul: 1.08, gMul: 1.00, bMul: 0.88,   // warm tint
    contrast: 1.10,
    saturation: 1.15,
    blackLift: 0,
    highlights: 0,
    caStrength: 1.5,  // chromatic aberration
  },
  film: {
    // フィルム 90年代: faded, lifted blacks, yellow cast
    rMul: 1.05, gMul: 1.02, bMul: 0.82,
    contrast: 0.92,
    saturation: 0.85,
    blackLift: 18,   // lifted blacks (faded look)
    highlights: -10,
    caStrength: 0.8,
  },
  polaroid: {
    // ポラロイド: cool shadows, green midtones, very faded
    rMul: 0.95, gMul: 1.05, bMul: 1.02,
    contrast: 0.88,
    saturation: 0.70,
    blackLift: 25,
    highlights: -15,
    caStrength: 0.5,
  },
};

// ── DOM refs ───────────────────────────────────────────
const uploadZone  = document.getElementById('upload-zone');
const fileInput   = document.getElementById('file-input');
const editor      = document.getElementById('editor');
const canvas      = document.getElementById('preview');
const ctx         = canvas.getContext('2d');

const intensitySlider = document.getElementById('intensity');
const grainSlider     = document.getElementById('grain');
const vignetteSlider  = document.getElementById('vignette');
const dateToggle      = document.getElementById('date-toggle');
const dateInput       = document.getElementById('date-input');

// Set today as default date
dateInput.value = new Date().toISOString().slice(0, 10);

// ── Upload / Drag-drop ─────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImage(file);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });
document.getElementById('change-photo').addEventListener('click', () => fileInput.click());

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      uploadZone.classList.add('hidden');
      editor.classList.remove('hidden');
      renderCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Preset buttons ─────────────────────────────────────
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPreset = btn.dataset.preset;
    renderCanvas();
  });
});

// ── Sliders ────────────────────────────────────────────
function bindSlider(id, valId) {
  const el = document.getElementById(id);
  const vl = document.getElementById(valId);
  el.addEventListener('input', () => { vl.textContent = el.value; renderCanvas(); });
}
bindSlider('intensity', 'intensity-val');
bindSlider('grain',     'grain-val');
bindSlider('vignette',  'vignette-val');
dateToggle.addEventListener('change', renderCanvas);
dateInput.addEventListener('change',  renderCanvas);

// ── Core render ────────────────────────────────────────
function renderCanvas() {
  if (!sourceImage) return;

  const maxW = 1200;
  let w = sourceImage.naturalWidth;
  let h = sourceImage.naturalHeight;
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }

  canvas.width  = w;
  canvas.height = h;

  // Draw source
  ctx.drawImage(sourceImage, 0, 0, w, h);

  const intensity  = intensitySlider.value / 100;
  const grainAmt   = grainSlider.value / 100;
  const vigAmt     = vignetteSlider.value / 100;
  const preset     = PRESETS[currentPreset];

  // ── Pixel-level color grading ──
  const imgData = ctx.getImageData(0, 0, w, h);
  const d       = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];

    // Black lift (faded look)
    r = r + preset.blackLift;
    g = g + preset.blackLift;
    b = b + preset.blackLift;

    // Highlights compress
    if (preset.highlights < 0) {
      const hl = -preset.highlights / 255;
      r = r * (1 - hl * (r / 255));
      g = g * (1 - hl * (g / 255));
      b = b * (1 - hl * (b / 255));
    }

    // Contrast (lerp with 128)
    const c = lerp(1, preset.contrast, intensity);
    r = (r - 128) * c + 128;
    g = (g - 128) * c + 128;
    b = (b - 128) * c + 128;

    // Saturation
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat  = lerp(1, preset.saturation, intensity);
    r = lum + (r - lum) * sat;
    g = lum + (g - lum) * sat;
    b = lum + (b - lum) * sat;

    // Color tint (per-channel multiplier)
    const tm = intensity;
    r = r * lerp(1, preset.rMul, tm);
    g = g * lerp(1, preset.gMul, tm);
    b = b * lerp(1, preset.bMul, tm);

    // Grain
    if (grainAmt > 0) {
      const noise = (Math.random() - 0.5) * grainAmt * 60;
      r += noise; g += noise; b += noise;
    }

    d[i]     = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }

  ctx.putImageData(imgData, 0, 0);

  // ── Chromatic aberration (simple channel-shift) ──
  if (preset.caStrength > 0 && intensity > 0) {
    const shift = Math.round(preset.caStrength * intensity * 2);
    if (shift > 0) {
      applyCA(w, h, shift);
    }
  }

  // ── Vignette ──
  if (vigAmt > 0) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${vigAmt * 0.75})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Polaroid white border ──
  if (currentPreset === 'polaroid' && intensity > 0.3) {
    const bw = Math.round(w * 0.04 * intensity);
    const bb = Math.round(w * 0.10 * intensity);
    ctx.strokeStyle = '#f8f4ec';
    ctx.lineWidth   = 0;
    ctx.fillStyle   = '#f8f4ec';
    ctx.fillRect(0,          0,  w,   bw);  // top
    ctx.fillRect(0,          0,  bw,  h);   // left
    ctx.fillRect(w - bw,     0,  bw,  h);   // right
    ctx.fillRect(0,     h - bb,  w,   bb);  // bottom (wider)
  }

  // ── Date stamp ──
  if (dateToggle.checked) {
    const date   = dateInput.value;   // "YYYY-MM-DD"
    const [y, m, d2] = date.split('-');
    const stamp  = `'${y.slice(2)} ${m} ${d2}`;
    const fs     = Math.round(w * 0.038);
    ctx.font     = `bold ${fs}px 'Courier New', monospace`;
    ctx.fillStyle = '#ff8800';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = fs * 0.3;
    ctx.textAlign   = 'right';
    ctx.fillText(stamp, w - Math.round(w * 0.03), h - Math.round(h * 0.03));
    ctx.shadowBlur  = 0;
    ctx.textAlign   = 'left';
  }
}

// Chromatic aberration: draw red channel shifted right, blue channel shifted left
function applyCA(w, h, shift) {
  const full = ctx.getImageData(0, 0, w, h);
  const d    = full.data;

  // Red channel: shift right by `shift` pixels
  const rShifted = ctx.getImageData(0, 0, w, h);
  const rd = rShifted.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src  = (y * w + x) * 4;
      const dest = (y * w + Math.min(x + shift, w - 1)) * 4;
      d[dest] = rd[src];
    }
  }

  // Blue channel: shift left by `shift` pixels
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src  = (y * w + x) * 4;
      const dest = (y * w + Math.max(x - shift, 0)) * 4;
      d[dest + 2] = rd[src + 2];
    }
  }

  ctx.putImageData(full, 0, 0);
}

// ── Download ───────────────────────────────────────────
document.getElementById('download-jpg').addEventListener('click', () => download('jpeg', 0.90));
document.getElementById('download-png').addEventListener('click', () => download('png', 1));

function download(type, quality) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), {
      href: url,
      download: `retro-snap.${type === 'jpeg' ? 'jpg' : 'png'}`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }, `image/${type}`, quality);
}

// ── Utils ──────────────────────────────────────────────
function clamp(v)          { return Math.max(0, Math.min(255, v)); }
function lerp(a, b, t)     { return a + (b - a) * t; }

// ── PWA ───────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js');
