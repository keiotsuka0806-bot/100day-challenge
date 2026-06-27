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

/* ---------- データフライホイール（端末内・埋め込みのみ保持＝顔写真は貯めない） ----------
   記録のたびに「画像の特徴ベクトル＋ラベル」を貯め、撮った写真をこれと類似検索して
   "あなたの図鑑で似ている形式"を無料・オフラインで提示する（LLMより前に）。 */
const DATASET_KEY = 'traindex_dataset_v1';
const DATASET_MAX = 300;
function loadDataset() { try { return JSON.parse(localStorage.getItem(DATASET_KEY)) || []; } catch { return []; } }
function saveDataset(ds) { try { localStorage.setItem(DATASET_KEY, JSON.stringify(ds)); } catch { /* 容量超過は無視 */ } }

// 画像を16x16 RGBに縮小→平均除去→L2正規化した素朴な埋め込み（依存ゼロ・軽量）。
// 重いCLIP等は将来差し替え可能なように、この関数だけ取り替えれば済む形にしている。
function computeEmbedding(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const N = 16;
      const c = document.createElement('canvas');
      c.width = N; c.height = N;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      const v = [];
      for (let i = 0; i < d.length; i += 4) { v.push(d[i], d[i + 1], d[i + 2]); }
      const mean = v.reduce((s, x) => s + x, 0) / v.length;
      let nrm = 0;
      for (let i = 0; i < v.length; i++) { v[i] -= mean; nrm += v[i] * v[i]; }
      nrm = Math.sqrt(nrm) || 1;
      for (let i = 0; i < v.length; i++) v[i] = +(v[i] / nrm).toFixed(3);
      resolve(v);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
const cosine = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// 自分の過去ラベルから似ている形式を返す（形式ごとに最良スコアでまとめ、上位を返す）
function findSimilar(emb, topN = 3, threshold = 0.25) {
  if (!emb) return [];
  const best = new Map();
  for (const e of loadDataset()) {
    if (!e.emb || e.emb.length !== emb.length) continue;
    const score = cosine(emb, e.emb);
    const cur = best.get(e.key);
    if (!cur || score > cur.score) best.set(e.key, { ...e, score });
  }
  return [...best.values()].filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score).slice(0, topN);
}

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
let simMatches = [];
async function openRecordForm(dataUrl) {
  draft = { photo: dataUrl, photoOriginal: dataUrl, faces: [], category: 'local', rarity: 2, trivia: '', aiUsed: false, emb: null };
  simMatches = [];
  renderRecordForm();
  // オンデバイス類似検索（無料・LLMより前）
  draft.emb = await computeEmbedding(dataUrl);
  const matches = findSimilar(draft.emb);
  if (matches.length) renderSuggestions(matches);
}

function renderSuggestions(matches) {
  simMatches = matches;
  const box = $('simBox');
  if (!box) return;
  box.innerHTML = `<p class="sim-title">💡 あなたの図鑑で見た目が似ている形式（端末内・無料の参考）。同じならタップで入力：</p>` +
    matches.map((m, i) =>
      `<button type="button" class="sim-btn" data-i="${i}">${escapeHtml([m.operator, m.series].filter(Boolean).join(' '))}<span class="sim-score">これかも？</span></button>`
    ).join('');
  box.classList.remove('hidden');
  box.querySelectorAll('.sim-btn').forEach((b) =>
    b.addEventListener('click', () => applySuggestion(simMatches[+b.dataset.i])));
}
function applySuggestion(m) {
  $('fOperator').value = m.operator || '';
  $('fSeries').value = m.series || '';
  if (m.kind) $('fKind').value = m.kind;
  if (m.debut) $('fDebut').value = m.debut;
  if (m.category) { draft.category = m.category; renderCatButtons(); }
}

