'use strict';

const STORE_KEY = 'traindex_v1';
const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ---------- 図鑑データ（端末内） ---------- */
function loadDex() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
function saveDex(dex) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(dex)); return true; }
  catch { return false; }
}
let dex = loadDex();

// 表記ゆれを吸収して同じ車両を別物にしない（全角→半角・記号/中黒/長音/括弧を除去）
const norm = (s) => (s || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s・･\-‐－—ー_/／()（）「」]/g, '');
const speciesKey = (operator, series) => `${norm(operator)}|${norm(series)}`;

const catEmoji = (c) => (c === 'shinkansen' ? '🚄' : c === 'tram' ? '🚋' : '🚃');
const catLabel = (c) => (c === 'shinkansen' ? '新幹線' : c === 'tram' ? '路面電車' : '在来線・私鉄');
const stars = (r) => '★'.repeat(r) + '☆'.repeat(5 - r);
const debutText = (d) => (d ? (/^\d{4}$/.test(d) ? `${d}年デビュー` : d) : '');

let draft = null; // 記録中の1両（撮影写真＋手入力＋任意AI候補）

/* ---------- 画面遷移 ---------- */
function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  $(`view-${name}`).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.view === name));
  if (name === 'dex') renderDex();
}
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => switchView(t.dataset.view)));

/* ---------- 撮影 → リサイズ → 記録フォーム ---------- */
$('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const dataUrl = await resizeImage(file);
    openRecordForm(dataUrl);
  } catch {
    alert('画像を読み込めませんでした。');
  }
});

