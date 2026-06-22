/* ============================================================
   ストレージ抽象化（改ざん対策版）
   - qrpolls/{id}             : 投票の定義（質問・選択肢）。作成後は不変。
   - qrpolls/{id}/options/*   : 参加者が足した選択肢（追加のみ・編集削除不可）。
   - qrpolls/{id}/votes/{uid} : 1票=1件・匿名IDごと（追加のみ・編集削除不可）。
   票数は個々の投票を数え上げて集計するため、後から数字を書き換えられない。
   firebase-config.js が無い場合は localStorage デモモードに退避する。
   vote(id, optionIds, name) は「選んだ選択肢のID配列」を受け取る。
   ============================================================ */

// 選択肢に安定IDを振る（追加選択肢が増えても並び順・対応がぶれないように）
function assignIds(options) {
  return options.map((o, i) => ({ id: o.id || ('o' + i), text: o.text }));
}

// 集計：定義(meta)＋参加者が足した選択肢(addedOptions)＋全投票(votes) から
// 描画用の poll オブジェクト（options=[{id,text,votes,names}], voters）を組み立てる。
function aggregatePoll(meta, addedOptions, votes) {
  if (!meta) return null;
  const opts = [];
  // 旧フォーマット（選択肢にIDが無い）を開いても潰れないよう、無ければ添字でIDを振る
  (meta.options || []).forEach((o, i) => opts.push({ id: o.id || ('o' + i), text: o.text, votes: 0, names: [] }));
  addedOptions
    .slice()
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .forEach((o) => opts.push({ id: o.id, text: o.text, votes: 0, names: [] }));
  const byId = {};
  opts.forEach((o) => { byId[o.id] = o; });
  let voters = 0;
  votes.forEach((v) => {
    voters += 1;
    (v.choices || []).forEach((cid) => {
      const o = byId[cid];
      if (o) { o.votes += 1; if (v.name) o.names.push(v.name); }
    });
  });
  return {
    id: meta.id, type: meta.type, question: meta.question,
    named: meta.named, allowAdd: meta.allowAdd,
    voteMode: meta.voteMode || 'strict',
    options: opts, voters,
  };
}

function makeFirestoreBackend(config) {
  firebase.initializeApp(config);
  const db = firebase.firestore();
  // モバイル回線・プロキシ・一部ブラウザでリアルタイム通信(WebChannel)が詰まると
  // 投票が届かない／結果が更新されないため、自動でロングポーリングに切り替える
  try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch {}
  const col = db.collection('qrpolls');

  // 匿名ログイン（裏で自動・ユーザー操作なし）。uid を1回だけ確立する。
  // この uid を「1人1票」と「投票の作成者(ownerUid)」の身元として使う。
  let uidPromise = null;
  const ensureUid = () => {
    const auth = firebase.auth();
    if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
    if (!uidPromise) {
      uidPromise = new Promise((resolve, reject) => {
        const unsub = auth.onAuthStateChanged((u) => { if (u) { unsub(); resolve(u.uid); } });
        // サインインが一時的に失敗しても、次回呼び出しでやり直せるようにする
        auth.signInAnonymously().catch((e) => { unsub(); uidPromise = null; reject(e); });
      });
    }
    return uidPromise;
  };
  ensureUid().catch(() => {});

  return {
    mode: 'firebase',
    ready: ensureUid,
    async createPoll(poll) {
      const uid = await ensureUid();
      // 作成後は更新不可（ルールで封鎖）。質問・選択肢はここで確定する。
      await col.doc(poll.id).set({
        id: poll.id, type: poll.type, question: poll.question,
        named: !!poll.named, allowAdd: !!poll.allowAdd,
        voteMode: poll.voteMode === 'open' ? 'open' : 'strict',
        options: assignIds(poll.options),
        createdAt: poll.createdAt, ownerUid: uid,
      });
    },
    subscribe(id, cb) {
      // 定義・追加選択肢・全投票 の3つを購読し、変化のたびに集計して返す
      const ref = col.doc(id);
      let meta = null, added = [], votes = [], haveMeta = false;
      const emit = () => { if (haveMeta) cb(aggregatePoll(meta, added, votes)); };
      const u1 = ref.onSnapshot((d) => { meta = d.exists ? d.data() : null; haveMeta = true; emit(); });
      const u2 = ref.collection('options').onSnapshot((s) => {
        added = s.docs.map((doc) => ({ id: doc.id, ...doc.data() })); emit();
      });
      const u3 = ref.collection('votes').onSnapshot((s) => {
        votes = s.docs.map((doc) => doc.data()); emit();
      });
      return () => { u1(); u2(); u3(); };
    },
    async vote(id, optionIds, name, opts = {}) {
      // 1票=1件。by に必ず本人の uid を入れる（ルールでなりすましを防ぐ）。
      // - replaceId 指定: 自分の票を上書き（投票し直し）
      // - strict: doc id を uid に固定（1人1票）
      // - open  : ランダムIDで何件でも（その場で代理入力OK）
      const uid = await ensureUid();
      const votes = col.doc(id).collection('votes');
      const data = { choices: optionIds, name: name || null, by: uid, ts: Date.now() };
      if (opts.replaceId) { await votes.doc(opts.replaceId).set(data); return opts.replaceId; }
      if (opts.mode === 'open') { const ref = await votes.add(data); return ref.id; }
      await votes.doc(uid).set(data);
      return uid;
    },
    async addOption(id, text) {
      await ensureUid();
      const norm = (text || '').trim();
      if (!norm) return;
      await col.doc(id).collection('options').add({ text: norm, ts: Date.now() });
    },
  };
}

