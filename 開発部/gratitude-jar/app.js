'use strict';

/* ====== 状態 ====== */
const STORE_KEY = 'gratitude_jar_v1';
const SOUND_KEY = 'gratitude_jar_sound';

const state = {
  entries: load(),                       // [{to, text, ts}]
  soundOn: localStorage.getItem(SOUND_KEY) !== 'off',
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.entries));
}

/* ====== DOM ====== */
const $ = (id) => document.getElementById(id);
const canvas = $('jar');
const ctx = canvas.getContext('2d');
const toInput = $('toInput');
const forInput = $('forInput');
const dropBtn = $('dropBtn');

// アクセシビリティ：動きを減らす設定なら、瞬き・漂いを止める（落下は本質的なので残す）
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ====== 日付ユーティリティ ====== */
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const addedToday = () =>
  state.entries.some((e) => dayKey(e.ts) === dayKey(Date.now()));

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ====== 宇宙瓶の描画 ====== */
let W = 0, H = 0, dpr = 1;
let ambientStars = [];   // 背景の星（宇宙の雰囲気）
let motes = [];          // 溜まったありがとうの光（下にたまる）
let drops = [];          // 落下中の光
let jarRect = { x: 0, y: 0, w: 0, h: 0 };

const MAX_MOTES = 140;           // 描画する光の最大数
const POOL_TARGET = 60;          // この数で宇宙が満ちる

function makeRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  W = rect.width; H = rect.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layoutJar();
  buildAmbientStars();
  rebuildMotes();
}

function layoutJar() {
  const w = Math.min(W * 0.62, 216);
  const h = Math.min(w * 1.62, H * 0.98);
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  jarRect = { x, y, w, h };
}

// リアルな薬瓶（コルク・首・丸い肩・円筒の胴・丸い底）
function jarGeom() {
  const { x, y, w, h } = jarRect;
  return {
    x, y, w, h,
    cx: x + w / 2,
    corkTopHalf: w * 0.155,
    corkBotHalf: w * 0.135,
    yCorkTop: y + h * 0.012,
    yCorkBot: y + h * 0.072,
    rimHalf: w * 0.205,
    yRim: y + h * 0.075,
    neckHalf: w * 0.16,
    yNeckBot: y + h * 0.125,
    bodyHalf: w * 0.5,
    shoulderY: y + h * 0.225,
    yBodyBot: y + h * 0.965,
    bottomR: w * 0.13,
    get galaxyTop() { return this.yNeckBot; },
    get galaxyBot() { return this.yBodyBot; },
  };
}

function jarBodyPath(p) {
  const g = jarGeom();
  const lipH = g.h * 0.013;
  p.moveTo(g.cx - g.rimHalf, g.yRim);
  p.lineTo(g.cx - g.rimHalf, g.yRim + lipH);
  p.lineTo(g.cx - g.neckHalf, g.yNeckBot);
  p.quadraticCurveTo(g.cx - g.bodyHalf, g.shoulderY - (g.shoulderY - g.yNeckBot) * 0.25, g.cx - g.bodyHalf, g.shoulderY);
  p.lineTo(g.cx - g.bodyHalf, g.yBodyBot - g.bottomR);
  p.quadraticCurveTo(g.cx - g.bodyHalf, g.yBodyBot, g.cx - g.bodyHalf + g.bottomR, g.yBodyBot);
  p.lineTo(g.cx + g.bodyHalf - g.bottomR, g.yBodyBot);
  p.quadraticCurveTo(g.cx + g.bodyHalf, g.yBodyBot, g.cx + g.bodyHalf, g.yBodyBot - g.bottomR);
  p.lineTo(g.cx + g.bodyHalf, g.shoulderY);
  p.quadraticCurveTo(g.cx + g.bodyHalf, g.shoulderY - (g.shoulderY - g.yNeckBot) * 0.25, g.cx + g.neckHalf, g.yNeckBot);
  p.lineTo(g.cx + g.rimHalf, g.yRim + lipH);
  p.lineTo(g.cx + g.rimHalf, g.yRim);
  p.closePath();
}

// 背景の星（位置は固定。宇宙の雰囲気。明るさは件数で増す）
function buildAmbientStars() {
  ambientStars = [];
  const g = jarGeom();
  const top = g.galaxyTop, bot = g.galaxyBot;
  const r = makeRand(20260617);
  const N = 48;
  for (let i = 0; i < N; i++) {
    const golden = r() < 0.14;
    ambientStars.push({
      x: g.cx + (r() - 0.5) * g.bodyHalf * 1.8,
      y: top + r() * (bot - top) * 0.72,         // 上の方＝空
      size: golden ? 1.3 + r() * 1.3 : 0.5 + r() * 1.4,
      golden,
      hue: golden ? 44 + r() * 8 : (r() < 0.5 ? 196 : 50),
      base: 0.4 + r() * 0.5,
      speed: 0.6 + r() * 1.8,
      phase: r() * 6.283,
    });
  }
}

