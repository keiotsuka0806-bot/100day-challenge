'use strict';

const $ = (id) => document.getElementById(id);
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const norm = (s) => (s || '').normalize('NFKC').toLowerCase().replace(/[\s・･\-‐－—ー_/／()（）「」]/g, '');

/* ---------- ルーティング：ハブ or ジャンル ---------- */
function currentGenre() {
  const q = new URLSearchParams(location.search).get('g');
  const p = location.pathname.replace(/\//g, '');
  const g = q || p;
  return GENRES[g] ? g : null;
}
const GENRE = currentGenre();
const G = GENRE ? GENRES[GENRE] : null;

/* ---------- ハブ（横断コレクション） ---------- */
function genreCount(g) {
  try { return Object.keys(JSON.parse(localStorage.getItem(`transportdex_${g}`)) || {}).length; } catch { return 0; }
}
function renderHub() {
  $('hub').classList.remove('hidden');
  $('appRoot').classList.add('hidden');
  const total = Object.keys(GENRES).reduce((s, g) => s + genreCount(g), 0);
  $('hubTotal').innerHTML = `合計 <b>${total}</b> 種コレクション`;
  $('hubGenres').innerHTML = Object.values(GENRES).map((g) => `
    <a class="hub-card" href="?g=${g.key}">
      <span class="hub-emoji">${g.emoji}</span>
      <span class="hub-meta">
        <span class="hub-brand">${g.brand}</span>
        <span class="hub-tag">${escapeHtml(g.tagline)}</span>
      </span>
      <span class="hub-count">${genreCount(g.key)}<small>種</small></span>
    </a>`).join('');
}

/* ============================================================
   ここから下はジャンル別アプリ（G が現在のジャンル設定）
   ============================================================ */
let STORE_KEY, DATASET_KEY, dex, dexFilter;
const DATASET_MAX = 300;

function initGenreApp() {
  STORE_KEY = `transportdex_${G.key}`;
  DATASET_KEY = `transportdex_ds_${G.key}`;
  dex = loadDex();
  dexFilter = 'all';

  $('hub').classList.add('hidden');
  $('appRoot').classList.remove('hidden');
  document.title = `${G.brand} — ${G.tagline}`;
  $('brandMark').textContent = G.emoji;
  $('brandName').textContent = G.brand;
  $('huntLead').textContent = G.huntLead;
  $('huntSub').textContent = G.huntSub;

  // フィルタ：図鑑（チャプターのある種別）を前面に、最後にマイ記録。
  // 図鑑タブを開いたら最初の図鑑（マスター）がいきなり見えるよう、既定を最初のチャプター種別にする。
  const firstChapterCat = (G.categories.find((c) => chapterFor(c.id)) || {}).id;
  dexFilter = firstChapterCat || 'all';
  const catBtns = G.categories.map((c) => {
    const label = chapterFor(c.id) ? `📕 ${escapeHtml(c.label)}` : `${c.emoji} ${escapeHtml(c.label)}`;
    return `<button class="filter-btn" data-cat="${c.id}">${label}</button>`;
  }).join('');
  $('dexFilters').innerHTML = catBtns + `<button class="filter-btn" data-cat="all">📸 マイ記録</button>`;
  document.querySelectorAll('.filter-btn').forEach((x) => x.classList.toggle('active', x.dataset.cat === dexFilter));
  $('dexFilters').addEventListener('click', (e) => {
    const b = e.target.closest('.filter-btn'); if (!b) return;
    dexFilter = b.dataset.cat;
    document.querySelectorAll('.filter-btn').forEach((x) => x.classList.toggle('active', x === b));
    renderDex();
  });

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));
  $('fileInput').addEventListener('change', onFile);
  updateChips();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

const catEmoji = (id) => (G.categories.find((c) => c.id === id) || {}).emoji || '❓';
const catLabel = (id) => (G.categories.find((c) => c.id === id) || {}).label || '';
const chapterFor = (catId) => G.chapters.find((ch) => ch.category === catId);
const stars = (r) => '★'.repeat(r) + '☆'.repeat(5 - r);
const nameOf = (e) => G.nameFields.map((f) => e[f]).filter(Boolean).join(' ');
const subOf = (e) => G.fields.filter((f) => !G.nameFields.includes(f.id)).map((f) => e[f.id]).filter(Boolean).join('｜');
const speciesKey = (e) => G.nameFields.map((f) => norm(e[f] || '')).join('|');
const matchSeries = (key) => key.split('|').pop() || '';