function makeLocalBackend() {
  // firebase-config.js が無い時の退避（同一ブラウザのタブ間のみ同期）。
  // Firestore版と同じく「定義(meta)＋追加選択肢(options)＋個々の票(votes)」で保存し、
  // 同じ aggregatePoll で集計する。
  const KEY = (id) => `qrpoll_${id}`;
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('qrpoll') : null;
  const listeners = {};

  let localUid = localStorage.getItem('qrpoll_local_uid');
  if (!localUid) { localUid = 'local-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('qrpoll_local_uid', localUid); }

  const read = (id) => {
    try { return JSON.parse(localStorage.getItem(KEY(id))); } catch { return null; }
  };
  const agg = (raw) => raw && raw.meta ? aggregatePoll(raw.meta, raw.options || [], Object.values(raw.votes || {})) : null;
  const write = (id, raw) => {
    localStorage.setItem(KEY(id), JSON.stringify(raw));
    if (channel) channel.postMessage({ id });
    (listeners[id] || []).forEach((cb) => cb(agg(raw)));
  };
  const notify = (id) => {
    const raw = read(id);
    (listeners[id] || []).forEach((cb) => cb(agg(raw)));
  };

  if (channel) channel.onmessage = (e) => { if (e.data && e.data.id) notify(e.data.id); };
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('qrpoll_')) notify(e.key.slice('qrpoll_'.length));
  });

  return {
    mode: 'local',
    ready: () => Promise.resolve(localUid),
    async createPoll(poll) {
      write(poll.id, {
        meta: {
          id: poll.id, type: poll.type, question: poll.question,
          named: !!poll.named, allowAdd: !!poll.allowAdd,
          voteMode: poll.voteMode === 'open' ? 'open' : 'strict',
          options: assignIds(poll.options),
        },
        options: [], votes: {},
      });
    },
    subscribe(id, cb) {
      (listeners[id] = listeners[id] || []).push(cb);
      cb(agg(read(id)));
      return () => { listeners[id] = (listeners[id] || []).filter((f) => f !== cb); };
    },
    async vote(id, optionIds, name, opts = {}) {
      const raw = read(id);
      if (!raw) return null;
      raw.votes = raw.votes || {};
      let docId;
      if (opts.replaceId) docId = opts.replaceId;
      else if ((opts.mode || raw.meta.voteMode) === 'open') docId = 'v' + Date.now() + Math.random().toString(36).slice(2, 6);
      else docId = localUid;
      raw.votes[docId] = { choices: optionIds, name: name || null, by: localUid, ts: Date.now() };
      write(id, raw);
      return docId;
    },
    async addOption(id, text) {
      const raw = read(id);
      if (!raw) return;
      const norm = (text || '').trim();
      if (!norm) return;
      const all = [...(raw.meta.options || []), ...(raw.options || [])];
      if (all.some((o) => (o.text || '').trim().toLowerCase() === norm.toLowerCase())) return;
      raw.options = raw.options || [];
      raw.options.push({ id: 'a' + Date.now(), text: norm, ts: Date.now() });
      write(id, raw);
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
let currentMode = 'open';

const NAME_KEY = 'qrpoll_voter_name';

function renderNamedToggle() {
  const box = $('namedToggle');
  box.querySelectorAll('.seg-btn').forEach((btn) => {
    const on = (btn.dataset.named === 'true') === currentNamed;
    btn.classList.toggle('active', on);
    btn.onclick = () => { currentNamed = btn.dataset.named === 'true'; renderNamedToggle(); };
  });
}

function renderModeToggle() {
  const box = $('modeToggle');
  if (!box) return;
  box.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
    btn.onclick = () => { currentMode = btn.dataset.mode; renderModeToggle(); };
  });
}