// たまった光の水面の高さ（件数で上がる）
function poolSurfaceY(g) {
  const fill = Math.min(1, state.entries.length / POOL_TARGET);
  const poolBot = g.yBodyBot - 6;
  return poolBot - (poolBot - g.galaxyTop) * Math.max(0.08, fill * 0.8);
}

// 溜まったありがとうの光（下にたまる）
function rebuildMotes() {
  motes = [];
  const g = jarGeom();
  const n = Math.min(state.entries.length, MAX_MOTES);
  const poolBot = g.yBodyBot - 6;
  const top = poolSurfaceY(g);
  for (let i = 0; i < n; i++) {
    const mx = g.cx + (Math.random() - 0.5) * g.bodyHalf * 1.7;
    const my = top + Math.random() * (poolBot - top);
    motes.push({
      bx: mx, by: my, x: mx, y: my,
      r: 3 + Math.random() * 3.4,
      hue: 42 + Math.random() * 14,
      phase: Math.random() * 6.283,
      speed: 0.4 + Math.random() * 0.6,
    });
  }
}

let raf = null;
function tick(t) {
  ctx.clearRect(0, 0, W, H);
  const time = t * 0.001;
  const T = reduceMotion ? 0 : time;     // 動き低減時は静止
  const g = jarGeom();
  const body = new Path2D();
  jarBodyPath(body);
  const top = g.galaxyTop, bot = g.galaxyBot;
  const n = state.entries.length;
  const fill = Math.min(1, n / POOL_TARGET);
  const surfaceY = poolSurfaceY(g);

  // --- 瓶の中（宇宙）。bodyにクリップ ---
  ctx.save();
  ctx.clip(body);
  // 深い藍の宇宙
  const sky = ctx.createLinearGradient(0, top, 0, bot);
  sky.addColorStop(0, 'rgba(9,16,34,0.96)');
  sky.addColorStop(1, 'rgba(6,11,24,0.98)');
  ctx.fillStyle = sky;
  ctx.fillRect(g.x, g.y, g.w, g.h);

  // 星雲（ティール）。件数があるほど濃く
  if (n > 0) {
    const neb = ctx.createRadialGradient(g.cx, top + (bot - top) * 0.4, 4, g.cx, top + (bot - top) * 0.46, g.bodyHalf * 2.3);
    neb.addColorStop(0, `rgba(60,175,185,${0.14 + fill * 0.2})`);
    neb.addColorStop(0.5, `rgba(42,95,150,${0.08 + fill * 0.12})`);
    neb.addColorStop(1, 'rgba(18,28,58,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(g.x, g.y, g.w, g.h);
  }

  // 背景の星（空っぽでも宇宙の予感をほのかに。件数で明るくなる）
  const aFade = n === 0 ? 0.14 : Math.min(1, 0.3 + fill);
  for (const s of ambientStars) {
    const a = s.base * aFade * (0.5 + 0.5 * Math.sin(T * s.speed + s.phase));
    if (a <= 0) continue;
    if (s.golden && n > 0) drawSparkle(s.x, s.y, s.size, a, s.hue);
    else {
      ctx.fillStyle = `hsla(${s.hue}, 70%, 92%, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (n > 0) {
    // 溜まった光の水面の金色グロー
    const gold = ctx.createRadialGradient(g.cx, surfaceY + (bot - surfaceY) * 0.3, 4, g.cx, surfaceY + (bot - surfaceY) * 0.2, g.bodyHalf * 1.7);
    gold.addColorStop(0, `rgba(255,202,112,${0.16 + fill * 0.24})`);
    gold.addColorStop(0.55, `rgba(220,150,72,${0.06 + fill * 0.1})`);
    gold.addColorStop(1, 'rgba(120,80,40,0)');
    ctx.fillStyle = gold;
    ctx.fillRect(g.x, g.y, g.w, g.h);

    // 溜まった光の粒
    for (const m of motes) {
      m.x = m.bx + Math.sin(T * m.speed + m.phase) * 3;
      m.y = m.by + Math.cos(T * m.speed * 0.8 + m.phase) * 2.4;
      drawGlow(m.x, m.y, m.r, m.hue, 0.9);
    }

    // 落下中の光（落ちて、たまる）
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += 0.35;
      d.y += d.vy;
      drawGlow(d.x, d.y, d.r, 46, 1);
      const landY = poolSurfaceY(g) + 4 + (Math.random() * 6);
      if (d.y >= landY) {
        drops.splice(i, 1);
        rebuildMotes();           // 着地したら、たまりに加わる
      }
    }
  }
  ctx.restore();

  // --- ガラスの質感（bodyにクリップ） ---
  ctx.save();
  ctx.clip(body);
  const edgeL = ctx.createLinearGradient(g.cx - g.bodyHalf, 0, g.cx - g.bodyHalf + g.w * 0.16, 0);
  edgeL.addColorStop(0, 'rgba(120,205,225,0.4)');
  edgeL.addColorStop(1, 'rgba(120,205,225,0)');
  ctx.fillStyle = edgeL;
  ctx.fillRect(g.cx - g.bodyHalf, g.yNeckBot, g.w * 0.16, g.h);
  const edgeR = ctx.createLinearGradient(g.cx + g.bodyHalf, 0, g.cx + g.bodyHalf - g.w * 0.13, 0);
  edgeR.addColorStop(0, 'rgba(120,190,220,0.3)');
  edgeR.addColorStop(1, 'rgba(120,190,220,0)');
  ctx.fillStyle = edgeR;
  ctx.fillRect(g.cx + g.bodyHalf - g.w * 0.13, g.yNeckBot, g.w * 0.13, g.h);
  // 左上の反射スジ（ぼかす）
  ctx.filter = 'blur(2.5px)';
  ctx.fillStyle = 'rgba(225,245,255,0.55)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(g.cx - g.bodyHalf * 0.72, g.shoulderY + g.h * 0.02, g.w * 0.018, g.h * 0.2, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(g.cx - g.bodyHalf * 0.58, g.shoulderY + g.h * 0.05, g.w * 0.012, g.h * 0.12, 3);
    ctx.fill();
  }
  ctx.filter = 'none';
  ctx.restore();

  // 胴の輪郭
  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  const og = ctx.createLinearGradient(g.cx - g.bodyHalf, 0, g.cx + g.bodyHalf, 0);
  og.addColorStop(0, 'rgba(150,210,225,0.85)');
  og.addColorStop(0.5, 'rgba(225,245,252,0.45)');
  og.addColorStop(1, 'rgba(130,195,220,0.8)');
  ctx.strokeStyle = og;
  ctx.stroke(body);
  ctx.restore();

  // 首のリム（口）ハイライト
  ctx.save();
  ctx.strokeStyle = 'rgba(220,245,252,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(g.cx - g.rimHalf, g.yRim);
  ctx.lineTo(g.cx + g.rimHalf, g.yRim);
  ctx.stroke();
  ctx.restore();

  // コルク
  drawCork(g);

  raf = requestAnimationFrame(tick);
}

function drawGlow(x, y, r, hue, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
  g.addColorStop(0, `hsla(${hue}, 100%, 75%, ${alpha})`);
  g.addColorStop(0.4, `hsla(${hue}, 95%, 62%, ${alpha * 0.5})`);
  g.addColorStop(1, `hsla(${hue}, 90%, 55%, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSparkle(x, y, size, alpha, hue) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, size * 3.2);
  g.addColorStop(0, `hsla(${hue}, 100%, 82%, ${alpha})`);
  g.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, size * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `hsla(${hue}, 100%, 88%, ${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - size * 2.4, y); ctx.lineTo(x + size * 2.4, y);
  ctx.moveTo(x, y - size * 2.4); ctx.lineTo(x, y + size * 2.4);
  ctx.stroke();
}

function drawCork(g) {
  const topHalf = g.corkTopHalf, botHalf = g.corkBotHalf;
  ctx.save();
  const cg = ctx.createLinearGradient(g.cx - botHalf, 0, g.cx + botHalf, 0);
  cg.addColorStop(0, '#74502e');
  cg.addColorStop(0.5, '#b3824f');
  cg.addColorStop(1, '#6a4526');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(g.cx - topHalf + 4, g.yCorkTop);
  ctx.lineTo(g.cx + topHalf - 4, g.yCorkTop);
  ctx.quadraticCurveTo(g.cx + topHalf, g.yCorkTop, g.cx + topHalf, g.yCorkTop + 5);
  ctx.lineTo(g.cx + botHalf, g.yCorkBot);
  ctx.lineTo(g.cx - botHalf, g.yCorkBot);
  ctx.lineTo(g.cx - topHalf, g.yCorkTop + 5);
  ctx.quadraticCurveTo(g.cx - topHalf, g.yCorkTop, g.cx - topHalf + 4, g.yCorkTop);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(75,48,24,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const yy = g.yCorkTop + (g.yCorkBot - g.yCorkTop) * i / 3;
    ctx.beginPath();
    ctx.moveTo(g.cx - topHalf * 0.88, yy);
    ctx.lineTo(g.cx + topHalf * 0.88, yy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,232,194,0.22)';
  ctx.beginPath();
  ctx.ellipse(g.cx, g.yCorkTop + 3, topHalf * 0.66, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function launchDrop() {
  const g = jarGeom();
  drops.push({
    x: g.cx + (Math.random() - 0.5) * g.bodyHalf * 0.9,
    y: g.galaxyTop + 6,
    vy: 1,
    r: 6,
  });
}

/* ====== 音（やさしいチャイム） ====== */
let audioCtx = null;
function chime() {
  if (!state.soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [0, 0.12, 0.26].forEach((dt, i) => {
      const f = [659.25, 783.99, 987.77][i]; // E5, G5, B5
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now + dt);
      gain.gain.linearRampToValueAtTime(0.18, now + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dt + 1.1);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + dt);
      osc.stop(now + dt + 1.2);
    });
  } catch {}
}

/* ====== UI 更新 ====== */
function refresh() {
  const n = state.entries.length;
  $('countLabel').textContent = n === 0 ? 'まだ空っぽ' : `${n} こ の ありがとうが 貯まっています`;
  const done = addedToday();
  $('todayPrompt').textContent = done
    ? '今日のありがとうは入れました。まだあれば、もう一つどうぞ'
    : '今日は、誰に「ありがとう」？';
  $('jarHint').textContent = n === 0
    ? '最初の「ありがとう」で、宇宙が生まれます'
    : '瓶をタップすると、過去のありがとうを引き出せます';
  $('withdrawBtn').disabled = n === 0;
  $('listBtn').disabled = n === 0;
  $('shareBtn').disabled = n === 0;
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ====== 入れる ====== */
function drop() {
  const to = toInput.value.trim();
  const text = forInput.value.trim();
  if (!text) { forInput.focus(); toast('「何が、ありがとう？」を一言だけ'); return; }
  const before = state.entries.length;
  state.entries.push({ to, text, ts: Date.now() });
  save();
  launchDrop();          // 光が落ちて、たまる（着地時に rebuildMotes）
  chime();
  toInput.value = '';
  forInput.value = '';
  refresh();

  const n = state.entries.length;
  const milestone = [10, 30, 60, 100, 365].find((m) => before < m && n >= m);
  if (milestone) toast(`🌟 ${milestone} こめの ありがとう。宇宙が広がりました`);
  else toast('光がひとつ、たまりました');
}

/* ====== 引き出す ====== */
function withdraw() {
  if (!state.entries.length) return;
  const e = state.entries[Math.floor(Math.random() * state.entries.length)];
  $('wTo').textContent = e.to ? `${e.to} へ` : '';
  $('wFor').textContent = e.text;
  $('wDate').textContent = fmtDate(e.ts);
  $('withdrawOverlay').hidden = false;
}

/* ====== 一覧 ====== */
function renderList() {
  const ul = $('entries');
  ul.innerHTML = '';
  if (!state.entries.length) {
    ul.innerHTML = '<li class="empty">まだ何も入っていません</li>';
  } else {
    [...state.entries].reverse().forEach((e) => {
      const li = document.createElement('li');
      const to = document.createElement('p'); to.className = 'e-to'; to.textContent = e.to ? `${e.to} へ` : 'ありがとう';
      const tx = document.createElement('p'); tx.className = 'e-for'; tx.textContent = e.text;
      const dt = document.createElement('p'); dt.className = 'e-date'; dt.textContent = fmtDate(e.ts);
      li.append(to, tx, dt);
      ul.appendChild(li);
    });
  }
  $('listOverlay').hidden = false;
}

/* ====== シェア（中身は出さない：宇宙＋件数のみ） ====== */
function shareJar() {
  const ex = document.createElement('canvas');
  const S = 1080;
  ex.width = S; ex.height = S;
  const c = ex.getContext('2d');
  const n = state.entries.length;
  const fill = Math.min(1, n / POOL_TARGET);
  const bg = c.createRadialGradient(S / 2, S * 0.4, 0, S / 2, S * 0.5, S * 0.8);
  bg.addColorStop(0, '#0d1530');
  bg.addColorStop(1, '#05080f');
  c.fillStyle = bg; c.fillRect(0, 0, S, S);
  // 星雲
  const neb = c.createRadialGradient(S / 2, S * 0.42, 10, S / 2, S * 0.48, S * 0.5);
  neb.addColorStop(0, `rgba(60,175,185,${0.18 + fill * 0.22})`);
  neb.addColorStop(1, 'rgba(18,28,58,0)');
  c.fillStyle = neb; c.fillRect(0, 0, S, S);
  // 背景の星
  for (let i = 0; i < 60; i++) {
    const r = makeRand(((i + 7) * 2654435761) >>> 0);
    const x = S * 0.18 + r() * S * 0.64;
    const y = S * 0.16 + r() * S * 0.42;
    c.fillStyle = `rgba(235,245,255,${(0.3 + r() * 0.6) * Math.min(1, 0.3 + fill)})`;
    c.beginPath(); c.arc(x, y, 1.5 + r() * 3, 0, Math.PI * 2); c.fill();
  }
  // たまった金色の光（下に積もる）
  const poolTop = S * 0.92 - (S * 0.5) * Math.max(0.1, fill * 0.8);
  const gld = c.createRadialGradient(S / 2, S * 0.85, 10, S / 2, S * 0.8, S * 0.5);
  gld.addColorStop(0, `rgba(255,202,112,${0.18 + fill * 0.25})`);
  gld.addColorStop(1, 'rgba(120,80,40,0)');
  c.fillStyle = gld; c.fillRect(0, 0, S, S);
  for (let i = 0; i < Math.min(n, 160); i++) {
    const x = S * 0.22 + Math.random() * S * 0.56;
    const y = poolTop + Math.random() * (S * 0.9 - poolTop);
    const r = 8 + Math.random() * 12;
    const gg = c.createRadialGradient(x, y, 0, x, y, r * 3);
    gg.addColorStop(0, 'rgba(255,224,150,0.9)');
    gg.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = gg; c.beginPath(); c.arc(x, y, r * 3, 0, Math.PI * 2); c.fill();
  }
  // テキスト
  c.textAlign = 'center';
  const today = new Date();
  c.font = '400 34px -apple-system, "Hiragino Sans", sans-serif';
  c.fillStyle = 'rgba(238,242,255,0.65)';
  c.fillText(`${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}　#ありがとうの貯金箱`, S / 2, S * 0.055);
  c.fillStyle = '#eef2ff';
  c.font = '600 60px -apple-system, "Hiragino Sans", sans-serif';
  c.fillText('ありがとうの貯金箱', S / 2, S * 0.135);
  c.font = '600 84px -apple-system, "Hiragino Sans", sans-serif';
  c.fillStyle = '#ffd27a';
  c.fillText(`ありがとう ${n}`, S / 2, S * 0.93);
  c.font = '400 32px -apple-system, "Hiragino Sans", sans-serif';
  c.fillStyle = 'rgba(238,242,255,0.6)';
  c.fillText('自分だけの宇宙が育っています', S / 2, S * 0.975);

  ex.toBlob((blob) => {
    if (!blob) { toast('画像を作れませんでした'); return; }
    const file = new File([blob], 'gratitude-universe.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'ありがとうの貯金箱', text: 'ありがとうを貯めて、自分だけの宇宙を育てています🌌 #ありがとうの貯金箱' }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gratitude-universe.png';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('宇宙の画像を保存しました');
    }
  }, 'image/png');
}

/* ====== イベント ====== */
dropBtn.addEventListener('click', drop);
forInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') drop();
});
canvas.addEventListener('click', withdraw);
$('withdrawBtn').addEventListener('click', withdraw);
$('listBtn').addEventListener('click', renderList);
$('shareBtn').addEventListener('click', shareJar);

$('soundToggle').addEventListener('click', (e) => {
  state.soundOn = !state.soundOn;
  localStorage.setItem(SOUND_KEY, state.soundOn ? 'on' : 'off');
  e.target.textContent = state.soundOn ? '♪ 音 on' : '♪ 音 off';
  e.target.setAttribute('aria-pressed', String(state.soundOn));
});

document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => {
    $('withdrawOverlay').hidden = true;
    $('listOverlay').hidden = true;
  })
);
document.querySelectorAll('.overlay').forEach((ov) =>
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.hidden = true; })
);

window.addEventListener('resize', resize);

/* ====== 起動 ====== */
$('soundToggle').textContent = state.soundOn ? '♪ 音 on' : '♪ 音 off';
resize();
refresh();
raf = requestAnimationFrame(tick);