/* ---------- データ ---------- */
function loadDex() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function saveDex(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); return true; } catch { return false; } }
function loadDataset() { try { return JSON.parse(localStorage.getItem(DATASET_KEY)) || []; } catch { return []; } }
function saveDataset(ds) { try { localStorage.setItem(DATASET_KEY, JSON.stringify(ds)); } catch { /* ignore */ } }

/* ---------- 画面遷移 ---------- */
function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  $(`view-${name}`).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'dex') renderDex();
}

/* ---------- 撮影 → 記録フォーム ---------- */
async function onFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try { openRecordForm(await resizeImage(file)); } catch { alert('画像を読み込めませんでした。'); }
}
function resizeImage(file, max = 1024, q = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; }; reader.onerror = reject;
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = reject; reader.readAsDataURL(file);
  });
}

/* ---------- ぼかし（手動なぞり主役） ---------- */
function applyBlur(dataUrl, regions) {
  return new Promise((resolve) => {
    if (!regions || !regions.length) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      const W = img.width, H = img.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const M = 0.03;
      regions.forEach((p) => {
        const x = Math.max(0, p.x - M) * W, y = Math.max(0, p.y - M) * H;
        const w = Math.min(1, p.w + M * 2) * W, h = Math.min(1, p.h + M * 2) * H;
        pixelate(ctx, x, y, Math.min(w, W - x), Math.min(h, H - y), 5);
      });
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl); img.src = dataUrl;
  });
}
function pixelate(ctx, x, y, w, h, blocks = 6) {
  if (w <= 1 || h <= 1) return;
  const sw = Math.max(1, Math.round(w / Math.max(4, w / blocks))), sh = Math.max(1, Math.round(h / Math.max(4, h / blocks)));
  const t = document.createElement('canvas'); t.width = sw; t.height = sh;
  t.getContext('2d').drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, sw, sh, x, y, w, h); ctx.imageSmoothingEnabled = true;
}
function makeThumb(dataUrl, max = 240, q = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h); resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => resolve(null); img.src = dataUrl;
  });
}
function showScan(on) { $('scanOverlay').classList.toggle('hidden', !on); }

/* ---------- オンデバイス埋め込み（フライホイール） ---------- */
function computeEmbedding(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const N = 16; const c = document.createElement('canvas'); c.width = N; c.height = N;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data; const v = [];
      for (let i = 0; i < d.length; i += 4) v.push(d[i], d[i + 1], d[i + 2]);
      const mean = v.reduce((a, b) => a + b, 0) / v.length; let nrm = 0;
      for (let i = 0; i < v.length; i++) { v[i] -= mean; nrm += v[i] * v[i]; }
      nrm = Math.sqrt(nrm) || 1;
      for (let i = 0; i < v.length; i++) v[i] = +(v[i] / nrm).toFixed(3);
      resolve(v);
    };
    img.onerror = () => resolve(null); img.src = dataUrl;
  });
}
const cosine = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
function findSimilar(emb, topN = 3, threshold = 0.25) {
  if (!emb) return [];
  const best = new Map();
  for (const e of loadDataset()) {
    if (!e.emb || e.emb.length !== emb.length) continue;
    const score = cosine(emb, e.emb); const cur = best.get(e.key);
    if (!cur || score > cur.score) best.set(e.key, { ...e, score });
  }
  return [...best.values()].filter((m) => m.score >= threshold).sort((a, b) => b.score - a.score).slice(0, topN);
}

