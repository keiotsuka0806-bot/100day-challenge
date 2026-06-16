/* ============================================================
   ストレージ抽象化
   - firebase-config.js で window.QRPOLL_FIREBASE_CONFIG を定義すると
     Firestore（複数スマホでリアルタイム同期）に昇格。
   - 未定義なら localStorage デモモード（同一ブラウザのタブ間で同期）。
   ============================================================ */

function makeFirestoreBackend(config) {
  firebase.initializeApp(config);
  const db = firebase.firestore();
  const col = db.collection('qrpolls');
  return {
    mode: 'firebase',
    async createPoll(poll) {
      await col.doc(poll.id).set(poll);
    },
    subscribe(id, cb) {
      return col.doc(id).onSnapshot((doc) => cb(doc.exists ? doc.data() : null));
    },
    async vote(id, index) {
      await db.runTransaction(async (tx) => {
        const ref = col.doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data();
        if (!data.options[index]) return;
        data.options[index].votes = (data.options[index].votes || 0) + 1;
        tx.update(ref, { options: data.options });
      });
    },
  };
}

function makeLocalBackend() {
  const KEY = (id) => `qrpoll_${id}`;
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('qrpoll') : null;
  const listeners = {};

  const read = (id) => {
    try { return JSON.parse(localStorage.getItem(KEY(id))); } catch { return null; }
  };
  const notify = (id) => {
    const poll = read(id);
    (listeners[id] || []).forEach((cb) => cb(poll));
  };

  if (channel) channel.onmessage = (e) => { if (e.data && e.data.id) notify(e.data.id); };
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('qrpoll_')) notify(e.key.slice('qrpoll_'.length));
  });

  return {
    mode: 'local',
    async createPoll(poll) {
      localStorage.setItem(KEY(poll.id), JSON.stringify(poll));
    },
    subscribe(id, cb) {
      (listeners[id] = listeners[id] || []).push(cb);
      cb(read(id));
      return () => { listeners[id] = (listeners[id] || []).filter((f) => f !== cb); };
    },
    async vote(id, index) {
      const poll = read(id);
      if (!poll || !poll.options[index]) return;
      poll.options[index].votes = (poll.options[index].votes || 0) + 1;
      localStorage.setItem(KEY(id), JSON.stringify(poll));
      if (channel) channel.postMessage({ id });
      (listeners[id] || []).forEach((cb) => cb(poll));
    },
  };
}

let backend;
try {
  if (window.QRPOLL_FIREBASE_CONFIG) {
    backend = makeFirestoreBackend(window.QRPOLL_FIREBASE_CONFIG);
  } else {
    backend = makeLocalBackend();
  }
} catch {
  backend = makeLocalBackend();
}

/* ============================================================ */

const $ = (id) => document.getElementById(id);
const views = ['createView', 'hostView', 'voteView', 'notFound'];
const showView = (id) => views.forEach((v) => $(v).classList.toggle('hidden', v !== id));

const newId = () => Math.random().toString(36).slice(2, 8);
const votedKey = (id) => `qrpoll_voted_${id}`;