// この端末で作った投票の控え（URLを控え忘れても主催者画面に戻れるように）
const CREATED_KEY = 'qrpoll_created';
const getCreatedPolls = () => { try { return JSON.parse(localStorage.getItem(CREATED_KEY)) || []; } catch { return []; } };
function addCreatedPoll(poll) {
  const list = getCreatedPolls().filter((x) => x.id !== poll.id);
  list.unshift({ id: poll.id, question: poll.question, type: poll.type, createdAt: poll.createdAt });
  localStorage.setItem(CREATED_KEY, JSON.stringify(list.slice(0, 20)));
}
const removeCreatedPoll = (id) =>
  localStorage.setItem(CREATED_KEY, JSON.stringify(getCreatedPolls().filter((x) => x.id !== id)));

function renderMyPolls() {
  const box = $('myPolls');
  if (!box) return;
  const list = getCreatedPolls();
  box.textContent = '';
  if (!list.length) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const title = document.createElement('h3');
  title.className = 'my-polls-title';
  title.textContent = '📋 前に作った投票（この端末）';
  box.appendChild(title);
  list.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'my-poll-item';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'my-poll-open';
    const icon = (SCENES[p.type] || SCENES.binary).icon;
    open.textContent = `${icon} ${p.question || '(無題)'}`;
    open.onclick = () => { location.hash = `host=${p.id}`; };
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'my-poll-del';
    del.setAttribute('aria-label', '一覧から消す');
    del.textContent = '×';
    del.onclick = () => { removeCreatedPoll(p.id); renderMyPolls(); };
    item.append(open, del);
    box.appendChild(item);
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

// 候補日の件数表示と「全部クリア」ボタンの出し分けを更新する
function updateDateControls() {
  const row = $('dateClearRow');
  if (!row) return;
  const n = document.querySelectorAll('#dateList [data-date]').length;
  row.classList.toggle('hidden', n === 0);
  const cnt = $('dateCount');
  if (cnt) cnt.textContent = n ? `候補日 ${n}件` : '';
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
  del.onclick = () => { chip.remove(); updateDateControls(); };
  chip.append(label, del);
  // 日付順に挿入
  const after = [...list.querySelectorAll('[data-date]')].find((c) => c.dataset.date > iso);
  list.insertBefore(chip, after || null);
  updateDateControls();
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
    span.textContent = '候補日を追加（まとめて選べます）';

    // ① 種類フィルタ（上）：すべて / 平日 / 土日
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

    // ② 期間（下）：開始〜終了
    const today = new Date();
    const min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const row = document.createElement('div');
    row.className = 'date-add-row';
    const start = document.createElement('input');
    start.type = 'date'; start.id = 'dateStart'; start.min = min;
    const sep = document.createElement('span');
    sep.className = 'date-sep'; sep.textContent = '〜';
    const end = document.createElement('input');
    end.type = 'date'; end.id = 'dateEnd'; end.min = min; end.title = '終了日（任意）';
    row.append(start, sep, end);

    // 追加ボタン（目立つように独立行・プライマリ）
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn-primary date-add-btn';
    add.textContent = '＋ この期間を候補日に追加';
    add.onclick = () => {
      const f = filter.querySelector('.seg-btn.active').dataset.filter;
      addDateRange(start.value, end.value, f);
      start.value = ''; end.value = '';
      updateDateControls();
    };

    const hint = document.createElement('p');
    hint.className = 'date-range-hint';
    hint.textContent = 'まず上で種類（すべて／平日／土日）を選び、下で期間（開始〜終了）を入れて「追加」。1日だけなら開始日だけでOK。';

    // 候補日リスト＋一括クリア
    const clearRow = document.createElement('div');
    clearRow.id = 'dateClearRow';
    clearRow.className = 'date-clear-row hidden';
    const cnt = document.createElement('span');
    cnt.id = 'dateCount'; cnt.className = 'date-count';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn btn-ghost small';
    clearBtn.textContent = '🗑 全部クリア';
    clearBtn.onclick = () => { $('dateList').textContent = ''; updateDateControls(); };
    clearRow.append(cnt, clearBtn);

    const list = document.createElement('div');
    list.id = 'dateList';
    list.className = 'date-list';
    field.append(span, filter, row, add, hint, clearRow, list);
    body.appendChild(field);
  } else if (scene.body === 'rating') {
    const note = document.createElement('p');
    note.className = 'rating-note';
    note.textContent = '参加者は ★1〜★5 で評価します。平均点とばらつきが出ます。';
    body.appendChild(note);
  }
}