/* ---------- 記録フォーム（手入力主役） ---------- */
let draft = null;
let simMatches = [];
async function openRecordForm(dataUrl) {
  draft = { photo: dataUrl, photoOriginal: dataUrl, regions: [], category: G.defaultCategory, rarity: 2, emb: null, rec: {} };
  simMatches = [];
  renderRecordForm();
  draft.emb = await computeEmbedding(dataUrl);
  const m = findSimilar(draft.emb);
  if (m.length) renderSuggestions(m);
}
function renderRecordForm() {
  const fieldsHtml = G.fields.map((f) =>
    `<label class="field">${escapeHtml(f.label)}<input id="f_${f.id}" placeholder="${escapeHtml(f.ph || '')}" /></label>`).join('');
  const catHtml = G.categories.map((c) => `<button type="button" class="cat-btn" data-cat="${c.id}">${c.emoji} ${escapeHtml(c.label)}</button>`).join('');
  $('resultCard').innerHTML = `
    <div class="result-photo"><img id="resultPhoto" src="${draft.photo}" alt="撮った写真" /></div>
    <p class="plate-hint">${G.blurHint}</p>
    <h2 class="form-title">自分で記録する</h2>
    <div class="sim-box hidden" id="simBox"></div>
    <div class="cat-select" id="catSelect">${catHtml}</div>
    ${fieldsHtml}
    <div class="rarity-select">レア度<span id="rarityStars" class="rarity-stars-pick"></span></div>
    <button type="button" class="btn-ai" id="btnAiHint">🤖 わからない時：AIに推測してもらう（任意）</button>
    <p class="ai-hint-note hidden" id="aiHintNote"></p>
    <label class="keep-photo"><input type="checkbox" id="keepPhoto" checked /> この写真を図鑑にも残す</label>
    <div class="result-actions">
      <button class="btn-primary" id="btnRegister">📖 図鑑に登録</button>
      <button class="btn-ghost" id="btnCancelRec">やめる</button>
    </div>`;
  $('resultModal').classList.remove('hidden');
  renderCatButtons(); renderRarityPick();
  $('catSelect').addEventListener('click', (e) => { const b = e.target.closest('.cat-btn'); if (!b) return; draft.category = b.dataset.cat; renderCatButtons(); });
  $('btnAiHint').addEventListener('click', askAiHint);
  $('btnRegister').addEventListener('click', registerFromForm);
  $('btnCancelRec').addEventListener('click', () => { draft = null; $('resultModal').classList.add('hidden'); });
  const img = $('resultPhoto');
  img.addEventListener('pointerdown', onPhotoDown); img.addEventListener('pointerup', onPhotoUp);
}
function renderCatButtons() { document.querySelectorAll('#catSelect .cat-btn').forEach((b) => b.classList.toggle('active', b.dataset.cat === draft.category)); }
function renderRarityPick() {
  $('rarityStars').innerHTML = [1, 2, 3, 4, 5].map((i) => `<span class="star ${i <= draft.rarity ? 'on' : ''}" data-r="${i}">★</span>`).join('');
  $('rarityStars').querySelectorAll('.star').forEach((s) => s.addEventListener('click', () => { draft.rarity = +s.dataset.r; renderRarityPick(); }));
}
function renderSuggestions(matches) {
  simMatches = matches; const box = $('simBox'); if (!box) return;
  box.innerHTML = `<p class="sim-title">💡 あなたの図鑑で見た目が似ているもの（端末内・無料の参考）。同じならタップで入力：</p>` +
    matches.map((m, i) => `<button type="button" class="sim-btn" data-i="${i}">${escapeHtml(m.name || '')}<span class="sim-score">これかも？</span></button>`).join('');
  box.classList.remove('hidden');
  box.querySelectorAll('.sim-btn').forEach((b) => b.addEventListener('click', () => applySuggestion(simMatches[+b.dataset.i])));
}
function applySuggestion(m) {
  (m.rec ? Object.entries(m.rec) : []).forEach(([k, v]) => { const el = $(`f_${k}`); if (el) el.value = v; });
  if (m.category) { draft.category = m.category; renderCatButtons(); }
}

