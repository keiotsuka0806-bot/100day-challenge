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
  catch { return false; } // 容量超過（写真の溜めすぎ）など
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
const rarityLabel = (r) => ['', 'ありふれ', 'ふつう', '数が減少', 'レア', '激レア'][r] || '';

let pending = null; // 鑑定中／確認待ちの1両

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

/* ---------- 撮影 → リサイズ ---------- */
$('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const dataUrl = await resizeImage(file);
    await identify(dataUrl);
  } catch (err) {
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

/* ---------- AI鑑定（鍵なし時はモック） ---------- */
let demoMode = false;
async function identify(dataUrl) {
  showScan(true);
  let result;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000); // 20秒で打ち切り（鑑定中で固まらない）
  try {
    const res = await fetch('/api/identify-train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
      signal: ctrl.signal,
    });
    if (res.status === 503) {
      // 鍵未設定のデモ配信時のみモック（鍵あり本番では発生しない）
      demoMode = true;
      result = mockIdentify();
    } else if (res.status === 429) {
      showScan(false); clearTimeout(timer);
      alert('少し混み合っています。数秒おいて、もう一度どうぞ。');
      return;
    } else if (!res.ok) {
      showScan(false); clearTimeout(timer);
      alert('鑑定に失敗しました。電波の良い場所でもう一度お試しください。');
      return;
    } else {
      result = await res.json();
    }
  } catch (err) {
    // 通信エラー/タイムアウトは「偽の結果」を出さず正直にエラー表示（嘘をつかない）
    showScan(false); clearTimeout(timer);
    alert(err.name === 'AbortError'
      ? '鑑定に時間がかかりすぎました。電波の良い場所でもう一度お試しください。'
      : '鑑定できませんでした。通信状況を確認して、もう一度お試しください。');
    return;
  }
  clearTimeout(timer);
  showScan(false);
  updateModeNote();

  if (result.isTrain === false) {
    pending = null;
    showNotTrain(result.message);
    return;
  }
  pending = result;
  pending.photoOriginal = dataUrl;        // ぼかしの再計算用（端末内・サーバーには残らない）
  pending.faces = result.faces || [];     // 写り込んだ人の顔の領域（0〜1相対）
  pending.photo = await applyFaceBlur(dataUrl, pending.faces); // 表示・保存はぼかし済みのみ
  showResult();
}

