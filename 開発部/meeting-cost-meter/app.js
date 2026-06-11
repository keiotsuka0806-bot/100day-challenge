'use strict';

// ── State ──────────────────────────────────────────────
let participants = [
  { role: '部長',     rate: 700000, count: 1 },
  { role: '一般社員', rate: 350000, count: 4 },
];
let startTime    = null;
let tickInterval = null;
let currentCost  = 0;

// ── Presets ────────────────────────────────────────────
const ROLES = [
  { role: '社長 / CEO', rate: 1500000 },
  { role: '取締役',     rate: 1000000 },
  { role: '部長',       rate: 700000  },
  { role: '課長',       rate: 500000  },
  { role: '一般社員',   rate: 350000  },
  { role: '新入社員',   rate: 220000  },
];

const BUY_ITEMS = [
  { name: 'スタバ ラテ',     price: 700,    emoji: '☕' },
  { name: 'ランチ定食',      price: 1000,   emoji: '🍱' },
  { name: '生ビール',        price: 700,    emoji: '🍺' },
  { name: '映画チケット',    price: 2000,   emoji: '🎬' },
  { name: '焼肉ランチ',      price: 2000,   emoji: '🥩' },
  { name: 'コンビニアイス',  price: 200,    emoji: '🍦' },
  { name: '温泉入浴料',      price: 800,    emoji: '♨️' },
  { name: 'タクシー初乗り',  price: 500,    emoji: '🚕' },
  { name: 'Netflixひと月',   price: 1490,   emoji: '📺' },
  { name: 'AirPodsケース',   price: 3000,   emoji: '🎧' },
];

// ── Helpers ───────────────────────────────────────────
function escAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── DOM refs ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = { setup: $('screen-setup'), counter: $('screen-counter'), result: $('screen-result') };

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── Participants ───────────────────────────────────────
function renderParticipants() {
  const list = $('participant-list');
  list.innerHTML = participants.map((p, i) => `
    <div class="participant-row">
      <div class="participant-main">
        <input class="input-role" type="text" value="${escAttr(p.role)}" data-i="${i}" placeholder="役職名">
        <div class="participant-nums">
          <div class="num-group">
            <label>月収</label>
            <input class="input-rate" type="number" value="${p.rate}" data-i="${i}" min="0" step="10000">
            <span>円</span>
          </div>
          <div class="num-group">
            <label>人数</label>
            <input class="input-count" type="number" value="${p.count}" data-i="${i}" min="1" max="99">
            <span>人</span>
          </div>
        </div>
      </div>
      <button class="btn-remove" data-i="${i}">✕</button>
    </div>`).join('');

  list.querySelectorAll('.input-role').forEach(el =>
    el.addEventListener('input', e => { participants[+e.target.dataset.i].role = e.target.value; updateTotal(); }));
  list.querySelectorAll('.input-rate').forEach(el =>
    el.addEventListener('input', e => { participants[+e.target.dataset.i].rate = +e.target.value || 0; updateTotal(); }));
  list.querySelectorAll('.input-count').forEach(el =>
    el.addEventListener('input', e => { participants[+e.target.dataset.i].count = Math.max(1, +e.target.value || 1); updateTotal(); }));
  list.querySelectorAll('.btn-remove').forEach(el =>
    el.addEventListener('click', e => { participants.splice(+e.target.dataset.i, 1); renderParticipants(); }));

  updateTotal();
}

function updateTotal() {
  const total = participants.reduce((s, p) => s + p.rate * p.count, 0);
  $('total-hourly').textContent = total.toLocaleString('ja-JP');
}

// 月収 → 時給 = 月収 / 160h、時給 → ms単価 = 時給 / 3_600_000
function costPerMs() {
  return participants.reduce((s, p) => s + p.rate * p.count, 0) / (160 * 3_600_000);
}

$('add-participant').addEventListener('click', () => {
  const preset = ROLES[participants.length % ROLES.length];
  participants.push({ role: preset.role, rate: preset.rate, count: 1 });
  renderParticipants();
});

// ── Timer ──────────────────────────────────────────────
let lastBuySlot = -1;

$('start-btn').addEventListener('click', () => {
  if (participants.length === 0 || participants.every(p => p.count <= 0)) return;
  clearInterval(tickInterval);
  lastBuySlot = -1;
  startTime   = Date.now();
  currentCost = 0;
  $('buy-list').innerHTML = '<p class="buy-placeholder">コストが積み上がると何が買えるか表示されます</p>';
  showScreen('counter');

  const cpm = costPerMs();
  tickInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    currentCost   = elapsed * cpm;
    $('cost-value').textContent = '¥' + Math.floor(currentCost).toLocaleString('ja-JP');

    const secs = Math.floor(elapsed / 1000);
    const m    = Math.floor(secs / 60);
    const h    = Math.floor(m / 60);
    $('elapsed-time').textContent = h > 0
      ? `${h}:${String(m % 60).padStart(2,'0')}:${String(secs % 60).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(secs % 60).padStart(2,'0')}`;

    updateBuyList(currentCost);
  }, 150);
});

