'use strict';

/* ================= 状態管理 ================= */
const KEY = 'impulse_brake_v1';
const DAY = 24 * 60 * 60 * 1000;
const CHECKIN_AFTER = 3 * DAY; // 買ってから3日でチェックイン

/** @typedef {{id:string,name:string,price:number,memo:string,
 * status:'cooling'|'bought'|'skipped',createdAt:number,cooldownUntil:number,
 * regret:null|boolean,ratedAt:number|null}} Item */

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { items: [], onboarded: false };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ================= 集計 ================= */
function ratedBought() {
  return state.items.filter(i => i.status === 'bought' && i.regret !== null);
}
function regretRate() {
  const rated = ratedBought();
  if (rated.length === 0) return null;
  const regretted = rated.filter(i => i.regret === true).length;
  return Math.round((regretted / rated.length) * 100);
}
function skippedItems() {
  return state.items.filter(i => i.status === 'skipped');
}
function skippedTotal() {
  return skippedItems().reduce((sum, i) => sum + (Number(i.price) || 0), 0);
}
function skippedCount() {
  return skippedItems().length;
}
const yen = n => '¥' + (Number(n) || 0).toLocaleString('ja-JP');

// アイテムの表示名: メモ優先、無ければ日付ベースの控えめな名前
function displayName(i) {
  if (i.memo) return i.memo;
  if (i.name) return i.name;
  return 'この買い物';
}

// スクショを小さなサムネイル(dataURL)に縮小してlocalStorageに収める
function fileToThumb(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('not image')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 240;
        let { width, height } = img;
        if (width > height && width > MAX) { height = height * MAX / width; width = MAX; }
        else if (height > MAX) { width = width * MAX / height; height = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        try { resolve(canvas.toDataURL('image/jpeg', 0.6)); }
        catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// スクショ(あれば)＋表示名＋メタ(値段/補足)のヘッダDOMを作る
function itemHead(i, metaSuffix) {
  const head = document.createElement('div');
  head.className = 'item-head';
  if (i.thumb) {
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = i.thumb;
    img.alt = '';
    head.appendChild(img);
  }
  const info = document.createElement('div');
  info.className = 'item-info';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = displayName(i);
  info.appendChild(name);
  const parts = [];
  if (Number(i.price) > 0) parts.push(yen(i.price));
  if (metaSuffix) parts.push(metaSuffix);
  if (parts.length) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = parts.join('・');
    info.appendChild(meta);
  }
  head.appendChild(info);
  return head;
}

/* ================= 画面遷移 ================= */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
  const el = document.getElementById(id);
  if (el) el.classList.add('visible');
  window.scrollTo(0, 0);
}

/* ================= ホーム描画 ================= */
function renderHome() {
  const rr = regretRate();
  document.getElementById('regret-rate').textContent = rr === null ? '—' : rr + '%';
  const skippedYen = skippedTotal();
  const skippedN = skippedCount();
  document.getElementById('skipped-total').textContent = skippedYen > 0 ? yen(skippedYen) : skippedN + '回';
  document.getElementById('skipped-label').textContent = skippedYen > 0 ? '見送った金額' : '見送った回数';
  document.getElementById('share-skipped').hidden = skippedN <= 0;

  const cooling = state.items
    .filter(i => i.status === 'cooling')
    .sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  document.getElementById('cooling-count').textContent = cooling.length ? `(${cooling.length})` : '';

  const list = document.getElementById('cooling-list');
  list.innerHTML = '';
  if (cooling.length === 0) {
    list.innerHTML = '<li class="muted">いま再考中のものはありません。</li>';
  } else {
    cooling.forEach(i => list.appendChild(coolingCard(i)));
  }

  renderCheckin();
}

function coolingCard(i) {
  const li = document.createElement('li');
  li.className = 'card';
  const remain = i.cooldownUntil - Date.now();
  const ready = remain <= 0;

  li.appendChild(itemHead(i));

  const row = document.createElement('div');
  row.className = 'row';

  if (ready) {
    const stop = document.createElement('button');
    stop.className = 'primary';
    stop.textContent = 'やめる（見送る）';
    stop.onclick = () => { setStatus(i.id, 'skipped'); renderHome(); };

    const buy = document.createElement('button');
    buy.className = 'ghost';
    buy.textContent = 'やっぱり買う';
    buy.onclick = () => { markBought(i.id); renderHome(); };

    row.append(stop, buy);
  } else {
    const cd = document.createElement('div');
    cd.className = 'countdown';
    cd.dataset.until = String(i.cooldownUntil);
    cd.textContent = fmtRemain(remain);
    row.appendChild(cd);
  }
  li.appendChild(row);
  return li;
}