// 写り込んだ顔の領域をモザイク化した画像（dataURL）を返す
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
      const M = 0.03; // 安全マージン（AI座標のズレを吸収するため広めに隠す）
      faces.forEach((p) => {
        const x = Math.max(0, (p.x - M)) * W;
        const y = Math.max(0, (p.y - M)) * H;
        const w = Math.min(1, p.w + M * 2) * W;
        const h = Math.min(1, p.h + M * 2) * H;
        pixelate(ctx, x, y, Math.min(w, W - x), Math.min(h, H - y), 5); // 顔は粗めに潰す
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

function showScan(on) { $('scanOverlay').classList.toggle('hidden', !on); }

// 図鑑保存用のサムネ（容量を抑えるため小さく）
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

const debutText = (d) => (d ? (/^\d{4}$/.test(d) ? `${d}年デビュー` : d) : '');

/* ---------- 結果表示 ---------- */
function showResult() {
  const r = pending;
  const key = speciesKey(r.operator, r.series);
  const isNew = !dex[key];
  const sub = [r.kind, debutText(r.debut)].filter(Boolean).join('｜');
  const name = [r.operator, r.series].filter(Boolean).join(' ');

  $('resultCard').innerHTML = `
    ${isNew ? '<div class="new-badge">✨ 初発見！</div>' : '<div class="seen-badge">図鑑にあり</div>'}
    ${r.photo
      ? `<div class="result-photo"><img id="resultPhoto" src="${r.photo}" alt="撮った写真" /><span class="result-cat">${catEmoji(r.category)}</span></div>
         <p class="plate-hint">⚠️ 顔の自動ぼかしは外れることがあります。隠れていない顔は写真を<b>指でなぞって</b>隠してください。</p>`
      : `<div class="result-emoji">${catEmoji(r.category)}</div>`}
    <div class="rarity-row rarity-${r.rarity}">
      <span class="rarity-stars">${stars(r.rarity)}</span>
      <span class="rarity-label">${rarityLabel(r.rarity)}</span>
    </div>
    <h2 class="result-name">${escapeHtml(name)}</h2>
    ${sub ? `<p class="result-gen">${escapeHtml(sub)}</p>` : ''}
    <p class="result-meta">
      <span>${escapeHtml(catLabel(r.category))}</span>
      <span class="conf ${r.confidence < 60 ? 'low' : ''}">確度 ${r.confidence}%${r.confidence < 60 ? '・自信なし' : ''}</span>
      ${r.corrected ? '<span class="corrected">訂正済み</span>' : ''}
    </p>
    ${r.corrected ? '' : '<p class="ai-note">🤖 これはAIの推定で、形式（N700とN700Sなど）を外すこともあります。違っていたら下の「ちがう？直す」で直してください（あなたの訂正が正解になります）。</p>'}
    ${r.trivia ? `<p class="result-trivia">💡 ${escapeHtml(r.trivia)}</p>` : ''}
    ${r.photo ? `<label class="keep-photo"><input type="checkbox" id="keepPhoto" checked /> この写真を図鑑にも残す</label>` : ''}
    <div class="result-actions">
      <button class="btn-primary" id="btnRegister">📖 図鑑に登録</button>
      <button class="btn-ghost emph" id="btnCorrect">✏️ ちがう？直す</button>
    </div>`;
  $('resultModal').classList.remove('hidden');
  if (r.rarity >= 4) triggerReveal(r.rarity);

  $('btnRegister').addEventListener('click', registerPending);
  $('btnCorrect').addEventListener('click', openCorrect);
  const photoEl = $('resultPhoto');
  if (photoEl) {
    photoEl.addEventListener('pointerdown', onPhotoPointerDown);
    photoEl.addEventListener('pointerup', onPhotoPointerUp);
  }
}

// 写真を「なぞって」隠す（自動ぼかしは当てにせず、手動を主役に）。
// ドラッグ＝なぞった範囲、ほぼ動かさなければタップ＝顔大の固定サイズで隠す。
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
  if (w < 0.04 || h < 0.04) { // ほぼタップ＝顔大の固定サイズ
    const fw = 0.12, fh = 0.14;
    x = Math.max(0, ex - fw / 2); y = Math.max(0, ey - fh / 2); w = fw; h = fh;
  }
  pending.faces.push({ x: Math.max(0, x), y: Math.max(0, y), w, h });
  pending.photo = await applyFaceBlur(pending.photoOriginal, pending.faces);
  img.src = pending.photo;
}

function showNotTrain(message) {
  $('resultCard').innerHTML = `
    <div class="result-emoji">🤔</div>
    <h2 class="result-name">見つからなかった</h2>
    <p class="result-trivia">${escapeHtml(message || 'これは鉄道車両ではないみたいです。')}</p>
    <div class="result-actions">
      <button class="btn-primary" id="btnClose">もう一度さがす</button>
    </div>`;
  $('resultModal').classList.remove('hidden');
  $('btnClose').addEventListener('click', () => $('resultModal').classList.add('hidden'));
}

async function registerPending() {
  const r = pending;
  const key = speciesKey(r.operator, r.series);
  const now = Date.now();
  const keepPhoto = $('keepPhoto') ? $('keepPhoto').checked : false;
  const thumb = keepPhoto && r.photo ? await makeThumb(r.photo) : null;

  if (dex[key]) {
    const e = dex[key];
    e.count += 1;
    e.lastSeen = now;
    if (!e.kind && r.kind) e.kind = r.kind;
    if (!e.debut && r.debut) e.debut = r.debut;
    if (thumb) e.photo = thumb; // 撮り直しでより良い写真に差し替え可
  } else {
    dex[key] = {
      operator: r.operator, series: r.series, category: r.category,
      kind: r.kind, debut: r.debut,
      rarity: r.rarity, trivia: r.trivia, count: 1, firstSeen: now, lastSeen: now,
      photo: thumb || null,
    };
  }

  if (!saveDex(dex)) {
    // 容量あふれ: まず今回の写真、ダメなら全写真を落として図鑑データ自体は必ず守る
    if (dex[key].photo) dex[key].photo = null;
    if (!saveDex(dex)) {
      Object.values(dex).forEach((e) => { e.photo = null; });
    }
    const saved = saveDex(dex);
    alert(saved
      ? '写真の保存容量がいっぱいです。写真は記録できませんでしたが、図鑑データは保存しました。'
      : '保存容量がいっぱいで記録できませんでした。図鑑の不要な形式を減らしてからお試しください。');
  }
  pending = null;
  $('resultModal').classList.add('hidden');
  updateChips();
  switchView('dex');
}

/* ---------- 訂正 ---------- */
function openCorrect() {
  const r = pending;
  const cands = (r.candidates || []).map((c, i) =>
    `<button class="cand-btn" data-i="${i}">${escapeHtml(c)}</button>`).join('');
  $('correctCard').innerHTML = `
    <h2 class="correct-title">✏️ 正しい車両に直す</h2>
    ${cands ? `<p class="correct-sub">近い候補から選ぶ</p><div class="cand-list">${cands}</div>` : ''}
    <p class="correct-sub">または自分で入力（詳しい人向け）</p>
    <label class="field">事業者<input id="fOperator" value="${escapeHtml(r.operator || '')}" placeholder="例: JR東日本 / 京急 / 広島電鉄" /></label>
    <label class="field">形式・系列<input id="fSeries" value="${escapeHtml(r.series || '')}" placeholder="例: E5系 / 京急2100形" /></label>
    <label class="field">種別<input id="fKind" value="${escapeHtml(r.kind || '')}" placeholder="例: 新幹線 / 特急 / 通勤型 / 路面電車" /></label>
    <label class="field">登場年<input id="fDebut" value="${escapeHtml(r.debut || '')}" placeholder="例: 2011 / 2007– / 国鉄時代" /></label>
    <div class="result-actions">
      <button class="btn-primary" id="btnSaveCorrect">この内容で確定</button>
      <button class="btn-ghost" id="btnCancelCorrect">やめる</button>
    </div>`;
  $('correctModal').classList.remove('hidden');

  $('correctCard').querySelectorAll('.cand-btn').forEach((b) =>
    b.addEventListener('click', () => {
      const c = r.candidates[+b.dataset.i];
      const sp = c.indexOf(' ');
      $('fOperator').value = sp > 0 ? c.slice(0, sp) : '';
      $('fSeries').value = sp > 0 ? c.slice(sp + 1) : c;
    }));
  $('btnCancelCorrect').addEventListener('click', () =>
    $('correctModal').classList.add('hidden'));
  $('btnSaveCorrect').addEventListener('click', () => {
    const operator = $('fOperator').value.trim().slice(0, 24);
    const series = $('fSeries').value.trim().slice(0, 40) || '不明';
    pending = {
      ...r, operator, series,
      kind: $('fKind').value.trim().slice(0, 24),
      debut: $('fDebut').value.trim().slice(0, 24),
      confidence: 100, corrected: true,
    };
    $('correctModal').classList.add('hidden');
    showResult();
  });
}

/* ---------- レア演出 ---------- */
function triggerReveal(rarity) {
  const el = $('reveal');
  el.className = `reveal rarity-${rarity}`;
  const emojis = rarity >= 5 ? ['💎', '🏆', '⚡', '✨', '👑'] : ['✨', '⭐', '🎉'];
  let burst = '';
  for (let i = 0; i < (rarity >= 5 ? 24 : 14); i++) {
    const e = emojis[i % emojis.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const dur = 1.2 + Math.random() * 0.8;
    burst += `<span style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s">${e}</span>`;
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

  grid.innerHTML = entries.map(([key, e]) => {
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

/* ---------- 実績バッジ ---------- */
function renderAchievements() {
  const vals = Object.values(dex);
  const species = vals.length;
  const hasShinkansen = vals.some((e) => e.category === 'shinkansen');
  const hasTram = vals.some((e) => e.category === 'tram');
  const hasRare = vals.some((e) => e.rarity >= 4);
  const list = [
    { emoji: '🎯', label: '初ゲット', done: species >= 1 },
    { emoji: '🚄', label: '新幹線ハンター', done: hasShinkansen },
    { emoji: '🚋', label: '路面電車ハンター', done: hasTram },
    { emoji: '💎', label: 'レアハンター', done: hasRare },
    { emoji: '📚', label: '10形式コレクター', done: species >= 10 },
  ];
  $('achievements').innerHTML = list.map((a) =>
    `<span class="ach ${a.done ? 'on' : ''}" title="${a.label}">${a.emoji}<small>${a.label}</small></span>`
  ).join('');
}

/* ---------- ヘッダー数値 ---------- */
function updateChips() {
  const vals = Object.values(dex);
  $('chipSpecies').textContent = `${vals.length}形式`;
  $('chipTotal').textContent = `${vals.reduce((s, e) => s + e.count, 0)}回`;
}

function updateModeNote() {
  const note = $('modeNote');
  if (demoMode) {
    note.textContent = '⚠️ デモモード（AI鍵が未設定のため、ランダムな見本を表示しています）';
    note.classList.remove('hidden');
  } else {
    note.classList.add('hidden');
  }
}

/* ---------- モック（鍵なしデモ用） ---------- */
const MOCK = [
  { category: 'shinkansen', operator: 'JR東日本', series: 'E5系「はやぶさ」', kind: '新幹線', debut: '2011', rarity: 1, trivia: '営業最高320km/hを誇る東北新幹線の主力。', candidates: ['JR東日本 E6系', 'JR東日本 H5系'] },
  { category: 'shinkansen', operator: 'JR東海', series: 'N700S', kind: '新幹線', debut: '2020', rarity: 2, trivia: '"S"はSupreme。床下機器を一新した東海道の最新形式。', candidates: ['JR東海 N700A', 'JR西日本 N700系'] },
  { category: 'shinkansen', operator: 'JR東海', series: '0系（保存車）', kind: '新幹線', debut: '1964', rarity: 5, trivia: '世界初の高速鉄道車両。今は博物館の主役。', candidates: ['JR西日本 100系', '国鉄 0系'] },
  { category: 'local', operator: 'JR東日本', series: 'E235系（山手線）', kind: '通勤型', debut: '2015', rarity: 1, trivia: '車内広告をほぼデジタルサイネージ化した通勤型。', candidates: ['JR東日本 E231系', 'JR東日本 E233系'] },
  { category: 'local', operator: '京急', series: '2100形', kind: '快特用', debut: '1998', rarity: 3, trivia: '発車時の"ドレミファ"音階モーターで一世を風靡。', candidates: ['京急 1000形', '京急 600形'] },
  { category: 'local', operator: '国鉄', series: '103系', kind: '通勤型', debut: '1963', rarity: 5, trivia: '高度成長期を支えた通勤電車の代名詞。引退進む。', candidates: ['国鉄 101系', 'JR西日本 201系'] },
  { category: 'tram', operator: '広島電鉄', series: '5100形「グリーンムーバーmax」', kind: '路面電車', debut: '2005', rarity: 3, trivia: '国産初の本格的な超低床路面電車。', candidates: ['広島電鉄 5000形', '富山地鉄 セントラム'] },
  { category: 'tram', operator: '東京都交通局', series: '都電8900形', kind: '路面電車', debut: '2015', rarity: 2, trivia: '東京に残る数少ない路面電車・荒川線の新型。', candidates: ['東京都交通局 8800形', '都電 7700形'] },
];
function mockIdentify() {
  const base = MOCK[Math.floor(Math.random() * MOCK.length)];
  return { isTrain: true, confidence: 60 + Math.floor(Math.random() * 35), ...base };
}

/* ---------- 起動 ---------- */
updateChips();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
