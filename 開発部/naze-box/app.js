/* なんで箱 — フロント。画面遷移・AI回答取得・localStorage保存・好奇心マップ。
   AI回答生成は fetchAnswer() に分離（後で他APIに差し替えやすい）。 */

'use strict';

// ---- カテゴリ定義（表示色つき）----
const CATEGORY_META = {
  宇宙:   { emoji: '🌌', color: '#e3f1fb' },
  生き物: { emoji: '🐟', color: '#e8f6e6' },
  体:     { emoji: '🫀', color: '#fde8ea' },
  食べ物: { emoji: '🍙', color: '#fdf0c4' },
  科学:   { emoji: '🔬', color: '#eee7fb' },
  社会:   { emoji: '🏫', color: '#fdeede' },
  感情:   { emoji: '💛', color: '#fff4d6' },
  その他: { emoji: '❓', color: '#eef0f2' },
};
const CATEGORIES = Object.keys(CATEGORY_META);

const AGE_LABEL = { 3: '3さい', 5: '5さい', 7: '7さい', 10: '10さい' };
const STORE_KEY = 'nazebox.items.v1';

// ---- state ----
let selectedAge = 5;
let currentAnswer = null;   // 直近の回答（保存前）
let currentQuestion = '';
let boxFilter = 'all';

// ============================================================
// データ層（localStorage。後でFirebase等に移しやすいよう関数で隠蔽）
// ============================================================
function loadItems() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
  catch (_) { return []; }
}
function saveItems(items) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}
function addItem(item) {
  const items = loadItems();
  items.unshift(item);
  saveItems(items);
}
function removeItem(id) {
  saveItems(loadItems().filter(it => it.id !== id));
}

// ============================================================
// AI回答生成（ここだけ差し替えれば別APIに移行できる）
// サーバー(/api/ask)を叩き、失敗したらクライアント側モックにフォールバック。
// ============================================================
async function fetchAnswer(question, age) {
  try {
    const r = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, age }),
    });
    if (r.ok) return await r.json();
  } catch (_) { /* オフライン等 */ }
  return clientMock(question, age);
}

const SENSITIVE = ['死', '亡く', '殺', '病気', '事故', '戦争', '災害', '地震', '津波', 'いじめ', '離婚', 'がん'];
function clientMock(question, age) {
  const sensitive = SENSITIVE.some(w => question.includes(w));
  return {
    childAnswer: age <= 3
      ? 'いいしつもんだね。それにはちゃんとわけがあるんだよ。いっしょにみてみようね。'
      : 'とてもいい質問だね。それにはちゃんと理由があるんだ。少しずつ見ていこう。',
    analogy: 'たとえば、身近なところにもヒントがかくれているよ。まわりをよく見てみよう。',
    parentNote: sensitive
      ? '【要フォロー】デリケートな話題です。まず「気になったんだね」と気持ちを受け止め、怖がらせない範囲で正直に。困ったら「一緒に調べようね」でも十分です。（いまはオフライン用のモック回答です）'
      : 'いまはオフライン用のモック回答です。ネットにつながり鍵が設定されると、質問に合わせた本物の回答が出ます。',
    nextQuestion: age <= 3 ? 'ほかにも「なんで？」っておもったこと、ある？' : 'この中で、いちばん「もっと知りたい！」と思ったのはどれ？',
    category: guessCategory(question),
    mock: true,
  };
}
function guessCategory(q) {
  const map = {
    宇宙: ['空', '星', '月', '太陽', '宇宙', '惑星', 'ロケット', '雲', '虹', '雨', '雪', '天気', '夜'],
    生き物: ['魚', '犬', '猫', '動物', '虫', '鳥', '恐竜', '花', '木', '植物', 'ペット', 'カエル'],
    体: ['体', '血', '骨', '歯', '髪', '目', '鼻', '耳', '寝', '眠', 'くしゃみ', '涙', 'けが', 'うんち'],
    食べ物: ['食べ', 'ごはん', '野菜', '肉', 'お菓子', '甘い', 'からい', '料理', '飲む', 'パン'],
    科学: ['電気', '磁石', '火', '水', '氷', '溶け', '浮く', '音', '光', '機械', 'ロボット', '風'],
    社会: ['お金', '仕事', '学校', '国', 'ルール', '信号', '電車', 'バス', '警察', '税金'],
    感情: ['気持ち', '悲しい', '怒', '泣', '好き', 'こわい', 'さみしい', 'うれしい', '友だち'],
  };
  for (const cat of Object.keys(map)) if (map[cat].some(w => q.includes(w))) return cat;
  return 'その他';
}