function fmtRemain(ms) {
  if (ms <= 0) return '待機おわり';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = n => String(n).padStart(2, '0');
  return `あと ${pad(h)}:${pad(m)}:${pad(s)}`;
}

/* カウントダウンを1秒ごとに更新。0になったら作り直す */
setInterval(() => {
  const nodes = document.querySelectorAll('.countdown[data-until]');
  let needRerender = false;
  nodes.forEach(node => {
    const remain = Number(node.dataset.until) - Date.now();
    if (remain <= 0) needRerender = true;
    else node.textContent = fmtRemain(remain);
  });
  if (needRerender && document.getElementById('home').classList.contains('visible')) {
    renderHome();
  }
}, 1000);

/* ================= 後悔チェックイン ================= */
function renderCheckin() {
  const due = state.items.filter(i =>
    i.status === 'bought' && i.regret === null &&
    (Date.now() - i.createdAt) >= CHECKIN_AFTER
  );
  const block = document.getElementById('checkin-block');
  const list = document.getElementById('checkin-list');
  list.innerHTML = '';
  if (due.length === 0) { block.hidden = true; return; }
  block.hidden = false;

  due.forEach(i => {
    const li = document.createElement('li');
    li.className = 'card';
    li.appendChild(itemHead(i, '数日前に購入'));

    const row = document.createElement('div');
    row.className = 'row';
    const bad = document.createElement('button');
    bad.className = 'ghost';
    bad.textContent = '後悔した';
    bad.onclick = () => { rate(i.id, true); renderHome(); };
    const good = document.createElement('button');
    good.className = 'primary';
    good.textContent = 'よかった';
    good.onclick = () => { rate(i.id, false); renderHome(); };
    row.append(bad, good);
    li.appendChild(row);
    list.appendChild(li);
  });
}

/* ================= 状態変更 ================= */
function setStatus(id, status) {
  const i = state.items.find(x => x.id === id);
  if (!i) return;
  i.status = status;
  if (status === 'skipped') i.thumb = null; // 見送り済みは表示しない→容量節約
  save();
}
function markBought(id) {
  const i = state.items.find(x => x.id === id);
  if (!i) return;
  i.status = 'bought';
  i.regret = null;
  i.ratedAt = null;
  i.createdAt = Date.now(); // 購入確定時点からチェックインを数える
  save();
}
function rate(id, regret) {
  const i = state.items.find(x => x.id === id);
  if (!i) return;
  i.regret = regret;
  i.ratedAt = Date.now();
  i.thumb = null; // 評価済み(チェックイン完了)は表示しない→容量節約
  save();
}

/* ================= ポーズ本編 ================= */
let pending = null;       // 判断待ちの入力
let pendingThumb = null;  // 貼ったスクショのサムネイル(dataURL)

async function onPhotoPick(e) {
  const file = e.target.files && e.target.files[0];
  const prev = document.getElementById('p-preview');
  if (!file) { pendingThumb = null; prev.hidden = true; prev.removeAttribute('src'); return; }
  try {
    pendingThumb = await fileToThumb(file);
    prev.src = pendingThumb;
    prev.hidden = false;
  } catch (_) {
    pendingThumb = null;
    prev.hidden = true; prev.removeAttribute('src');
    alert('この画像は読み込めませんでした。別のスクショを試してください。');
  }
}

async function startPauseResult() {
  const price = Number(document.getElementById('p-price').value) || 0;
  const memo = document.getElementById('p-memo').value.trim();
  // スクショ・メモ・値段のどれも無ければ、手がかりを1つ求める
  if (!pendingThumb && !memo && !price) { document.getElementById('p-memo').focus(); return; }

  pending = { name: '', price, memo, thumb: pendingThumb };
  document.getElementById('pause-input').hidden = true;
  const result = document.getElementById('pause-result');
  result.hidden = false;

  // 後悔率バナー
  const banner = document.getElementById('regret-banner');
  const rr = regretRate();
  if (rr === null) {
    banner.className = 'banner';
    banner.innerHTML = 'まだ後悔率のデータがありません。今日から積み上げていきましょう。';
  } else {
    banner.className = rr >= 30 ? 'banner' : 'banner good';
    banner.innerHTML = `あなたは勢いで買った物の <b>${rr}%</b> を後悔しています。それでも、これは要る？`;
  }

  // AI3問
  const ol = document.getElementById('questions');
  ol.innerHTML = '<li class="loading">未来のあなたが考えています…</li>';
  const qs = await getQuestions(pending);
  ol.innerHTML = '';
  qs.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    ol.appendChild(li);
  });
}