let blurStart = null;
function onPhotoDown(e) { const r = e.currentTarget.getBoundingClientRect(); blurStart = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
async function onPhotoUp(e) {
  if (!blurStart) return; const img = e.currentTarget; const r = img.getBoundingClientRect();
  const ex = (e.clientX - r.left) / r.width, ey = (e.clientY - r.top) / r.height;
  let x = Math.min(blurStart.x, ex), y = Math.min(blurStart.y, ey), w = Math.abs(ex - blurStart.x), h = Math.abs(ey - blurStart.y);
  blurStart = null;
  if (w < 0.04 || h < 0.04) { const fw = 0.16, fh = 0.12; x = Math.max(0, ex - fw / 2); y = Math.max(0, ey - fh / 2); w = fw; h = fh; }
  draft.regions.push({ x: Math.max(0, x), y: Math.max(0, y), w, h });
  draft.photo = await applyBlur(draft.photoOriginal, draft.regions); img.src = draft.photo;
}

/* ---------- AI任意ヒント ---------- */
let demoMode = false;
async function askAiHint() {
  showScan(true);
  let r; const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch('/api/identify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: draft.photoOriginal, genre: G.key }), signal: ctrl.signal });
    if (res.status === 503) { demoMode = true; r = null; showScan(false); clearTimeout(timer); showHint('🤖 AI推測は未設定です（デモ）。手入力で記録できます。'); return; }
    if (res.status === 429) { showScan(false); clearTimeout(timer); alert('少し混み合っています。数秒おいてどうぞ。'); return; }
    if (!res.ok) { showScan(false); clearTimeout(timer); alert('AIの推測に失敗しました。手入力で記録できます。'); return; }
    r = await res.json();
  } catch { showScan(false); clearTimeout(timer); alert('AIの推測に失敗しました。手入力で記録できます。'); return; }
  clearTimeout(timer); showScan(false);
  if (!r || r.ok === false) { showHint('🤖 AIは対象を見つけられませんでした。手入力で記録してください。'); return; }
  G.fields.forEach((f) => { if (r[f.id]) { const el = $(`f_${f.id}`); if (el) el.value = String(r[f.id]).slice(0, 40); } });
  if (r.category && G.categories.some((c) => c.id === r.category)) { draft.category = r.category; renderCatButtons(); }
  if (r.rarity) { draft.rarity = Math.min(5, Math.max(1, r.rarity)); renderRarityPick(); }
  if (Array.isArray(r.redact) && r.redact.length) { draft.regions = draft.regions.concat(r.redact); draft.photo = await applyBlur(draft.photoOriginal, draft.regions); const img = $('resultPhoto'); if (img) img.src = draft.photo; }
  showHint(`🤖 AIの推測を入れました（確度${r.confidence ?? '?'}%・<b>外していることがあります</b>）。${escapeHtml(G.aiNote)}`);
}
function showHint(html) { const n = $('aiHintNote'); n.innerHTML = html; n.classList.remove('hidden'); }

/* ---------- 登録 ---------- */
async function registerFromForm() {
  const rec = {};
  G.fields.forEach((f) => { rec[f.id] = $(`f_${f.id}`).value.trim().slice(0, 40); });
  const req = G.fields.find((f) => f.required);
  if (req && !rec[req.id]) { alert(`${req.label}を入力してください（わからない時は「AIに推測」も使えます）。`); return; }

  const entry = { ...rec, category: draft.category, rarity: draft.rarity };
  const key = speciesKey(entry);
  const isNew = !dex[key];
  const now = Date.now();
  const keepPhoto = $('keepPhoto') && $('keepPhoto').checked;
  const thumb = keepPhoto && draft.photo ? await makeThumb(draft.photo) : null;

  if (dex[key]) {
    const e = dex[key]; e.count += 1; e.lastSeen = now;
    G.fields.forEach((f) => { if (!e[f.id] && rec[f.id]) e[f.id] = rec[f.id]; });
    if (thumb) e.photo = thumb;
  } else {
    dex[key] = { ...entry, count: 1, firstSeen: now, lastSeen: now, photo: thumb || null };
  }
  if (!saveDex(dex)) {
    if (dex[key].photo) dex[key].photo = null;
    if (!saveDex(dex)) Object.values(dex).forEach((e) => { e.photo = null; });
    const ok = saveDex(dex);
    alert(ok ? '写真の保存容量がいっぱいです。写真は記録できませんでしたが、図鑑データは保存しました。' : '保存容量がいっぱいで記録できませんでした。不要な記録を減らしてからお試しください。');
  }
  // フライホイール：埋め込み＋ラベルを貯める（写真そのものは貯めない）
  if (draft.emb) {
    const ds = loadDataset();
    ds.push({ emb: draft.emb, key, name: nameOf(entry), category: draft.category, rec });
    while (ds.length > DATASET_MAX) ds.shift();
    saveDataset(ds);
  }
  draft = null; $('resultModal').classList.add('hidden'); updateChips(); switchView('dex');
  if (isNew) triggerReveal(entry.rarity);
}

/* ---------- レア演出 ---------- */
function triggerReveal(rarity) {
  const el = $('reveal'); el.className = `reveal rarity-${rarity}`;
  const emojis = rarity >= 5 ? ['💎', '🏆', '⚡', '✨', '👑'] : ['✨', '⭐', '🎉']; let burst = '';
  for (let i = 0; i < (rarity >= 5 ? 24 : 14); i++) burst += `<span style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.5}s;animation-duration:${1.2 + Math.random() * 0.8}s">${emojis[i % emojis.length]}</span>`;
  el.innerHTML = `<div class="reveal-flash"></div><div class="sparkles">${burst}</div>`;
  el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 1800);
}

