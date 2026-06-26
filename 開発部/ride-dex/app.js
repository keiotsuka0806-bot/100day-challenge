'use strict';

const STORE_KEY = 'ridedex_v1';
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

const speciesKey = (maker, model) =>
  `${maker}|${model}`.toLowerCase().replace(/\s+/g, '');

const catEmoji = (c) => (c === 'bike' ? '🏍️' : '🚗');
const stars = (r) => '★'.repeat(r) + '☆'.repeat(5 - r);
const rarityLabel = (r) => ['', 'ありふれ', 'ふつう', 'たまに見る', 'レア', '激レア'][r] || '';

let pending = null; // 鑑定中／確認待ちの1台

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
  try {
    const res = await fetch('/api/identify-vehicle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (res.status === 503) {
      demoMode = true;
      result = mockIdentify();
    } else if (res.status === 429) {
      showScan(false);
      alert('少し混み合っています。数秒おいて、もう一度どうぞ。');
      return;
    } else if (!res.ok) {
      showScan(false);
      alert('鑑定に失敗しました。電波の良い場所でもう一度お試しください。');
      return;
    } else {
      result = await res.json();
    }
  } catch {
    demoMode = true;
    result = mockIdentify();
  }
  showScan(false);
  updateModeNote();

  if (result.isVehicle === false) {
    pending = null;
    showNotVehicle(result.message);
    return;
  }
  pending = result;
  pending.photo = dataUrl; // 結果カード表示用（フル）。図鑑にはサムネ化して任意保存
  showResult();
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

/* ---------- 結果表示 ---------- */
function showResult() {
  const r = pending;
  const key = speciesKey(r.maker, r.model);
  const isNew = !dex[key];
  const gen = [r.generation, r.yearRange ? `${r.yearRange}年型` : '']
    .filter(Boolean).join('｜');

  $('resultCard').innerHTML = `
    ${isNew ? '<div class="new-badge">✨ 初発見！</div>' : '<div class="seen-badge">図鑑にあり</div>'}
    ${r.photo
      ? `<div class="result-photo"><img src="${r.photo}" alt="撮った写真"><span class="result-cat">${catEmoji(r.category)}</span></div>`
      : `<div class="result-emoji">${catEmoji(r.category)}</div>`}
    <div class="rarity-row rarity-${r.rarity}">
      <span class="rarity-stars">${stars(r.rarity)}</span>
      <span class="rarity-label">${rarityLabel(r.rarity)}</span>
    </div>
    <h2 class="result-name">${escapeHtml(r.maker)} ${escapeHtml(r.model)}</h2>
    ${gen ? `<p class="result-gen">${escapeHtml(gen)}</p>` : ''}
    <p class="result-meta">
      ${r.bodyType ? `<span>${escapeHtml(r.bodyType)}</span>` : ''}
      <span class="conf">確度 ${r.confidence}%</span>
      ${r.corrected ? '<span class="corrected">訂正済み</span>' : ''}
    </p>
    ${r.trivia ? `<p class="result-trivia">💡 ${escapeHtml(r.trivia)}</p>` : ''}
    ${r.photo ? `<label class="keep-photo"><input type="checkbox" id="keepPhoto" checked /> この写真を図鑑にも残す</label>` : ''}
    <div class="result-actions">
      <button class="btn-primary" id="btnRegister">📖 図鑑に登録</button>
      <button class="btn-ghost" id="btnCorrect">✏️ ちがう（訂正）</button>
    </div>`;
  $('resultModal').classList.remove('hidden');
  if (r.rarity >= 4) triggerReveal(r.rarity);

  $('btnRegister').addEventListener('click', registerPending);
  $('btnCorrect').addEventListener('click', openCorrect);
}

function showNotVehicle(message) {
  $('resultCard').innerHTML = `
    <div class="result-emoji">🤔</div>
    <h2 class="result-name">見つからなかった</h2>
    <p class="result-trivia">${escapeHtml(message || 'これは車・バイクではないみたいです。')}</p>
    <div class="result-actions">
      <button class="btn-primary" id="btnClose">もう一度さがす</button>
    </div>`;
  $('resultModal').classList.remove('hidden');
  $('btnClose').addEventListener('click', () => $('resultModal').classList.add('hidden'));
}