function resizeImage(file, max = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- 顔ぼかし（写り込んだ人の顔） ---------- */
function applyFaceBlur(dataUrl, faces) {
  return new Promise((resolve) => {
    if (!faces || faces.length === 0) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      const W = img.width, H = img.height;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const M = 0.03;
      faces.forEach((p) => {
        const x = Math.max(0, (p.x - M)) * W;
        const y = Math.max(0, (p.y - M)) * H;
        const w = Math.min(1, p.w + M * 2) * W;
        const h = Math.min(1, p.h + M * 2) * H;
        pixelate(ctx, x, y, Math.min(w, W - x), Math.min(h, H - y), 5);
      });
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
function pixelate(ctx, x, y, w, h, blocks = 7) {
  if (w <= 1 || h <= 1) return;
  const sw = Math.max(1, Math.round(w / Math.max(4, w / blocks)));
  const sh = Math.max(1, Math.round(h / Math.max(4, h / blocks)));
  const tmp = document.createElement('canvas');
  tmp.width = sw; tmp.height = sh;
  tmp.getContext('2d').drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
  ctx.imageSmoothingEnabled = true;
}
function makeThumb(dataUrl, max = 240, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
function showScan(on) { $('scanOverlay').classList.toggle('hidden', !on); }

/* ---------- 記録フォーム（手入力が主役） ---------- */
async function openRecordForm(dataUrl) {
  draft = { photo: dataUrl, photoOriginal: dataUrl, faces: [], category: 'local', rarity: 2, trivia: '', aiUsed: false };
  renderRecordForm();
}

function renderRecordForm() {
  const d = draft;
  $('resultCard').innerHTML = `
    ${d.photo
      ? `<div class="result-photo"><img id="resultPhoto" src="${d.photo}" alt="撮った写真" /></div>
         <p class="plate-hint">⚠️ 写り込んだ人の顔は、隠したい所を写真で<b>指でなぞって</b>隠してください。</p>`
      : ''}
    <h2 class="form-title">自分で記録する</h2>
    <div class="cat-select" id="catSelect">
      <button type="button" class="cat-btn" data-cat="shinkansen">🚄 新幹線</button>
      <button type="button" class="cat-btn" data-cat="local">🚃 在来線・私鉄</button>
      <button type="button" class="cat-btn" data-cat="tram">🚋 路面電車</button>
    </div>
    <label class="field">事業者<input id="fOperator" placeholder="例: JR東日本 / 京急 / 広島電鉄" /></label>
    <label class="field">形式・系列<input id="fSeries" placeholder="例: E5系 / 京急2100形 / N700S" /></label>
    <label class="field">種別<input id="fKind" placeholder="例: 新幹線 / 特急 / 通勤型 / 路面電車" /></label>
    <label class="field">登場年<input id="fDebut" placeholder="例: 2011 / 2007– / 国鉄時代" /></label>
    <div class="rarity-select">レア度<span id="rarityStars" class="rarity-stars-pick"></span></div>
    <button type="button" class="btn-ai" id="btnAiHint">🤖 わからない時：AIに推測してもらう（任意）</button>
    <p class="ai-hint-note hidden" id="aiHintNote"></p>
    <label class="keep-photo"><input type="checkbox" id="keepPhoto" checked /> この写真を図鑑にも残す</label>
    <div class="result-actions">
      <button class="btn-primary" id="btnRegister">📖 図鑑に登録</button>
      <button class="btn-ghost" id="btnCancelRec">やめる</button>
    </div>`;
  $('resultModal').classList.remove('hidden');

  renderCatButtons();
  renderRarityPick();

  $('catSelect').addEventListener('click', (e) => {
    const b = e.target.closest('.cat-btn');
    if (!b) return;
    draft.category = b.dataset.cat;
    renderCatButtons();
  });
  $('btnAiHint').addEventListener('click', askAiHint);
  $('btnRegister').addEventListener('click', registerFromForm);
  $('btnCancelRec').addEventListener('click', () => { draft = null; $('resultModal').classList.add('hidden'); });
  const photoEl = $('resultPhoto');
  if (photoEl) {
    photoEl.addEventListener('pointerdown', onPhotoPointerDown);
    photoEl.addEventListener('pointerup', onPhotoPointerUp);
  }
}

function renderCatButtons() {
  document.querySelectorAll('#catSelect .cat-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.cat === draft.category));
}
function renderRarityPick() {
  const el = $('rarityStars');
  el.innerHTML = [1, 2, 3, 4, 5].map((i) =>
    `<span class="star ${i <= draft.rarity ? 'on' : ''}" data-r="${i}">★</span>`).join('');
  el.querySelectorAll('.star').forEach((s) =>
    s.addEventListener('click', () => { draft.rarity = +s.dataset.r; renderRarityPick(); }));
}

// 写真を「なぞって」隠す（手動）
let blurStart = null;
function onPhotoPointerDown(e) {
  const r = e.currentTarget.getBoundingClientRect();
  blurStart = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
}
async function onPhotoPointerUp(e) {
  if (!blurStart) return;
  const img = e.currentTarget;
  const r = img.getBoundingClientRect();
  const ex = (e.clientX - r.left) / r.width, ey = (e.clientY - r.top) / r.height;
  let x = Math.min(blurStart.x, ex), y = Math.min(blurStart.y, ey);
  let w = Math.abs(ex - blurStart.x), h = Math.abs(ey - blurStart.y);
  blurStart = null;
  if (w < 0.04 || h < 0.04) {
    const fw = 0.12, fh = 0.14;
    x = Math.max(0, ex - fw / 2); y = Math.max(0, ey - fh / 2); w = fw; h = fh;
  }
  draft.faces.push({ x: Math.max(0, x), y: Math.max(0, y), w, h });
  draft.photo = await applyFaceBlur(draft.photoOriginal, draft.faces);
  img.src = draft.photo;
}

/* ---------- AI任意ヒント（押した人だけ／断定しない） ---------- */
let demoMode = false;
async function askAiHint() {
  showScan(true);
  let r;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch('/api/identify-train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: draft.photoOriginal }),
      signal: ctrl.signal,
    });
    if (res.status === 503) { demoMode = true; r = mockIdentify(); }
    else if (res.status === 429) { showScan(false); clearTimeout(timer); alert('少し混み合っています。数秒おいて、もう一度どうぞ。'); return; }
    else if (!res.ok) { showScan(false); clearTimeout(timer); alert('AIの推測に失敗しました。手入力で記録できます。'); return; }
    else r = await res.json();
  } catch {
    showScan(false); clearTimeout(timer);
    alert('AIの推測に失敗しました。手入力で記録できます。');
    return;
  }
  clearTimeout(timer);
  showScan(false);

  if (r.isTrain === false) {
    showHint('🤖 AIは鉄道車両を見つけられませんでした。手入力で記録してください。');
    return;
  }
  // 候補としてフォームに反映（断定しない・ユーザーが確認/修正）
  if (r.operator) $('fOperator').value = r.operator;
  if (r.series) $('fSeries').value = r.series;
  if (r.kind) $('fKind').value = r.kind;
  if (r.debut) $('fDebut').value = r.debut;
  if (r.category) { draft.category = r.category; renderCatButtons(); }
  if (r.rarity) { draft.rarity = r.rarity; renderRarityPick(); }
  draft.trivia = r.trivia || '';
  if (Array.isArray(r.faces) && r.faces.length) {
    draft.faces = draft.faces.concat(r.faces);
    draft.photo = await applyFaceBlur(draft.photoOriginal, draft.faces);
    const img = $('resultPhoto'); if (img) img.src = draft.photo;
  }
  updateModeNote();
  showHint(`🤖 AIの推測を入れました（確度${r.confidence ?? '?'}%・<b>外していることがあります</b>）。形式（N700とN700Sなど）は特に間違いやすいので、必ず確認して直してください。`);
}
function showHint(html) {
  const note = $('aiHintNote');
  note.innerHTML = html;
  note.classList.remove('hidden');
}

/* ---------- 登録 ---------- */
async function registerFromForm() {
  const operator = $('fOperator').value.trim().slice(0, 24);
  const series = $('fSeries').value.trim().slice(0, 40);
  if (!series) { alert('形式・系列を入力してください（わからない時は「AIに推測」も使えます）。'); return; }
  const r = {
    operator, series,
    kind: $('fKind').value.trim().slice(0, 24),
    debut: $('fDebut').value.trim().slice(0, 24),
    category: draft.category, rarity: draft.rarity, trivia: draft.trivia,
  };
  const key = speciesKey(operator, series);
  const isNew = !dex[key];
  const now = Date.now();
  const keepPhoto = $('keepPhoto') ? $('keepPhoto').checked : false;
  const thumb = keepPhoto && draft.photo ? await makeThumb(draft.photo) : null;

  if (dex[key]) {
    const e = dex[key];
    e.count += 1; e.lastSeen = now;
    if (!e.kind && r.kind) e.kind = r.kind;
    if (!e.debut && r.debut) e.debut = r.debut;
    if (thumb) e.photo = thumb;
  } else {
    dex[key] = {
      operator, series, category: r.category, kind: r.kind, debut: r.debut,
      rarity: r.rarity, trivia: r.trivia, count: 1, firstSeen: now, lastSeen: now,
      photo: thumb || null,
    };
  }
  if (!saveDex(dex)) {
    if (dex[key].photo) dex[key].photo = null;
    if (!saveDex(dex)) Object.values(dex).forEach((e) => { e.photo = null; });
    const saved = saveDex(dex);
    alert(saved
      ? '写真の保存容量がいっぱいです。写真は記録できませんでしたが、図鑑データは保存しました。'
      : '保存容量がいっぱいで記録できませんでした。図鑑の不要な形式を減らしてからお試しください。');
  }
  draft = null;
  $('resultModal').classList.add('hidden');
  updateChips();
  switchView('dex');
  if (isNew) triggerReveal(r.rarity);
}

/* ---------- レア演出 ---------- */
function triggerReveal(rarity) {
  const el = $('reveal');
  el.className = `reveal rarity-${rarity}`;
  const emojis = rarity >= 5 ? ['💎', '🏆', '⚡', '✨', '👑'] : ['✨', '⭐', '🎉'];
  let burst = '';
  for (let i = 0; i < (rarity >= 5 ? 24 : 14); i++) {
    const e = emojis[i % emojis.length];
    burst += `<span style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.5}s;animation-duration:${1.2 + Math.random() * 0.8}s">${e}</span>`;
  }
  el.innerHTML = `<div class="reveal-flash"></div><div class="sparkles">${burst}</div>`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 1800);
}

/* ---------- 図鑑描画 ---------- */
let dexFilter = 'all';
$('dexFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  dexFilter = btn.dataset.cat;
  document.querySelectorAll('.filter-btn').forEach((b) =>
    b.classList.toggle('active', b === btn));
  renderDex();
});

function renderDex() {
  updateChips();
  renderAchievements();
  const entries = Object.entries(dex)
    .filter(([, e]) => dexFilter === 'all' || e.category === dexFilter)
    .sort((a, b) => b[1].rarity - a[1].rarity || b[1].lastSeen - a[1].lastSeen);

  const grid = $('dexGrid');
  $('dexEmpty').classList.toggle('hidden', Object.keys(dex).length > 0);

  grid.innerHTML = entries.map(([, e]) => {
    const sub = [e.kind, debutText(e.debut)].filter(Boolean).join('｜');
    return `
      <div class="dex-card rarity-${e.rarity}">
        <div class="dex-thumb">
          ${e.photo ? `<img src="${e.photo}" alt="" loading="lazy" />` : `<span class="dex-emoji">${catEmoji(e.category)}</span>`}
          <span class="dex-cat-badge">${catEmoji(e.category)}</span>
          ${e.count > 1 ? `<span class="dex-count">×${e.count}</span>` : ''}
        </div>
        <div class="dex-stars">${stars(e.rarity)}</div>
        <div class="dex-name">${escapeHtml(e.operator || '')}<br>${escapeHtml(e.series)}</div>
        ${sub ? `<div class="dex-gen">${escapeHtml(sub)}</div>` : ''}
      </div>`;
  }).join('');
}

function renderAchievements() {
  const vals = Object.values(dex);
  const species = vals.length;
  const list = [
    { emoji: '🎯', label: '初ゲット', done: species >= 1 },
    { emoji: '🚄', label: '新幹線ハンター', done: vals.some((e) => e.category === 'shinkansen') },
    { emoji: '🚋', label: '路面電車ハンター', done: vals.some((e) => e.category === 'tram') },
    { emoji: '💎', label: 'レアハンター', done: vals.some((e) => e.rarity >= 4) },
    { emoji: '📚', label: '10形式コレクター', done: species >= 10 },
  ];
  $('achievements').innerHTML = list.map((a) =>
    `<span class="ach ${a.done ? 'on' : ''}" title="${a.label}">${a.emoji}<small>${a.label}</small></span>`
  ).join('');
}

function updateChips() {
  const vals = Object.values(dex);
  $('chipSpecies').textContent = `${vals.length}形式`;
  $('chipTotal').textContent = `${vals.reduce((s, e) => s + e.count, 0)}回`;
}

function updateModeNote() {
  const note = $('modeNote');
  if (demoMode) {
    note.textContent = '⚠️ デモモード（AI鍵が未設定のため、AI推測はランダムな見本です）';
    note.classList.remove('hidden');
  } else {
    note.classList.add('hidden');
  }
}

/* ---------- モック（鍵なしデモ用のAI推測） ---------- */
const MOCK = [
  { category: 'shinkansen', operator: 'JR東日本', series: 'E5系「はやぶさ」', kind: '新幹線', debut: '2011', rarity: 1, trivia: '営業最高320km/hを誇る東北新幹線の主力。' },
  { category: 'shinkansen', operator: 'JR東海', series: 'N700S', kind: '新幹線', debut: '2020', rarity: 2, trivia: '"S"はSupreme。東海道新幹線の最新形式。' },
  { category: 'local', operator: '京急', series: '2100形', kind: '快特用', debut: '1998', rarity: 3, trivia: '発車時の"ドレミファ"音階モーターで有名。' },
  { category: 'local', operator: '国鉄', series: '103系', kind: '通勤型', debut: '1963', rarity: 5, trivia: '高度成長期を支えた通勤電車の代名詞。' },
  { category: 'tram', operator: '広島電鉄', series: '5100形「グリーンムーバーmax」', kind: '路面電車', debut: '2005', rarity: 3, trivia: '国産初の本格的な超低床路面電車。' },
];
function mockIdentify() {
  const base = MOCK[Math.floor(Math.random() * MOCK.length)];
  return { isTrain: true, confidence: 60 + Math.floor(Math.random() * 35), faces: [], ...base };
}

/* ---------- 起動 ---------- */
updateChips();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