async function getQuestions({ name, price, memo }) {
  const label = memo || name || 'これ';
  try {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: label, price, memo }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length) {
        return data.questions.slice(0, 3);
      }
    }
  } catch (_) { /* オフライン等 → モックへ */ }
  return mockQuestions(label, price);
}

/* 鍵なし・オフライン時のモック（未来の自分の声） */
function mockQuestions(label, price) {
  const p = price ? yen(price) : 'そのお金';
  return [
    `「${label}」、実際に使う場面を具体的に1つ言える？ 言えないなら、たぶん要らない。`,
    `いま家にある物で代わりになるものは本当にない？ ${p}を出す前に一度見回してみて。`,
    `届いた「${label}」の置き場所は、もう決まってる？ 決まってないなら、増えるだけかも。`,
  ];
}

function coolIt() {
  if (!pending) return;
  /** @type {Item} */
  const item = {
    id: uid(), name: pending.name, price: pending.price, memo: pending.memo, thumb: pending.thumb || null,
    status: 'cooling', createdAt: Date.now(), cooldownUntil: Date.now() + DAY,
    regret: null, ratedAt: null,
  };
  state.items.push(item);
  save();
  pending = null;
  resetPause();
  show('home'); renderHome();
}

function buyAnyway() {
  if (!pending) return;
  const item = {
    id: uid(), name: pending.name, price: pending.price, memo: pending.memo, thumb: pending.thumb || null,
    status: 'bought', createdAt: Date.now(), cooldownUntil: 0,
    regret: null, ratedAt: null,
  };
  state.items.push(item);
  save();
  pending = null;
  resetPause();
  show('home'); renderHome();
}

function resetPause() {
  pendingThumb = null;
  const photo = document.getElementById('p-photo');
  if (photo) photo.value = '';
  const prev = document.getElementById('p-preview');
  prev.hidden = true; prev.removeAttribute('src');
  document.getElementById('p-price').value = '';
  document.getElementById('p-memo').value = '';
  document.getElementById('pause-input').hidden = false;
  document.getElementById('pause-result').hidden = true;
}

/* ================= オンボーディング（後悔率シード） ================= */
let seedCount = 0;
function addSeed(regret) {
  const name = document.getElementById('s-name').value.trim() || '（名称なし）';
  state.items.push({
    id: uid(), name, price: 0, memo: 'seed',
    status: 'bought', createdAt: 0, cooldownUntil: 0,
    regret, ratedAt: Date.now(),
  });
  save();
  seedCount++;
  document.getElementById('seed-count').textContent = `${seedCount}件 記録しました。続けてもOK、これで始めてもOK`;
  const chip = document.createElement('li');
  chip.className = 'chip ' + (regret ? 'chip-regret' : 'chip-ok');
  chip.textContent = `${name}：${regret ? '後悔' : 'よかった'}`;
  document.getElementById('seed-list').appendChild(chip);
  document.getElementById('s-name').value = '';
  document.getElementById('s-name').focus();
}

/* ================= シェア ================= */
async function shareSkipped() {
  const total = skippedTotal();
  const n = skippedCount();
  const rr = regretRate();
  let text = total > 0
    ? `衝動ブレーキで、これまで ${yen(total)} 分の勢い買いを見送れました。`
    : `衝動ブレーキで、これまで ${n}回 の勢い買いを見送れました。`;
  if (rr !== null) text += `（勢い買いの後悔率は${rr}%）`;
  text += ' #衝動ブレーキ';
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // ユーザーが共有をキャンセル
      // それ以外の失敗はクリップボードfallbackへ落とす
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    alert('シェア文をコピーしました。');
  } catch (_) {
    alert(text);
  }
}

/* ================= 初期化 / イベント ================= */
function bind() {
  document.getElementById('start-pause').onclick = () => { resetPause(); show('pause'); };
  document.getElementById('p-photo').onchange = onPhotoPick;
  document.getElementById('p-go').onclick = startPauseResult;
  document.getElementById('p-cool').onclick = coolIt;
  document.getElementById('p-buy').onclick = buyAnyway;
  document.getElementById('open-shortcut').onclick = () => show('shortcut');
  document.getElementById('share-skipped').onclick = shareSkipped;

  document.querySelectorAll('.back').forEach(b => {
    b.onclick = () => { show(b.dataset.to || 'home'); renderHome(); };
  });

  document.querySelectorAll('[data-seed]').forEach(b => {
    b.onclick = () => addSeed(b.dataset.seed === 'regret');
  });
  document.getElementById('seed-done').onclick = () => {
    state.onboarded = true; save();
    show('home'); renderHome();
  };
}

function init() {
  bind();
  if (!state.onboarded) {
    show('onboard');
  } else {
    show('home'); renderHome();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();