function setupCreate() {
  renderMyPolls();
  renderScenePicker();
  renderNamedToggle();
  renderModeToggle();
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
    voteMode: currentMode,
    options: options.map((o) => ({ text: o.text })),
    createdAt: Date.now(),
  };
  const btn = $('createBtn');
  btn.disabled = true;
  try {
    // 通信が詰まったまま無反応にならないよう、12秒で打ち切ってエラー扱いにする
    await Promise.race([
      backend.createPoll(poll),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
    ]);
    addCreatedPoll(poll);
    location.hash = `host=${poll.id}`;
  } catch (e) {
    alert('投票の作成に失敗しました。通信環境を確認して、もう一度お試しください。');
  } finally {
    btn.disabled = false;
  }
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
let editing = false;     // 「投票し直す／もう一人分」で投票UIに戻っている最中
let voteIntent = 'new';  // 'new' = 新規・追加 / 'replace' = 自分の票を上書き
const voteSelected = new Set();
const pendingAddTexts = new Set();

const myVoteKey = (id) => `qrpoll_myvote_${id}`;
const getMyVote = (id) => { try { return JSON.parse(localStorage.getItem(myVoteKey(id))); } catch { return null; } };
const saveMyVote = (id, v) => localStorage.setItem(myVoteKey(id), JSON.stringify(v));

// この送信が「新規/追加」か「自分の票の上書き」かで、バックエンドへの渡し方を決める
function voteOpts(poll) {
  if (voteIntent === 'replace') {
    const mv = getMyVote(poll.id);
    if (mv && mv.docId) return { replaceId: mv.docId };
  }
  return { mode: poll.voteMode === 'open' ? 'open' : 'strict' };
}

// 投票を送る。
// - voting フラグで連打/二重送信を防ぐ
// - 12秒で打ち切ってエラー扱い（通信が詰まっても無反応にしない）
// - 成功したら即「ありがとう」へ切替。数字はリアルタイム更新が満たす（自前で+1せず二重カウントを避ける）
async function submitVote(id, optionIds, name, opts = {}) {
  if (voting) return;
  voting = true;
  try {
    const docId = await Promise.race([
      backend.vote(id, optionIds, name, opts),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
    ]);
    saveMyVote(id, { docId, choices: optionIds, name: name || null });
    localStorage.setItem(votedKey(id), '1');
    editing = false;
    voting = false;
    if (currentVotePoll) showVoteResults(id, currentVotePoll);
  } catch (e) {
    voting = false;
    alert('投票を送れませんでした。通信環境を確認して、もう一度お試しください。');
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

function wireThanksActions(id, poll) {
  const reBtn = $('reVoteBtn');
  const addBtn = $('addVoteBtn');
  if (reBtn) {
    reBtn.onclick = () => { editing = true; voteIntent = 'replace'; voteBuilt = false; buildVoteUI(id, currentVotePoll); showView('voteView'); };
  }
  if (addBtn) {
    addBtn.classList.toggle('hidden', poll.voteMode !== 'open');
    addBtn.onclick = () => { editing = true; voteIntent = 'new'; voteBuilt = false; buildVoteUI(id, currentVotePoll); showView('voteView'); };
  }
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
  wireThanksActions(id, poll);
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
        const dup = (currentVotePoll && currentVotePoll.options || [])
          .some((o) => (o.text || '').trim().toLowerCase() === t.toLowerCase());
        if (dup) { addInput.value = ''; return; }
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
      const ids = [...voteSelected]
        .map((i) => currentVotePoll.options[i] && currentVotePoll.options[i].id)
        .filter(Boolean);
      if (ids.length === 0) return;
      submit.disabled = true;
      submitVote(id, ids, name, voteOpts(poll));
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
        submitVote(id, [o.id], name, voteOpts(poll));
      };
      box.appendChild(btn);
    });
  }
}

function openVote(id) {
  if (unsubscribe) unsubscribe();
  voteBuilt = false;
  voting = false;
  editing = false;
  voteIntent = 'new';
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
    if (editing) {
      // 「投票し直す／もう一人分」で投票UIに戻っている間は結果画面に奪われない。
      // 増えた選択肢だけ反映する。
      if (sceneOf(poll).multi) renderMultiChips(id, poll);
    } else if (already) {
      showVoteResults(id, poll);
    } else if (!voteBuilt) {
      buildVoteUI(id, poll);
    } else if (sceneOf(poll).multi) {
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