function summarize(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > 44 ? s.slice(0, 44) + '…' : s;
}

// ============================================================
// 音声入力（子ども本人が「話す」）
// ブラウザ標準の Web Speech API。未対応端末では機能を隠して文字入力に戻す。
// ============================================================
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

function setupVoiceInput() {
  const micBtn = document.getElementById('mic-btn');
  if (!SpeechRec) return;               // 非対応なら文字入力のみ（ボタンは hidden のまま）
  micBtn.hidden = false;

  recognition = new SpeechRec();
  recognition.lang = 'ja-JP';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  const input = document.getElementById('question-input');
  const status = document.getElementById('mic-status');
  let finalText = '';

  recognition.onstart = () => {
    listening = true; finalText = '';
    micBtn.classList.add('listening');
    status.hidden = false; status.textContent = '🎤 マイクにむかって、なんで？を はなしてね';
  };
  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    input.value = (finalText + interim).trim();
  };
  recognition.onerror = (e) => {
    status.hidden = false;
    status.textContent = e.error === 'not-allowed'
      ? 'マイクがつかえないみたい。文字でも入力できるよ。'
      : 'うまく聞きとれなかったよ。もう一度どうぞ。';
  };
  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove('listening');
    if (input.value.trim()) {           // 聞きとれたら自動で質問（ハンズフリー）
      status.hidden = true;
      setTimeout(() => ask(), 350);
    }
  };

  micBtn.addEventListener('click', () => {
    if (listening) { recognition.stop(); return; }
    try { recognition.start(); } catch (_) {}
  });
}

// ============================================================
// 画面遷移
// ============================================================
function show(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
  const el = document.getElementById('screen-' + screen);
  if (el) el.classList.add('visible');
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('is-active', t.dataset.nav === screen));
  if (screen === 'box') renderBox();
  if (screen === 'tree') renderTree();
  window.scrollTo(0, 0);
}

// ============================================================
// 質問→回答
// ============================================================
let asking = false;
async function ask() {
  if (asking) return;                       // 回答待ち中の二重送信ガード
  const q = document.getElementById('question-input').value.trim();
  if (!q) { document.getElementById('question-input').focus(); return; }
  asking = true;
  document.getElementById('ask-btn').disabled = true;
  currentQuestion = q;
  currentAnswer = null;

  document.getElementById('ans-question').textContent = q;
  document.getElementById('ans-age').textContent = AGE_LABEL[selectedAge];
  document.getElementById('answer-body').style.display = 'none';
  document.getElementById('answer-loading').hidden = false;
  const saveBtn = document.getElementById('save-btn');
  saveBtn.classList.remove('saved');
  saveBtn.textContent = '🌳 きに みを ならせる';
  saveBtn.disabled = false;
  show('answer');

  try {
    const ans = await fetchAnswer(q, selectedAge);
    currentAnswer = ans;
    renderAnswer(ans);
  } finally {
    asking = false;
    document.getElementById('ask-btn').disabled = false;
  }
}

// 回答を画面に反映（新規回答・カード再オープン 共通）
function renderAnswer(ans) {
  const cat = CATEGORIES.includes(ans.category) ? ans.category : guessCategory(currentQuestion);
  document.getElementById('ans-cat-emoji').textContent = (CATEGORY_META[cat] || CATEGORY_META['その他']).emoji;
  document.getElementById('ans-child').textContent = ans.childAnswer || '';
  document.getElementById('ans-analogy').textContent = ans.analogy || '';
  document.getElementById('ans-parent').textContent = ans.parentNote || '';

  const nextBtn = document.getElementById('next-q-btn');
  if (ans.nextQuestion) {
    document.getElementById('ans-next').textContent = ans.nextQuestion;
    nextBtn.hidden = false;
  } else {
    nextBtn.hidden = true;
  }
  document.getElementById('parent-toggle').open = false;
  document.getElementById('mock-badge').hidden = !ans.mock;

  document.getElementById('answer-loading').hidden = true;
  document.getElementById('answer-body').style.display = 'block';
}