function parseHash() {
  const h = location.hash.replace(/^#/, '');
  const [key, value] = h.split('=');
  return { key, value };
}

/* ---------- 作成画面 ---------- */
function addOptionInput(value = '') {
  const row = document.createElement('div');
  row.className = 'option-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '選択肢';
  input.maxLength = 60;
  input.value = value;
  const del = document.createElement('button');
  del.textContent = '×';
  del.setAttribute('aria-label', '選択肢を削除');
  del.onclick = () => {
    if ($('options').children.length > 2) row.remove();
  };
  row.append(input, del);
  $('options').appendChild(row);
}

function setupCreate() {
  $('options').textContent = '';
  addOptionInput('はい');
  addOptionInput('いいえ');
  $('modeNote').textContent = backend.mode === 'firebase'
    ? 'リアルタイムモード：複数のスマホから同時に投票できます。'
    : 'デモモード：いまは同じブラウザのタブ間でのみ同期します（本番の複数端末同期はREADMEのFirebase設定で有効化）。';
}

async function createPoll() {
  const question = $('question').value.trim();
  const opts = [...$('options').querySelectorAll('input')]
    .map((i) => i.value.trim())
    .filter(Boolean);
  if (!question) { alert('質問を入力してください'); return; }
  if (opts.length < 2) { alert('選択肢を2つ以上入れてください'); return; }

  const poll = {
    id: newId(),
    question,
    options: opts.map((text) => ({ text, votes: 0 })),
    createdAt: Date.now(),
  };
  await backend.createPoll(poll);
  location.hash = `host=${poll.id}`;
}

/* ---------- 結果バー描画 ---------- */
function renderResults(container, poll) {
  const total = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
  container.textContent = '';
  poll.options.forEach((o) => {
    const pct = total ? Math.round(((o.votes || 0) / total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'result';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = `${pct}%`;
    const head = document.createElement('div');
    head.className = 'result-head';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = o.text;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${o.votes || 0}票`;
    const pctSpan = document.createElement('span');
    pctSpan.className = 'pct';
    pctSpan.textContent = `${pct}%`;
    count.appendChild(pctSpan);
    head.append(label, count);
    row.append(fill, head);
    container.appendChild(row);
  });
  return total;
}

/* ---------- 主催者画面 ---------- */
let unsubscribe = null;

function renderQr(url) {
  const box = $('qrcode');
  box.textContent = '';
  if (typeof qrcode !== 'function') {
    box.textContent = 'QRライブラリを読み込めませんでした';
    return;
  }
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  // URLはQRのモジュール(白黒)として符号化され、テキストとして挿入されないためXSS無し
  box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
  const svg = box.querySelector('svg');
  if (svg) {
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '200');
  }
}

function openHost(id) {
  if (unsubscribe) unsubscribe();
  const voteUrl = `${location.origin}${location.pathname}#vote=${id}`;
  $('voteUrl').value = voteUrl;

  renderQr(voteUrl);

  unsubscribe = backend.subscribe(id, (poll) => {
    if (!poll) { showView('notFound'); return; }
    $('hostQuestion').textContent = poll.question;
    const total = renderResults($('hostResults'), poll);
    $('hostTotal').textContent = `合計 ${total}票`;
    showView('hostView');
  });
}

/* ---------- 投票画面 ---------- */
function openVote(id) {
  if (unsubscribe) unsubscribe();
  unsubscribe = backend.subscribe(id, (poll) => {
    if (!poll) { showView('notFound'); return; }
    $('voteQuestion').textContent = poll.question;
    const already = localStorage.getItem(votedKey(id));

    if (already) {
      $('voteOptions').classList.add('hidden');
      $('voteThanks').classList.remove('hidden');
      const total = renderResults($('voteResults'), poll);
      $('voteTotal').textContent = `合計 ${total}票`;
    } else {
      $('voteOptions').classList.remove('hidden');
      $('voteThanks').classList.add('hidden');
      const box = $('voteOptions');
      box.textContent = '';
      poll.options.forEach((o, i) => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.textContent = o.text;
        btn.onclick = async () => {
          localStorage.setItem(votedKey(id), String(i));
          await backend.vote(id, i);
        };
        box.appendChild(btn);
      });
    }
    showView('voteView');
  });
}

/* ---------- ルーティング ---------- */
function route() {
  const { key, value } = parseHash();
  if (key === 'host' && value) {
    openHost(value);
  } else if (key === 'vote' && value) {
    openVote(value);
  } else {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    setupCreate();
    showView('createView');
  }
}

/* ---------- 配線 ---------- */
$('addOptionBtn').onclick = () => addOptionInput();
$('createBtn').onclick = createPoll;
$('newPollBtn').onclick = () => { location.hash = ''; };
$('goCreateBtn').onclick = () => { location.hash = ''; };
$('copyBtn').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('voteUrl').value);
    $('copyBtn').textContent = '✓';
    setTimeout(() => ($('copyBtn').textContent = 'コピー'), 1500);
  } catch {
    $('voteUrl').select();
  }
};

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