/* ---------- 図鑑描画 ---------- */
function personalCardHtml(e) {
  const sub = subOf(e);
  return `
    <div class="dex-card rarity-${e.rarity}">
      <div class="dex-thumb">
        ${e.photo ? `<img src="${e.photo}" alt="" loading="lazy" />` : `<span class="dex-emoji">${catEmoji(e.category)}</span>`}
        <span class="dex-cat-badge">${catEmoji(e.category)}</span>
        ${e.count > 1 ? `<span class="dex-count">×${e.count}</span>` : ''}
      </div>
      <div class="dex-stars">${stars(e.rarity)}</div>
      <div class="dex-name">${escapeHtml(nameOf(e))}</div>
      ${sub ? `<div class="dex-gen">${escapeHtml(sub)}</div>` : ''}
    </div>`;
}
function isInMaster(series, masters) { for (const m of masters) for (const mk of m.matchKeys) if (series.includes(mk)) return true; return false; }
function caughtMap(masters, category) {
  const map = {};
  for (const [k, e] of Object.entries(dex)) {
    if (category && e.category !== category) continue;
    const series = matchSeries(k); let best = null;
    for (const m of masters) for (const mk of m.matchKeys) if (series.includes(mk) && (!best || mk.length > best.len)) best = { no: m.no, len: mk.length, entry: e };
    if (best && !map[best.no]) map[best.no] = best.entry;
  }
  return map;
}
function renderMasterDex(ch) {
  const caught = caughtMap(ch.masters, ch.category);
  const got = Object.keys(caught).length, total = ch.masters.length;
  $('masterHead').classList.remove('hidden');
  $('masterHead').innerHTML = `
    <div class="master-title">${ch.title}　<b>${got} / ${total}</b></div>
    <div class="master-bar"><div class="master-bar-fill" style="width:${Math.round(got / total * 100)}%"></div></div>
    <p class="master-sub">未取得は「？？？」。レア度を頼りに、まだ見ぬものを探しに行こう。</p>`;
  $('dexEmpty').classList.add('hidden');
  const masterHtml = ch.masters.map((m) => {
    const e = caught[m.no];
    if (e) return `
      <div class="dex-card rarity-${m.rarity}">
        <div class="dex-thumb">${e.photo ? `<img src="${e.photo}" alt="" loading="lazy" />` : `<span class="dex-emoji">${catEmoji(ch.category)}</span>`}<span class="dex-no">No.${m.no}</span></div>
        <div class="dex-stars">${stars(m.rarity)}</div>
        <div class="dex-name">${escapeHtml(m.name)}</div>
        <div class="dex-gen">${escapeHtml(m.nickname || m.operator || '')}</div>
      </div>`;
    return `
      <div class="dex-card silhouette">
        <div class="dex-thumb"><span class="dex-silhouette">？</span><span class="dex-no">No.${m.no}</span></div>
        <div class="dex-stars dim">${stars(m.rarity)}</div>
        <div class="dex-name">？？？</div><div class="dex-gen">未取得</div>
      </div>`;
  }).join('');
  const others = Object.entries(dex)
    .filter(([k, e]) => e.category === ch.category && !isInMaster(matchSeries(k), ch.masters))
    .sort((a, b) => b[1].rarity - a[1].rarity || b[1].lastSeen - a[1].lastSeen);
  const othersHtml = others.length ? `<div class="dex-others-head">— その他あなたの記録（図鑑外） —</div>` + others.map(([, e]) => personalCardHtml(e)).join('') : '';
  $('dexGrid').innerHTML = masterHtml + othersHtml;
}
function renderDex() {
  updateChips();
  const isAll = dexFilter === 'all';
  $('achievements').classList.toggle('hidden', !isAll);
  if (isAll) renderAchievements();
  if (!isAll) {
    const ch = chapterFor(dexFilter);
    if (ch) { renderMasterDex(ch); return; }
  }
  $('masterHead').classList.add('hidden');
  const entries = Object.entries(dex)
    .filter(([, e]) => isAll || e.category === dexFilter)
    .sort((a, b) => b[1].rarity - a[1].rarity || b[1].lastSeen - a[1].lastSeen);
  $('dexEmpty').classList.toggle('hidden', entries.length > 0);
  $('dexGrid').innerHTML = entries.map(([, e]) => personalCardHtml(e)).join('');
}
function renderAchievements() {
  const vals = Object.values(dex); const n = vals.length;
  const list = [
    { emoji: '🎯', label: '初ゲット', done: n >= 1 },
    { emoji: '💎', label: 'レアハンター', done: vals.some((e) => e.rarity >= 4) },
    { emoji: '📚', label: '10種コレクター', done: n >= 10 },
    { emoji: '🏆', label: '25種コレクター', done: n >= 25 },
  ];
  $('achievements').innerHTML = list.map((a) => `<span class="ach ${a.done ? 'on' : ''}" title="${a.label}">${a.emoji}<small>${a.label}</small></span>`).join('');
}
function updateChips() {
  const vals = Object.values(dex);
  $('chipSpecies').textContent = `${vals.length}${G.countUnit.species}`;
  $('chipTotal').textContent = `${vals.reduce((s, e) => s + e.count, 0)}${G.countUnit.total}`;
}

/* ---------- 起動（全宣言の後に実行：TDZ回避） ---------- */
if (!G) renderHub(); else initGenreApp();