function saveCurrent() {
  if (!currentAnswer) return;
  const item = {
    id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    question: currentQuestion,
    age: selectedAge,
    category: CATEGORIES.includes(currentAnswer.category) ? currentAnswer.category : 'その他',
    date: new Date().toISOString(),
    answer: {
      childAnswer: currentAnswer.childAnswer || '',
      analogy: currentAnswer.analogy || '',
      parentNote: currentAnswer.parentNote || '',
      nextQuestion: currentAnswer.nextQuestion || '',
    },
    summary: summarize(currentAnswer.childAnswer),
  };
  addItem(item);
  const btn = document.getElementById('save-btn');
  btn.classList.add('saved');
  btn.textContent = '✓ みが なったよ';
  btn.disabled = true;

  // 実が木へ飛ぶ演出＋トースト＋タブぴょこん
  const fruit = (CATEGORY_META[item.category] || CATEGORY_META['その他']).emoji;
  flyFruit(btn, fruit);
  showToast(`${fruit} きに みが なった！`);
  const treeTab = document.querySelector('.tab[data-nav="tree"]');
  treeTab.classList.remove('pulse'); void treeTab.offsetWidth; treeTab.classList.add('pulse');
}

function flyFruit(fromEl, emoji) {
  const r = fromEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'fly-fruit';
  el.textContent = emoji;
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = r.top + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.hidden = true; }, 300);
  }, 1800);
}

