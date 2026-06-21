/* ============================================================
   ストレージ抽象化
   - firebase-config.js で window.QRPOLL_FIREBASE_CONFIG を定義すると
     Firestore（複数スマホでリアルタイム同期）に昇格。
   - 未定義なら localStorage デモモード（同一ブラウザのタブ間で同期）。
   vote(id, indices) は「1回の投票で選んだ複数の選択肢」を受け取り、
   各選択肢に+1し、回答者数(voters)を+1する（単一選択は indices.length===1）。
   ============================================================ */

function applyVote(data, indices, name) {
  indices.forEach((i) => {
    if (!data.options[i]) return;
    data.options[i].votes = (data.options[i].votes || 0) + 1;
    if (name) {
      data.options[i].names = data.options[i].names || [];
      data.options[i].names.push(name);
    }
  });
  data.voters = (data.voters || 0) + 1;
}

// 参加者が選択肢を追加（重複・上限・空をはじく）。追加したら true。
function applyAddOption(data, text) {
  const norm = (text || '').trim();
  if (!norm) return false;
  data.options = data.options || [];
  if (data.options.length >= 40) return false;
  const dup = data.options.some((o) => (o.text || '').trim().toLowerCase() === norm.toLowerCase());
  if (dup) return false;
  data.options.push({ text: norm, votes: 0 });
  return true;
}

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
    async vote(id, indices, name) {
      await db.runTransaction(async (tx) => {
        const ref = col.doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data();
        applyVote(data, indices, name);
        tx.update(ref, { options: data.options, voters: data.voters });
      });
    },
    async addOption(id, text) {
      await db.runTransaction(async (tx) => {
        const ref = col.doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data();
        if (applyAddOption(data, text)) tx.update(ref, { options: data.options });
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
    async vote(id, indices, name) {
      const poll = read(id);
      if (!poll) return;
      applyVote(poll, indices, name);
      localStorage.setItem(KEY(id), JSON.stringify(poll));
      if (channel) channel.postMessage({ id });
      (listeners[id] || []).forEach((cb) => cb(poll));
    },
    async addOption(id, text) {
      const poll = read(id);
      if (!poll) return;
      applyAddOption(poll, text);
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

/* ============================================================
   シーン定義（その場のシチュエーション別UX）
   ============================================================ */
const SCENES = {
  binary: {
    icon: '❓', name: '質問を作る',
    desc: '1つだけ選ぶ（複数選択不可）。今の空気を%で',
    multi: false, display: 'percent', body: 'options',
    qPlaceholder: '例：今日の二次会、行く？',
    voteHint: 'ひとつ選んでね',
  },
  multi: {
    icon: '✅', name: '複数選択アンケート',
    desc: '全部えらぶ。参加者が候補を追加もできる',
    multi: true, display: 'count', body: 'options',
    qPlaceholder: '例：最初の一杯、何にする？',
    voteHint: '当てはまるものを全部えらんで「決定」',
  },
  schedule: {
    icon: '📅', name: '日程を決める',
    desc: '行ける日を全部えらぶ。最多の日に◎',
    multi: true, display: 'count', body: 'dates', best: true,
    qPlaceholder: '例：次の飲み会、いつにする？',
    voteHint: '行ける日を全部えらんで「決定」',
  },
  rating: {
    icon: '⭐', name: '星評価・満足度',
    desc: '5段階で評価。平均点が出る',
    multi: false, display: 'rating', body: 'rating',
    qPlaceholder: '例：今日の勉強会、どうだった？',
    voteHint: '星をひとつえらんでね',
  },
};
const sceneOf = (poll) => SCENES[poll && poll.type] || SCENES.binary;

/* ============================================================ */

const $ = (id) => document.getElementById(id);
const views = ['createView', 'hostView', 'voteView', 'notFound'];
const showView = (id) => views.forEach((v) => $(v).classList.toggle('hidden', v !== id));

const newId = () => Math.random().toString(36).slice(2, 8);
const votedKey = (id) => `qrpoll_voted_${id}`;

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${Number(m[2])}/${Number(m[3])}（${WEEK[d.getDay()]}）`;
}

function parseHash() {
  const h = location.hash.replace(/^#/, '');
  const [key, value] = h.split('=');
  return { key, value };
}

/* ============================================================
   作成画面
   ============================================================ */
let currentScene = 'binary';
let currentNamed = false;

const NAME_KEY = 'qrpoll_voter_name';

function renderNamedToggle() {
  const box = $('namedToggle');
  box.querySelectorAll('.seg-btn').forEach((btn) => {
    const on = (btn.dataset.named === 'true') === currentNamed;
    btn.classList.toggle('active', on);
    btn.onclick = () => { currentNamed = btn.dataset.named === 'true'; renderNamedToggle(); };
  });
}

function renderScenePicker() {
  const box = $('scenePicker');
  box.textContent = '';
  Object.entries(SCENES).forEach(([key, s]) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'scene-card' + (key === currentScene ? ' active' : '');
    const icon = document.createElement('span');
    icon.className = 'scene-icon';
    icon.textContent = s.icon;
    const name = document.createElement('span');
    name.className = 'scene-name';
    name.textContent = s.name;
    const desc = document.createElement('span');
    desc.className = 'scene-desc';
    desc.textContent = s.desc;
    card.append(icon, name, desc);
    card.onclick = () => { currentScene = key; renderScenePicker(); renderCreateBody(); };
    box.appendChild(card);
  });
  $('question').placeholder = SCENES[currentScene].qPlaceholder;
}

function addOptionInput(value = '') {
  const row = document.createElement('div');
  row.className = 'option-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '選択肢';
  input.maxLength = 60;
  input.value = value;
  const del = document.createElement('button');
  del.type = 'button';
  del.textContent = '×';
  del.setAttribute('aria-label', '選択肢を削除');
  del.onclick = () => {
    if ($('optionList').children.length > 2) row.remove();
  };
  row.append(input, del);
  $('optionList').appendChild(row);
}

function fillOptions(values) {
  $('optionList').textContent = '';
  values.forEach((v) => addOptionInput(v));
}

function addDateChip(iso) {
  if (!iso) return;
  const list = $('dateList');
  const exists = [...list.querySelectorAll('[data-date]')].some((c) => c.dataset.date === iso);
  if (exists) return;
  const chip = document.createElement('div');
  chip.className = 'date-chip';
  chip.dataset.date = iso;
  const label = document.createElement('span');
  label.textContent = formatDate(iso);
  const del = document.createElement('button');
  del.type = 'button';
  del.textContent = '×';
  del.setAttribute('aria-label', '候補日を削除');
  del.onclick = () => chip.remove();
  chip.append(label, del);
  // 日付順に挿入
  const after = [...list.querySelectorAll('[data-date]')].find((c) => c.dataset.date > iso);
  list.insertBefore(chip, after || null);
}

function nextDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function matchesDayFilter(iso, filter) {
  if (!filter || filter === 'all') return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  const weekend = day === 0 || day === 6;
  return filter === 'weekend' ? weekend : !weekend;
}

// 開始〜終了を一括追加。終了が空（または開始より前）なら開始日だけ（フィルタは無視）。
// filter: 'all' | 'weekday' | 'weekend'。最大90日ぶん走査。
function addDateRange(start, end, filter) {
  if (!start) return;
  if (!end || end < start) { addDateChip(start); return; }
  let cur = start, guard = 0;
  while (cur <= end && guard < 90) {
    if (matchesDayFilter(cur, filter)) addDateChip(cur);
    cur = nextDay(cur);
    guard++;
  }
}

function renderCreateBody() {
  const body = $('createBody');
  body.textContent = '';
  const scene = SCENES[currentScene];

  if (scene.body === 'options') {
    if (currentScene === 'multi') {
      const check = document.createElement('label');
      check.className = 'check-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'allowAdd';
      cb.checked = true;
      const t = document.createElement('span');
      t.textContent = '参加者も選択肢を追加できる（例：最初の一杯を各自で入力）';
      check.append(cb, t);
      body.appendChild(check);
    }
    const field = document.createElement('div');
    field.className = 'field';
    const span = document.createElement('span');
    span.textContent = currentScene === 'multi'
      ? '最初の選択肢（空でもOK・参加者が足せます）'
      : '選択肢';
    const list = document.createElement('div');
    list.id = 'optionList';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn-ghost small';
    add.textContent = '＋ 選択肢を追加';
    add.onclick = () => addOptionInput();

    if (currentScene === 'binary') {
      const quick = document.createElement('div');
      quick.className = 'quick-row';
      [['はい', 'いいえ'], ['◯', '✕'], ['A', 'B', 'C', 'D']].forEach((vals) => {
        const qb = document.createElement('button');
        qb.type = 'button';
        qb.className = 'btn btn-ghost small';
        qb.textContent = vals.join('／');
        qb.onclick = () => fillOptions(vals);
        quick.appendChild(qb);
      });
      field.append(span, quick, list, add);
    } else {
      field.append(span, list, add);
    }
    body.appendChild(field);
    addOptionInput();
    addOptionInput();
  } else if (scene.body === 'dates') {
    const field = document.createElement('div');
    field.className = 'field';
    const span = document.createElement('span');
    span.textContent = '候補日（1日でも、連続した範囲でもまとめて追加）';
    const row = document.createElement('div');
    row.className = 'date-add-row';
    const today = new Date();
    const min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const start = document.createElement('input');
    start.type = 'date'; start.id = 'dateStart'; start.min = min;
    const sep = document.createElement('span');
    sep.className = 'date-sep'; sep.textContent = '〜';
    const end = document.createElement('input');
    end.type = 'date'; end.id = 'dateEnd'; end.min = min; end.title = '終了日（任意）';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn-ghost small';
    add.textContent = '＋ 追加';
    row.append(start, sep, end, add);

    const filter = document.createElement('div');
    filter.className = 'seg date-filter';
    [['all', 'すべて'], ['weekday', '平日'], ['weekend', '土日']].forEach(([f, txt], i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + (i === 0 ? ' active' : '');
      b.dataset.filter = f;
      b.textContent = txt;
      b.onclick = () => {
        filter.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      };
      filter.appendChild(b);
    });

    add.onclick = () => {
      const f = filter.querySelector('.seg-btn.active').dataset.filter;
      addDateRange(start.value, end.value, f);
      start.value = ''; end.value = '';
    };

    const hint = document.createElement('p');
    hint.className = 'date-range-hint';
    hint.textContent = '1日だけなら左だけ。範囲は右に終了日を入れ、平日／土日でしぼって追加できます。';
    const list = document.createElement('div');
    list.id = 'dateList';
    list.className = 'date-list';
    field.append(span, row, filter, hint, list);
    body.appendChild(field);
  } else if (scene.body === 'rating') {
    const note = document.createElement('p');
    note.className = 'rating-note';
    note.textContent = '参加者は ★1〜★5 で評価します。平均点とばらつきが出ます。';
    body.appendChild(note);
  }
}

function setupCreate() {
  renderScenePicker();
  renderNamedToggle();
  renderCreateBody();
  $('modeNote').textContent = backend.mode === 'firebase'
    ? 'リアルタイムモード：複数のスマホから同時に投票できます。'
    : 'デモモード：いまは同じブラウザのタブ間でのみ同期します（本番の複数端末同期はREADMEのFirebase設定で有効化）。';
}

async function createPoll() {
  const scene = SCENES[currentScene];
  const question = $('question').value.trim();
  if (!question) { alert('質問を入力してください'); return; }

  const allowAdd = currentScene === 'multi' && $('allowAdd') && $('allowAdd').checked;

  let options;
  if (scene.body === 'options') {
    options = [...$('optionList').querySelectorAll('input')]
      .map((i) => ({ text: i.value.trim() }))
      .filter((o) => o.text);
    if (!allowAdd && options.length < 2) { alert('選択肢を2つ以上入れてください'); return; }
  } else if (scene.body === 'dates') {
    options = [...$('dateList').querySelectorAll('[data-date]')]
      .map((c) => ({ text: c.dataset.date }));
    if (options.length < 2) { alert('候補日を2つ以上えらんでください'); return; }
  } else { // rating
    options = ['1', '2', '3', '4', '5'].map((text) => ({ text }));
  }

  const poll = {
    id: newId(),
    type: currentScene,
    question,
    named: currentNamed,
    allowAdd,
    options: options.map((o) => ({ text: o.text, votes: 0 })),
    voters: 0,
    createdAt: Date.now(),
  };
  await backend.createPoll(poll);
  location.hash = `host=${poll.id}`;
}

/* ============================================================
   結果の描画（シーン別）
   ============================================================ */
function renderStars(value, max = 5) {
  const full = Math.round(value);
  return '★'.repeat(Math.min(full, max)) + '☆'.repeat(Math.max(0, max - full));
}

function renderRating(container, poll) {
  const total = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
  const sum = poll.options.reduce((s, o, i) => s + (i + 1) * (o.votes || 0), 0);
  const avg = total ? sum / total : 0;

  const head = document.createElement('div');
  head.className = 'rating-head';
  const num = document.createElement('span');
  num.className = 'rating-avg';
  num.textContent = avg.toFixed(1);
  const stars = document.createElement('span');
  stars.className = 'rating-stars';
  stars.textContent = renderStars(avg);
  const people = document.createElement('span');
  people.className = 'rating-people';
  people.textContent = `${total}人が評価`;
  head.append(num, stars, people);
  container.appendChild(head);

  for (let star = 5; star >= 1; star--) {
    const opt = poll.options[star - 1];
    const v = opt.votes || 0;
    const pct = total ? Math.round((v / total) * 100) : 0;
    container.appendChild(buildBar(`★${star}`, `${v}人`, pct, false, poll.named ? opt.names : null));
  }
}

function buildBar(labelText, countText, pct, isBest, names) {
  const row = document.createElement('div');
  row.className = 'result' + (isBest ? ' best' : '');
  const fill = document.createElement('div');
  fill.className = 'fill';
  fill.style.width = `${pct}%`;
  const head = document.createElement('div');
  head.className = 'result-head';
  const label = document.createElement('span');
  label.className = 'label';
  if (isBest) {
    const mark = document.createElement('span');
    mark.className = 'best-mark';
    mark.textContent = '◎ ';
    label.append(mark, document.createTextNode(labelText));
  } else {
    label.textContent = labelText;
  }
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = countText;
  head.append(label, count);
  row.append(fill, head);
  if (names && names.length) {
    const chips = document.createElement('div');
    chips.className = 'name-chips';
    names.forEach((n) => {
      const c = document.createElement('span');
      c.className = 'name-chip';
      c.textContent = n;
      chips.appendChild(c);
    });
    row.appendChild(chips);
  }
  return row;
}

function renderResults(container, poll) {
  const scene = sceneOf(poll);
  container.textContent = '';

  if (scene.display === 'rating') {
    renderRating(container, poll);
    return poll.voters || 0;
  }

  const totalVotes = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
  const voters = poll.voters || totalVotes;
  const maxVotes = Math.max(0, ...poll.options.map((o) => o.votes || 0));

  poll.options.forEach((o) => {
    const v = o.votes || 0;
    let pct, countText, isBest = false;
    if (scene.display === 'percent') {
      pct = totalVotes ? Math.round((v / totalVotes) * 100) : 0;
      countText = `${v}票・${pct}%`;
    } else { // count（複数選択・日程）
      pct = voters ? Math.round((v / voters) * 100) : 0;
      countText = `${v}人`;
      isBest = scene.best && v > 0 && v === maxVotes;
    }
    const label = scene.body === 'dates' ? formatDate(o.text) : o.text;
    container.appendChild(buildBar(label, countText, pct, isBest, poll.named ? o.names : null));
  });

  return scene.display === 'percent' ? totalVotes : voters;
}

function totalLabel(poll, total) {
  const scene = sceneOf(poll);
  if (scene.display === 'percent') return `合計 ${total}票`;
  if (scene.display === 'rating') return `${total}人が評価`;
  return `回答 ${total}人`;
}

/* ============================================================
   主催者画面
   ============================================================ */
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

let hostReturnId = null;

function openHost(id) {
  if (unsubscribe) unsubscribe();
  const voteUrl = `${location.origin}${location.pathname}#vote=${id}`;
  $('voteUrl').value = voteUrl;
  renderQr(voteUrl);

  // 主催者自身もこの端末で投票できる（投票後は主催者画面にもどれる）
  $('hostVoteBtn').onclick = () => { hostReturnId = id; location.hash = `vote=${id}`; };

  unsubscribe = backend.subscribe(id, (poll) => {
    if (!poll) { showView('notFound'); return; }
    const scene = sceneOf(poll);
    $('hostBadge').textContent = `${scene.icon} ${scene.name}`;
    $('hostQuestion').textContent = poll.question;
    const total = renderResults($('hostResults'), poll);
    $('hostTotal').textContent = totalLabel(poll, total);
    showView('hostView');
  });
}

/* ============================================================
   投票画面
   ============================================================ */
let voteBuilt = false;
let voting = false;
let currentVotePoll = null;
const voteSelected = new Set();
const pendingAddTexts = new Set();

// 投票を「1回だけ・成功してから確定」する。
// - voting フラグで連打/二重送信を防ぐ（finding #1）
// - 楽観的に投票済みフラグを立てて結果画面に切替え、失敗したら取り消して投票UIに戻す（finding #2）
async function submitVote(id, indices, name) {
  if (voting) return;
  voting = true;
  localStorage.setItem(votedKey(id), JSON.stringify(indices));
  try {
    await backend.vote(id, indices, name);
  } catch (e) {
    localStorage.removeItem(votedKey(id));
    voting = false;
    alert('投票の送信に失敗しました。通信環境を確認して、もう一度お試しください。');
    if (currentVotePoll) { voteBuilt = false; buildVoteUI(id, currentVotePoll); }
  }
}

function resolveName(poll) {
  if (!poll.named) return null;
  const name = $('voterName').value.trim();
  if (!name) { alert('名前を入力してください'); $('voterName').focus(); return false; }
  localStorage.setItem(NAME_KEY, name);
  return name;
}

function showVoteResults(id, poll) {
  $('voteOptions').classList.add('hidden');
  $('voteSubmitBtn').classList.add('hidden');
  $('voteHint').classList.add('hidden');
  $('voteNameField').classList.add('hidden');
  $('voteAddRow').classList.add('hidden');
  $('voteThanks').classList.remove('hidden');
  const total = renderResults($('voteResults'), poll);
  $('voteTotal').textContent = totalLabel(poll, total);
}

// 複数選択のチップを描画。スナップショットのたびに呼んでも選択状態は voteSelected で保たれる。
// 参加者が増やした選択肢もここで反映される。
function renderMultiChips(id, poll) {
  const scene = sceneOf(poll);
  // 自分が追加した選択肢は、出てきたら自動で選択状態にする
  if (pendingAddTexts.size) {
    poll.options.forEach((o, i) => {
      const key = (o.text || '').trim().toLowerCase();
      if (pendingAddTexts.has(key)) { voteSelected.add(i); pendingAddTexts.delete(key); }
    });
  }
  const box = $('voteOptions');
  box.textContent = '';
  poll.options.forEach((o, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'vote-chip' + (voteSelected.has(i) ? ' selected' : '');
    chip.textContent = scene.body === 'dates' ? formatDate(o.text) : o.text;
    chip.onclick = () => {
      if (voteSelected.has(i)) { voteSelected.delete(i); chip.classList.remove('selected'); }
      else { voteSelected.add(i); chip.classList.add('selected'); }
      $('voteSubmitBtn').disabled = voteSelected.size === 0;
    };
    box.appendChild(chip);
  });
  $('voteSubmitBtn').disabled = voteSelected.size === 0;
}

function buildVoteUI(id, poll) {
  const scene = sceneOf(poll);
  voteBuilt = true;
  voteSelected.clear();
  $('voteHint').textContent = scene.voteHint + (poll.allowAdd ? '（なければ下から追加）' : '');
  $('voteHint').classList.remove('hidden');
  $('voteOptions').classList.remove('hidden');
  $('voteThanks').classList.add('hidden');

  const nameField = $('voteNameField');
  if (poll.named) {
    nameField.classList.remove('hidden');
    $('voterName').value = localStorage.getItem(NAME_KEY) || '';
  } else {
    nameField.classList.add('hidden');
  }

  const addRow = $('voteAddRow');

  if (scene.multi) {
    renderMultiChips(id, poll);

    if (poll.allowAdd) {
      addRow.classList.remove('hidden');
      const addInput = $('voteAddInput');
      const doAdd = async () => {
        const t = addInput.value.trim();
        if (!t) return;
        pendingAddTexts.add(t.toLowerCase());
        addInput.value = '';
        await backend.addOption(id, t);
      };
      $('voteAddBtn').onclick = doAdd;
      addInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } };
    } else {
      addRow.classList.add('hidden');
    }

    const submit = $('voteSubmitBtn');
    submit.classList.remove('hidden');
    submit.disabled = voteSelected.size === 0;
    submit.onclick = () => {
      if (voteSelected.size === 0) return;
      const name = resolveName(poll);
      if (name === false) return;
      submit.disabled = true;
      submitVote(id, [...voteSelected], name);
    };
  } else {
    $('voteSubmitBtn').classList.add('hidden');
    addRow.classList.add('hidden');
    const box = $('voteOptions');
    box.textContent = '';
    poll.options.forEach((o, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vote-btn';
      btn.textContent = scene.display === 'rating' ? `★${o.text}` : o.text;
      btn.onclick = () => {
        const name = resolveName(poll);
        if (name === false) return;
        box.querySelectorAll('.vote-btn').forEach((b) => { b.disabled = true; });
        submitVote(id, [i], name);
      };
      box.appendChild(btn);
    });
  }
}

function openVote(id) {
  if (unsubscribe) unsubscribe();
  voteBuilt = false;
  voting = false;
  currentVotePoll = null;
  pendingAddTexts.clear();

  const back = $('voteBackHost');
  if (hostReturnId === id) {
    back.classList.remove('hidden');
    back.onclick = () => { location.hash = `host=${id}`; };
  } else {
    back.classList.add('hidden');
  }

  unsubscribe = backend.subscribe(id, (poll) => {
    if (!poll) { showView('notFound'); return; }
    currentVotePoll = poll;
    $('voteQuestion').textContent = poll.question;
    const already = localStorage.getItem(votedKey(id));
    if (already) {
      showVoteResults(id, poll);
    } else if (!voteBuilt) {
      buildVoteUI(id, poll);
    } else if (sceneOf(poll).multi) {
      // 参加者が増えた選択肢を反映（選択中の状態は保持）
      renderMultiChips(id, poll);
    }
    showView('voteView');
  });
}

/* ============================================================
   ルーティング
   ============================================================ */
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