function renderRecordForm() {
  const d = draft;
  $('resultCard').innerHTML = `
    ${d.photo
      ? `<div class="result-photo"><img id="resultPhoto" src="${d.photo}" alt="撮った写真" /></div>
         <p class="plate-hint">⚠️ 写り込んだ人の顔は、隠したい所を写真で<b>指でなぞって</b>隠してください。</p>`
      : ''}
    <h2 class="form-title">自分で記録する</h2>
    <div class="sim-box hidden" id="simBox"></div>
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
  // フライホイールの一滴：埋め込み＋ラベルをデータセットへ（顔写真そのものは貯めない）
  if (draft.emb) {
    const ds = loadDataset();
    ds.push({ emb: draft.emb, operator, series, category: r.category, kind: r.kind, debut: r.debut, key, t: now });
    while (ds.length > DATASET_MAX) ds.shift();
    saveDataset(ds);
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

/* ---------- 新幹線図鑑（マスターリスト：何が存在するか／何が未取得か） ----------
   2025年現在の現役新幹線形式（事実確認済み）。matchKeysは手入力の表記ゆれ吸収用（norm済み）。 */
const MASTER_SHINKANSEN = [
  { no: 1, series: 'N700S', operator: 'JR東海・西日本', nickname: 'のぞみ／ひかり／こだま', debut: '2020', rarity: 1, matchKeys: ['n700s'] },
  { no: 2, series: 'N700A', operator: 'JR東海・西日本', nickname: 'のぞみ／ひかり', debut: '2013', rarity: 2, matchKeys: ['n700a'] },
  { no: 3, series: 'N700系（7000・8000番台）', operator: 'JR西日本・九州', nickname: 'みずほ／さくら', debut: '2011', rarity: 3, matchKeys: ['n700系'] },
  { no: 4, series: '500系', operator: 'JR西日本', nickname: 'こだま（山陽）', debut: '1997', rarity: 4, matchKeys: ['500系'] },
  { no: 5, series: '700系', operator: 'JR西日本', nickname: 'ひかりレールスター', debut: '2000', rarity: 4, matchKeys: ['700系', 'レールスター'] },
  { no: 6, series: '800系', operator: 'JR九州', nickname: 'つばめ', debut: '2004', rarity: 3, matchKeys: ['800系'] },
  { no: 7, series: 'N700S（西九州・8000番台）', operator: 'JR九州・西日本', nickname: 'かもめ', debut: '2022', rarity: 4, matchKeys: ['かもめ', 'n700s8000'] },
  { no: 8, series: 'E5系', operator: 'JR東日本', nickname: 'はやぶさ／やまびこ', debut: '2011', rarity: 2, matchKeys: ['e5系'] },
  { no: 9, series: 'H5系', operator: 'JR北海道', nickname: 'はやぶさ（北海道）', debut: '2016', rarity: 4, matchKeys: ['h5系'] },
  { no: 10, series: 'E6系', operator: 'JR東日本', nickname: 'こまち', debut: '2013', rarity: 3, matchKeys: ['e6系'] },
  { no: 11, series: 'E7系・W7系', operator: 'JR東日本・西日本', nickname: 'かがやき／とき', debut: '2014', rarity: 2, matchKeys: ['e7系', 'w7系'] },
  { no: 12, series: 'E8系', operator: 'JR東日本', nickname: 'つばさ', debut: '2024', rarity: 3, matchKeys: ['e8系'] },
  { no: 13, series: 'E3系', operator: 'JR東日本', nickname: 'つばさ ほか', debut: '1997', rarity: 4, matchKeys: ['e3系'] },
  { no: 14, series: 'E2系', operator: 'JR東日本', nickname: 'やまびこ／とき', debut: '1997', rarity: 4, matchKeys: ['e2系'] },
  { no: 15, series: '923形 ドクターイエロー', operator: 'JR東海・西日本', nickname: '検測車（2027引退予定）', debut: '2005', rarity: 5, matchKeys: ['923形', 'ドクターイエロー', 'ドクター'] },
  { no: 16, series: 'E926形 East i', operator: 'JR東日本', nickname: '検測車', debut: '2001', rarity: 5, matchKeys: ['e926形', 'easti', 'イーストアイ'] },
];

// 在来線・私鉄図鑑：全国の有名・人気形式のセレクション（全網羅は不可能なので"有限で締まる"厳選）。
const MASTER_LOCAL = [
  { no: 1, series: 'E235系', operator: 'JR東日本', nickname: '山手線／横須賀・総武', debut: '2015', rarity: 1, matchKeys: ['e235系'] },
  { no: 2, series: 'E233系', operator: 'JR東日本', nickname: '中央線／京浜東北 ほか', debut: '2006', rarity: 1, matchKeys: ['e233系'] },
  { no: 3, series: '227系', operator: 'JR西日本', nickname: '広島 Red Wing ほか', debut: '2015', rarity: 3, matchKeys: ['227系'] },
  { no: 4, series: 'E353系', operator: 'JR東日本', nickname: 'あずさ／かいじ', debut: '2017', rarity: 2, matchKeys: ['e353系'] },
  { no: 5, series: 'E257系', operator: 'JR東日本', nickname: '踊り子 ほか', debut: '2001', rarity: 3, matchKeys: ['e257系'] },
  { no: 6, series: 'E261系 サフィール踊り子', operator: 'JR東日本', nickname: '観光特急', debut: '2020', rarity: 4, matchKeys: ['e261系', 'サフィール'] },
  { no: 7, series: '273系', operator: 'JR西日本', nickname: 'やくも', debut: '2024', rarity: 4, matchKeys: ['273系', 'やくも'] },
  { no: 8, series: '281系', operator: 'JR西日本', nickname: 'はるか（関空特急）', debut: '1994', rarity: 3, matchKeys: ['281系', 'はるか'] },
  { no: 9, series: '683系・681系', operator: 'JR西日本', nickname: 'サンダーバード', debut: '1995', rarity: 3, matchKeys: ['683系', '681系', 'サンダーバード'] },
  { no: 10, series: '787系', operator: 'JR九州', nickname: '特急（九州）', debut: '1992', rarity: 3, matchKeys: ['787系'] },
  { no: 11, series: 'HC85系', operator: 'JR東海', nickname: 'ひだ／南紀', debut: '2022', rarity: 3, matchKeys: ['hc85'] },
  { no: 12, series: '小田急70000形 GSE', operator: '小田急', nickname: 'ロマンスカー', debut: '2018', rarity: 3, matchKeys: ['70000形', 'gse'] },
  { no: 13, series: '近鉄80000系 ひのとり', operator: '近鉄', nickname: '名阪特急', debut: '2020', rarity: 3, matchKeys: ['80000系', 'ひのとり'] },
  { no: 14, series: '近鉄50000系 しまかぜ', operator: '近鉄', nickname: '観光特急', debut: '2013', rarity: 4, matchKeys: ['50000系', 'しまかぜ'] },
  { no: 15, series: '西武001系 Laview', operator: '西武', nickname: '特急ラビュー', debut: '2019', rarity: 3, matchKeys: ['001系', 'laview', 'ラビュー'] },
  { no: 16, series: '京成AE形 スカイライナー', operator: '京成', nickname: '空港アクセス特急', debut: '2010', rarity: 3, matchKeys: ['ae形', 'スカイライナー'] },
  { no: 17, series: '名鉄2000系 ミュースカイ', operator: '名鉄', nickname: '空港特急', debut: '2005', rarity: 4, matchKeys: ['2000系', 'ミュースカイ'] },
  { no: 18, series: '東武500系 リバティ', operator: '東武', nickname: '特急リバティ', debut: '2017', rarity: 3, matchKeys: ['リバティ', '東武500'] },
  { no: 19, series: '東武N100系 スペーシアX', operator: '東武', nickname: '新型スペーシア', debut: '2023', rarity: 4, matchKeys: ['n100系', 'スペーシアx'] },
  { no: 20, series: '京急2100形', operator: '京急', nickname: '快特', debut: '1998', rarity: 3, matchKeys: ['2100形', '2100系'] },
  { no: 21, series: '阪急電車（マルーン）', operator: '阪急', nickname: '伝統のマルーン塗装', debut: '—', rarity: 2, matchKeys: ['阪急'] },
  { no: 22, series: '江ノ電', operator: '江ノ島電鉄', nickname: '海沿いの路面区間', debut: '—', rarity: 3, matchKeys: ['江ノ電', '江ノ島'] },
  { no: 23, series: 'SL（蒸気機関車）', operator: 'JR各社', nickname: 'やまぐち号／D51 ほか', debut: '—', rarity: 5, matchKeys: ['sl', 'd51', 'c57', '蒸気'] },
  { no: 24, series: 'ななつ星 in 九州', operator: 'JR九州', nickname: '豪華寝台', debut: '2013', rarity: 5, matchKeys: ['ななつ星', 'ななつぼし'] },
];

// 自分の記録（手入力）をマスターに照合。各記録は「最も具体的に一致した形式」に割り当てる（部分一致の取り違え防止）。
// category を渡すと、その種別の記録だけを対象にする（新幹線500系と私鉄500系リバティの取り違えを防ぐ）。
function caughtMap(masters, category) {
  const map = {};
  for (const [k, entry] of Object.entries(dex)) {
    if (category && entry.category !== category) continue;
    const series = k.split('|')[1] || '';
    let best = null;
    for (const m of masters) {
      for (const mk of m.matchKeys) {
        if (series.includes(mk) && (!best || mk.length > best.len)) best = { no: m.no, len: mk.length, entry };
      }
    }
    if (best && !map[best.no]) map[best.no] = best.entry;
  }
  return map;
}

function renderMasterDex(masters, category, headTitle) {
  const caught = caughtMap(masters, category);
  const got = Object.keys(caught).length;
  const total = masters.length;
  $('masterHead').classList.remove('hidden');
  $('masterHead').innerHTML = `
    <div class="master-title">${headTitle}　<b>${got} / ${total}</b> 形式</div>
    <div class="master-bar"><div class="master-bar-fill" style="width:${Math.round(got / total * 100)}%"></div></div>
    <p class="master-sub">未取得は「？？？」。レア度を頼りに、まだ見ぬ形式を探しに行こう。</p>`;
  $('dexEmpty').classList.add('hidden');

  $('dexGrid').innerHTML = masters.map((m) => {
    const e = caught[m.no];
    if (e) {
      return `
        <div class="dex-card rarity-${m.rarity}">
          <div class="dex-thumb">
            ${e.photo ? `<img src="${e.photo}" alt="" loading="lazy" />` : `<span class="dex-emoji">🚄</span>`}
            <span class="dex-no">No.${m.no}</span>
          </div>
          <div class="dex-stars">${stars(m.rarity)}</div>
          <div class="dex-name">${escapeHtml(m.series)}</div>
          <div class="dex-gen">${escapeHtml(m.nickname)}</div>
        </div>`;
    }
    return `
      <div class="dex-card silhouette">
        <div class="dex-thumb"><span class="dex-silhouette">？</span><span class="dex-no">No.${m.no}</span></div>
        <div class="dex-stars dim">${stars(m.rarity)}</div>
        <div class="dex-name">？？？</div>
        <div class="dex-gen">未取得</div>
      </div>`;
  }).join('');
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
  if (dexFilter === 'master-sk') { renderMasterDex(MASTER_SHINKANSEN, 'shinkansen', '🚄 新幹線図鑑'); return; }
  if (dexFilter === 'master-local') { renderMasterDex(MASTER_LOCAL, 'local', '📗 在来線・私鉄図鑑'); return; }
  $('masterHead').classList.add('hidden');
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