async function registerPending() {
  const r = pending;
  const key = speciesKey(r.maker, r.model);
  const now = Date.now();
  const keepPhoto = $('keepPhoto') ? $('keepPhoto').checked : false;
  const thumb = keepPhoto && r.photo ? await makeThumb(r.photo) : null;

  if (dex[key]) {
    const e = dex[key];
    e.count += 1;
    e.lastSeen = now;
    if (!e.generation && r.generation) e.generation = r.generation;
    if (!e.yearRange && r.yearRange) e.yearRange = r.yearRange;
    if (thumb) e.photo = thumb; // 撮り直しでより良い写真に差し替え可
  } else {
    dex[key] = {
      maker: r.maker, model: r.model, category: r.category,
      generation: r.generation, yearRange: r.yearRange, bodyType: r.bodyType,
      rarity: r.rarity, trivia: r.trivia, count: 1, firstSeen: now, lastSeen: now,
      photo: thumb || null,
    };
  }

  if (!saveDex(dex)) {
    // 容量あふれ: 今回の写真を諦めて再保存（図鑑データ自体は守る）
    if (dex[key].photo) dex[key].photo = null;
    saveDex(dex);
    alert('写真の保存容量がいっぱいです。今回の写真は記録できませんでした（図鑑データは保存済み）。');
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
    <h2 class="correct-title">✏️ 正しい乗り物に直す</h2>
    ${cands ? `<p class="correct-sub">近い候補から選ぶ</p><div class="cand-list">${cands}</div>` : ''}
    <p class="correct-sub">または自分で入力（詳しい人向け）</p>
    <label class="field">メーカー<input id="fMaker" value="${escapeHtml(r.maker)}" /></label>
    <label class="field">車種<input id="fModel" value="${escapeHtml(r.model)}" /></label>
    <label class="field">世代・型式<input id="fGen" value="${escapeHtml(r.generation || '')}" placeholder="例: 50系 / E12型" /></label>
    <label class="field">年式レンジ<input id="fYear" value="${escapeHtml(r.yearRange || '')}" placeholder="例: 2015–2022" /></label>
    <div class="result-actions">
      <button class="btn-primary" id="btnSaveCorrect">この内容で確定</button>
      <button class="btn-ghost" id="btnCancelCorrect">やめる</button>
    </div>`;
  $('correctModal').classList.remove('hidden');

  $('correctCard').querySelectorAll('.cand-btn').forEach((b) =>
    b.addEventListener('click', () => {
      const c = r.candidates[+b.dataset.i];
      const sp = c.indexOf(' ');
      $('fMaker').value = sp > 0 ? c.slice(0, sp) : c;
      $('fModel').value = sp > 0 ? c.slice(sp + 1) : '';
    }));
  $('btnCancelCorrect').addEventListener('click', () =>
    $('correctModal').classList.add('hidden'));
  $('btnSaveCorrect').addEventListener('click', () => {
    const maker = $('fMaker').value.trim().slice(0, 24) || '不明';
    const model = $('fModel').value.trim().slice(0, 32) || '不明';
    pending = {
      ...r, maker, model,
      generation: $('fGen').value.trim().slice(0, 24),
      yearRange: $('fYear').value.trim().slice(0, 24),
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
    const gen = [e.generation, e.yearRange ? `${e.yearRange}年型` : '']
      .filter(Boolean).join('｜');
    return `
      <div class="dex-card rarity-${e.rarity}">
        <div class="dex-thumb">
          ${e.photo ? `<img src="${e.photo}" alt="" loading="lazy" />` : `<span class="dex-emoji">${catEmoji(e.category)}</span>`}
          <span class="dex-cat-badge">${catEmoji(e.category)}</span>
          ${e.count > 1 ? `<span class="dex-count">×${e.count}</span>` : ''}
        </div>
        <div class="dex-stars">${stars(e.rarity)}</div>
        <div class="dex-name">${escapeHtml(e.maker)}<br>${escapeHtml(e.model)}</div>
        ${gen ? `<div class="dex-gen">${escapeHtml(gen)}</div>` : ''}
      </div>`;
  }).join('');
}

/* ---------- 実績バッジ ---------- */
function renderAchievements() {
  const vals = Object.values(dex);
  const species = vals.length;
  const hasBike = vals.some((e) => e.category === 'bike');
  const hasRare = vals.some((e) => e.rarity >= 4);
  const hasClassic = vals.some((e) => {
    const m = /(\d{4})/.exec(e.yearRange || '');
    return m && +m[1] < 2000;
  });
  const list = [
    { emoji: '🎯', label: '初ゲット', done: species >= 1 },
    { emoji: '🏍️', label: '二輪ハンター', done: hasBike },
    { emoji: '💎', label: 'レアハンター', done: hasRare },
    { emoji: '🏛️', label: '旧車ハンター', done: hasClassic },
    { emoji: '📚', label: '10種コレクター', done: species >= 10 },
  ];
  $('achievements').innerHTML = list.map((a) =>
    `<span class="ach ${a.done ? 'on' : ''}" title="${a.label}">${a.emoji}<small>${a.label}</small></span>`
  ).join('');
}

/* ---------- ヘッダー数値 ---------- */
function updateChips() {
  const vals = Object.values(dex);
  $('chipSpecies').textContent = `${vals.length}種`;
  $('chipTotal').textContent = `${vals.reduce((s, e) => s + e.count, 0)}台`;
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
  { category: 'car', maker: 'トヨタ', model: 'プリウス', generation: '50系', yearRange: '2015–2022', bodyType: 'ハッチバック', rarity: 1, trivia: '世界で初めて量産されたハイブリッド専用車の子孫。', candidates: ['トヨタ アクア', 'ホンダ インサイト'] },
  { category: 'car', maker: 'ホンダ', model: 'シビック', generation: 'FK型', yearRange: '2017–2021', bodyType: 'ハッチバック', rarity: 3, trivia: 'タイプRはニュルで何度も最速FF記録を更新してきた。', candidates: ['マツダ アクセラ', 'トヨタ カローラスポーツ'] },
  { category: 'car', maker: 'スズキ', model: 'ジムニー', generation: 'JB64', yearRange: '2018–', bodyType: '軽SUV', rarity: 3, trivia: '軽自動車なのに本格的な悪路走破性を持つ世界的人気車。', candidates: ['ダイハツ タフト', 'スズキ ハスラー'] },
  { category: 'car', maker: '日産', model: 'スカイラインGT-R', generation: 'R34', yearRange: '1999–2002', bodyType: 'クーペ', rarity: 5, trivia: '今や中古でも価格が高騰する伝説のスポーツカー。', candidates: ['日産 シルビア', 'トヨタ スープラ'] },
  { category: 'car', maker: 'フォルクスワーゲン', model: 'ゴルフ', generation: '7型', yearRange: '2013–2020', bodyType: 'ハッチバック', rarity: 2, trivia: 'ハッチバックの世界基準と呼ばれ続けるロングセラー。', candidates: ['アウディ A3', 'プジョー 308'] },
  { category: 'bike', maker: 'ホンダ', model: 'スーパーカブ', generation: 'C125', yearRange: '2018–', bodyType: 'ビジネスバイク', rarity: 2, trivia: '世界で最も生産された乗り物。累計1億台超。', candidates: ['ヤマハ メイト', 'スズキ バーディー'] },
  { category: 'bike', maker: 'カワサキ', model: 'Z900RS', generation: '', yearRange: '2017–', bodyType: 'ネイキッド', rarity: 4, trivia: '名車Z1の意匠を現代に蘇らせたネオクラシック。', candidates: ['カワサキ ゼファー', 'ホンダ CB1100'] },
  { category: 'bike', maker: 'ヤマハ', model: 'SR400', generation: '', yearRange: '1978–2021', bodyType: 'クラシック', rarity: 4, trivia: '40年以上キックスタートを守り続けた孤高の一台。', candidates: ['ホンダ GB350', 'カワサキ エストレヤ'] },
];
function mockIdentify() {
  const base = MOCK[Math.floor(Math.random() * MOCK.length)];
  return { isVehicle: true, confidence: 60 + Math.floor(Math.random() * 35), ...base };
}

/* ---------- 起動 ---------- */
updateChips();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