// ============================================================
// なんで箱（カード一覧）
// ============================================================
function renderBox() {
  const items = loadItems();
  const listEl = document.getElementById('box-list');
  const emptyEl = document.getElementById('box-empty');
  const filtersEl = document.getElementById('box-filters');

  if (!items.length) {
    listEl.innerHTML = '';
    filtersEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  // フィルタ（存在するカテゴリだけ）
  const present = CATEGORIES.filter(c => items.some(it => it.category === c));
  const chips = ['all', ...present];
  filtersEl.innerHTML = chips.map(c => {
    const label = c === 'all' ? `ぜんぶ ${items.length}` : `${CATEGORY_META[c].emoji}${c}`;
    return `<button class="filter-chip ${boxFilter === c ? 'is-active' : ''}" data-filter="${c}">${label}</button>`;
  }).join('');

  const shown = boxFilter === 'all' ? items : items.filter(it => it.category === boxFilter);
  listEl.innerHTML = shown.map(it => {
    const meta = CATEGORY_META[it.category] || CATEGORY_META['その他'];
    const d = new Date(it.date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    return `
      <div class="qcard" data-id="${it.id}">
        <div class="qcard-top">
          <span class="cat-tag" style="background:${meta.color}">${meta.emoji} ${it.category}</span>
          <span class="qcard-meta">${AGE_LABEL[it.age] || it.age + 'さい'} ・ ${dateStr}</span>
        </div>
        <h3>${escapeHtml(it.question)}</h3>
        <p class="summary">${escapeHtml(it.summary || '')}</p>
        <button class="qcard-del" data-del="${it.id}">削除</button>
      </div>`;
  }).join('');
}

// カードをタップ→回答を再表示
function reopenItem(id) {
  const it = loadItems().find(x => x.id === id);
  if (!it) return;
  currentQuestion = it.question;
  selectedAge = it.age;
  currentAnswer = { ...it.answer, category: it.category };
  document.getElementById('ans-question').textContent = it.question;
  document.getElementById('ans-age').textContent = AGE_LABEL[it.age] || it.age + 'さい';
  renderAnswer(currentAnswer);
  document.getElementById('mock-badge').hidden = true;
  const btn = document.getElementById('save-btn');
  btn.classList.add('saved'); btn.textContent = '✓ みは なってるよ'; btn.disabled = true;
  show('answer');
}

// ============================================================
// 好奇心の木（成長記録）
// ============================================================
// 分野ごとの木の成長段階（その分野の質問数で決まる）
const CAT_STAGES = [
  { min: 1,  emoji: '🌱', label: 'め' },
  { min: 2,  emoji: '🌿', label: 'ふたば' },
  { min: 4,  emoji: '🌳', label: 'き' },
  { min: 7,  emoji: '🌸', label: 'はな' },
  { min: 11, emoji: '🍎', label: 'み' },
];

function catStageFor(n) {
  let idx = 0, next = null;
  for (let i = 0; i < CAT_STAGES.length; i++) if (n >= CAT_STAGES[i].min) idx = i;
  next = CAT_STAGES[idx + 1] || null;
  return { stage: CAT_STAGES[idx], idx, next };
}

// 段階ごとの木の寸法（compact viewBox 160x150, 地面 y=128）
const CAT_TREE_SIZE = [
  { trunkH: 14, trunkW: 6,  canopyR: 13 }, // 0 め
  { trunkH: 26, trunkW: 8,  canopyR: 20 }, // 1 ふたば
  { trunkH: 44, trunkW: 11, canopyR: 30 }, // 2 き
  { trunkH: 56, trunkW: 13, canopyR: 36 }, // 3 はな
  { trunkH: 64, trunkW: 14, canopyR: 40 }, // 4 み
];

// 分野の木を1本描く（コンパクト・葉むらの色は分野色に薄く寄せる）
function buildCatTreeSVG(idx, tint) {
  const cx = 80, GY = 128;
  const s = CAT_TREE_SIZE[idx] || CAT_TREE_SIZE[0];
  const trunkTopY = GY - s.trunkH;
  const R = s.canopyR;
  const cy = trunkTopY - R * 0.3;
  let svg = `<svg viewBox="0 0 160 150" class="cat-tree-svg" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<ellipse cx="${cx}" cy="134" rx="62" ry="10" fill="#d7ecc9"/>`;
  svg += `<path d="M${cx - s.trunkW / 2} ${GY} Q${cx - s.trunkW / 3} ${trunkTopY + 6} ${cx - s.trunkW / 3} ${trunkTopY}
    L${cx + s.trunkW / 3} ${trunkTopY} Q${cx + s.trunkW / 3} ${trunkTopY + 6} ${cx + s.trunkW / 2} ${GY} Z" fill="#b58455"/>`;
  if (idx >= 1) {
    svg += `<circle cx="${cx - R * 0.55}" cy="${cy + R * 0.15}" r="${R * 0.72}" fill="#8fca86"/>`;
    svg += `<circle cx="${cx + R * 0.55}" cy="${cy + R * 0.15}" r="${R * 0.72}" fill="#8fca86"/>`;
    svg += `<circle cx="${cx}" cy="${cy - R * 0.35}" r="${R * 0.7}" fill="#8fca86"/>`;
  }
  svg += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#7bbd77"/>`;
  // はな段階：桜色 / み段階：分野の実（同じ絵文字なので賑やかにならない）
  if (idx === 3) {
    for (let i = 0; i < 6; i++) {
      const a = i * 2.399963, rr = R * 0.7 * Math.sqrt((i + 0.5) / 6);
      svg += `<circle cx="${(cx + rr * Math.cos(a)).toFixed(1)}" cy="${(cy + rr * Math.sin(a)).toFixed(1)}" r="4" fill="#f6c0d4"/>`;
    }
  } else if (idx === 4) {
    for (let i = 0; i < 5; i++) {
      const a = i * 2.399963, rr = R * 0.65 * Math.sqrt((i + 0.5) / 5);
      svg += `<text x="${(cx + rr * Math.cos(a)).toFixed(1)}" y="${(cy + rr * Math.sin(a)).toFixed(1)}" font-size="15" text-anchor="middle" dominant-baseline="central">${tint}</text>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

// ---- 木に来る訪問者（その子が夢中なカテゴリの動物）＆おくりもの ----
const VISITORS = {
  宇宙:   { a: '🦉', name: 'ほしふくろう' },
  生き物: { a: '🐿️', name: 'りすの ちび' },
  体:     { a: '🐰', name: 'うさぎ先生' },
  食べ物: { a: '🐻', name: 'くまシェフ' },
  科学:   { a: '🦊', name: 'きつね博士' },
  社会:   { a: '🐧', name: 'ぺんぎんさん' },
  感情:   { a: '🐈', name: 'ねこの みけ' },
  その他: { a: '🐦', name: 'あおい ことり' },
};
const PRESENTS = ['🎀', '🏮', '🪺', '🎈', '⭐', '🎁', '🪁', '🍯', '🔔', '🌟'];
const GENERIC_COMMENTS = [
  'たくさん「なんで？」したね。すごいなあ！',
  'きみの木、どんどん おおきく なってるよ🌱',
  'ふしぎを 見つける めは、たからものだよ。',
  'また あたらしい なんで？、まってるね！',
];
function getDeco() { try { return JSON.parse(localStorage.getItem('nazebox.deco') || '[]'); } catch (_) { return []; } }
function setDeco(a) { localStorage.setItem('nazebox.deco', JSON.stringify(a)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// 訪問を発生させる（おくりものを足し、カード内容を返す）
function grantVisit(topCat, count, isNew) {
  const v = VISITORS[topCat] || VISITORS['その他'];
  const present = pick(PRESENTS);
  const comment = isNew
    ? `あたらしい「${topCat}」の木が めを だしたね！みつけてくれて ありがとう🌱`
    : (Math.random() < 0.5 ? `「${topCat}」の なんで、だいすきなんだね！` : pick(GENERIC_COMMENTS));

  const deco = getDeco();
  deco.push(present);
  setDeco(deco);
  localStorage.setItem('nazebox.lastVisitCount', String(count));

  return { v, present, comment };
}

function showVisitorCard(info) {
  const perch = document.getElementById('visitor-perch');
  perch.textContent = info.v.a;
  perch.hidden = false;

  document.getElementById('vc-animal').textContent = info.v.a;
  document.getElementById('vc-name').textContent = info.v.name;
  document.getElementById('vc-comment').textContent = info.comment;
  document.getElementById('vc-present').textContent = info.present;
  const card = document.getElementById('visitor-card');
  card.hidden = false;
  card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
}
function hideVisitor() {
  document.getElementById('visitor-perch').hidden = true;
  document.getElementById('visitor-card').hidden = true;
}

// 好奇心の森＝分野ごとの木を並べる（それぞれ独立に育つ）
function renderTree() {
  const items = loadItems();
  const wrap = document.getElementById('tree-wrap');
  const emptyEl = document.getElementById('tree-empty');

  if (!items.length) {
    emptyEl.hidden = false;
    wrap.style.display = 'none';
    return;
  }
  emptyEl.hidden = true;
  wrap.style.display = '';

  // 分野ごとの質問数
  const counts = {};
  items.forEach(it => { counts[it.category] = (counts[it.category] || 0) + 1; });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topCat = ranked[0][0];

  // 森の一言（一番大きい木）
  document.getElementById('garden-lead').textContent =
    `いちばん おおきいのは「${(CATEGORY_META[topCat] || {}).emoji || ''}${topCat}」の木`;

  // 各分野の木カードを描画
  document.getElementById('garden').innerHTML = ranked.map(([cat, n]) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META['その他'];
    const { stage, idx, next } = catStageFor(n);
    const base = stage.min, goal = next ? next.min : n;
    const pct = next ? Math.round((n - base) / (goal - base) * 100) : 100;
    return `
      <button class="tree-card" data-cat="${cat}">
        <div class="tc-name">${meta.emoji} ${cat}</div>
        <div class="tc-scene">${buildCatTreeSVG(idx, meta.emoji)}</div>
        <div class="tc-stage">${stage.emoji} ${stage.label} ・ ${n}こ</div>
        <div class="grow-bar"><span style="width:${pct}%"></span></div>
      </button>`;
  }).join('');

  // もらったもの（訪問者のおくりもの）を棚に表示
  const deco = getDeco();
  const shelf = document.getElementById('gift-shelf');
  if (deco.length) {
    shelf.hidden = false;
    shelf.innerHTML = `<span class="gs-label">もらったもの</span> ` + deco.map(e => `<span class="gs-item">${e}</span>`).join('');
  } else {
    shelf.hidden = true;
  }

  // 訪問の判定：新しい分野の木が芽ぶいた or 質問が3こ以上たまった時にたまに
  const known = (() => { try { return JSON.parse(localStorage.getItem('nazebox.knownCats') || '[]'); } catch (_) { return []; } })();
  const present = Object.keys(counts);
  const newCats = present.filter(c => !known.includes(c));
  const lastVisit = Number(localStorage.getItem('nazebox.lastVisitCount') || 0);
  const grew = items.length - lastVisit;

  let visitInfo = null;
  if (known.length && newCats.length) {           // 新しい分野の木＝その分野の動物がお祝いに
    visitInfo = grantVisit(newCats[0], items.length, true);
  } else if (grew >= 3 && Math.random() < 0.5) {   // 活動へのご褒美（たまに）
    visitInfo = grantVisit(topCat, items.length);
  }
  localStorage.setItem('nazebox.knownCats', JSON.stringify(present));

  if (visitInfo) showVisitorCard(visitInfo);
  else hideVisitor();
}

// ============================================================
// util
// ============================================================
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================================
// イベント配線
// ============================================================
function init() {
  // 年齢選択
  document.getElementById('age-picker').addEventListener('click', e => {
    const chip = e.target.closest('.age-chip');
    if (!chip) return;
    selectedAge = Number(chip.dataset.age);
    document.querySelectorAll('.age-chip').forEach(c => c.classList.toggle('is-active', c === chip));
  });

  document.getElementById('ask-btn').addEventListener('click', ask);
  document.getElementById('save-btn').addEventListener('click', saveCurrent);
  document.getElementById('next-ask-btn').addEventListener('click', () => {
    document.getElementById('question-input').value = '';
    show('home');
    document.getElementById('question-input').focus();
  });

  // 音声入力：話す
  setupVoiceInput();

  // 例文タップ
  document.querySelectorAll('.ex').forEach(ex =>
    ex.addEventListener('click', () => {
      document.getElementById('question-input').value = ex.dataset.q;
    }));

  // ナビ（タブ・戻る・空状態ボタン）
  document.querySelectorAll('[data-nav]').forEach(el =>
    el.addEventListener('click', () => show(el.dataset.nav)));

  // なんで箱: フィルタ / カード / 削除（委譲）
  document.getElementById('screen-box').addEventListener('click', e => {
    const f = e.target.closest('[data-filter]');
    if (f) { boxFilter = f.dataset.filter; renderBox(); return; }
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); removeItem(del.dataset.del); renderBox(); return; }
    const card = e.target.closest('.qcard');
    if (card) reopenItem(card.dataset.id);
  });

  // 好奇心の森: 分野の木をタップ→その分野の なんで箱へ
  document.getElementById('garden').addEventListener('click', e => {
    const card = e.target.closest('.tree-card');
    if (card) { boxFilter = card.dataset.cat; show('box'); }
  });

  // 訪問者に「ありがとう」→ カードを閉じる（おくりものは木に残る）
  document.getElementById('vc-thanks').addEventListener('click', hideVisitor);

  // つぎのなんで？→ そのまま次の質問へ連鎖
  document.getElementById('next-q-btn').addEventListener('click', () => {
    const nq = document.getElementById('ans-next').textContent.trim();
    if (!nq) return;
    document.getElementById('question-input').value = nq;
    ask();
  });

  // Enter（Cmd/Ctrl+Enter）で送信。IME変換中は無視。
  document.getElementById('question-input').addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); }
  });

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