function renderBuyItem(item) {
  const el = $('buy-list');
  el.classList.remove('fade-in');
  void el.offsetWidth;
  el.innerHTML =
    `<div class="buy-equivalent">
      <span class="buy-eq-label">代わりに買えた</span>
      <div class="buy-eq-item">
        <span class="buy-emoji">${item.emoji}</span>
        <span class="buy-name">${item.name}</span>
        <span class="buy-count">${item.count.toLocaleString()}個分</span>
      </div>
    </div>`;
  el.classList.add('fade-in');
}

function updateBuyList(cost) {
  const items = BUY_ITEMS
    .map(item => ({ ...item, count: Math.floor(cost / item.price) }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);

  if (items.length === 0) return;

  // 3秒ごとにスロットが変わる時刻ベースのローテーション
  const slot = Math.floor(Date.now() / 3000) % items.length;
  if (slot === lastBuySlot) return;
  lastBuySlot = slot;
  renderBuyItem(items[slot]);
}

$('stop-btn').addEventListener('click', () => {
  clearInterval(tickInterval);
  showResult(currentCost, Date.now() - startTime);
});

// ── Result ─────────────────────────────────────────────
function showResult(cost, elapsedMs) {
  const secs    = Math.floor(elapsedMs / 1000);
  const m       = Math.floor(secs / 60);
  const h       = Math.floor(m / 60);
  const timeStr = h > 0 ? `${h}時間${m % 60}分` : `${m}分${secs % 60}秒`;
  const total   = participants.reduce((s, p) => s + p.count, 0);
  const memberStr = participants.map(p => `${p.role}×${p.count}人`).join('、');

  const topBuys = BUY_ITEMS
    .map(item => ({ ...item, count: Math.floor(cost / item.price) }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const topBuy = topBuys[0] ?? null;

  $('result-cost').textContent    = '¥' + Math.floor(cost).toLocaleString('ja-JP');
  $('result-time').textContent    = `⏱ ${timeStr} の会議`;
  $('result-members').textContent = `👥 ${memberStr}（計${total}人）`;
  $('result-buys').innerHTML = topBuy
    ? `<div class="result-equivalent">代わりに ${topBuy.emoji} <b>${topBuy.name}</b> が <b>${topBuy.count}個</b> 買えた</div>`
    : '';

  saveHistory({ cost: Math.floor(cost), timeStr, members: memberStr, date: new Date().toLocaleDateString('ja-JP') });
  renderHistory();
  showScreen('result');

  const tweetText = [
    `この会議のコスト: ¥${Math.floor(cost).toLocaleString()} 💸`,
    `${timeStr}・${total}人参加`,
    topBuys[0] ? `${topBuys[0].emoji}${topBuys[0].name} が ${topBuys[0].count}個買えた` : '',
    '#会議コストメーター',
  ].filter(Boolean).join('\n');

  $('tweet-btn').onclick = () =>
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
}

// ── Share image (Canvas) ───────────────────────────────
$('share-btn').addEventListener('click', () => {
  const W = 600, H = 420;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx    = canvas.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0d0d1a');
  grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent border
  ctx.strokeStyle = 'rgba(255,107,107,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // Header
  ctx.fillStyle = '#7a8aaa';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('💸  会議コストメーター', W / 2, 52);

  // Cost
  ctx.fillStyle = '#ff6b6b';
  ctx.font = `bold ${$('result-cost').textContent.length > 8 ? 64 : 76}px sans-serif`;
  ctx.fillText($('result-cost').textContent, W / 2, 150);

  // Meta
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '22px sans-serif';
  ctx.fillText($('result-time').textContent,    W / 2, 200);
  ctx.fillText($('result-members').textContent, W / 2, 232);

  // Buy items
  const buys = $('result-buys').querySelectorAll('div');
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#e0e0e0';
  Array.from(buys).slice(0, 3).forEach((el, i) => {
    ctx.fillText(el.textContent, W / 2, 278 + i * 38);
  });

  // Footer
  ctx.fillStyle = '#555';
  ctx.font = '13px sans-serif';
  ctx.fillText('meeting-cost-meter.web.app', W / 2, H - 20);

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: 'meeting-cost.png' });
    a.click();
    URL.revokeObjectURL(url);
  });
});

$('restart-btn').addEventListener('click', () => showScreen('setup'));

// ── History ────────────────────────────────────────────
function saveHistory(entry) {
  const h = JSON.parse(localStorage.getItem('mcm_history') || '[]');
  h.unshift(entry);
  localStorage.setItem('mcm_history', JSON.stringify(h.slice(0, 20)));
}

function renderHistory() {
  const h    = JSON.parse(localStorage.getItem('mcm_history') || '[]');
  const list = $('history-list');
  if (!h.length) { list.innerHTML = '<p class="empty-text">まだ記録がありません</p>'; return; }
  list.innerHTML = h.slice(0, 6).map(e => `
    <div class="history-row">
      <span class="history-date">${e.date}</span>
      <span class="history-cost">¥${e.cost.toLocaleString()}</span>
      <span class="history-time">${e.timeStr}</span>
    </div>`).join('');
}

// ── Init ───────────────────────────────────────────────
renderParticipants();
renderHistory();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js');
