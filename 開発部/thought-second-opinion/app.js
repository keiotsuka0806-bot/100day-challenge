'use strict';

// ── 認知の歪み（サーバと対応） ──
const DISTORTIONS = {
  all_or_nothing: '全か無か思考',
  overgeneralization: '過度の一般化',
  mental_filter: '心のフィルター',
  disqualifying_positive: 'マイナス化思考',
  jumping_to_conclusions: '結論の飛躍',
  magnification: '拡大解釈・過小評価',
  emotional_reasoning: '感情的決めつけ',
  should_statements: 'すべき思考',
  labeling: 'レッテル貼り',
  personalization: '個人化',
};
const DISTORTION_TIPS = {
  all_or_nothing: '物事を「白か黒か」で捉え、その中間（グレー）を見落とすクセ。',
  overgeneralization: '一度の出来事を「いつも」「みんな」と広げて捉えるクセ。',
  mental_filter: '良い面を素通りして、悪い一点だけに目が向くクセ。',
  disqualifying_positive: 'うまくいったことを「まぐれ」と打ち消してしまうクセ。',
  jumping_to_conclusions: '確かめていないのに、悪い結論を先取りするクセ。',
  magnification: '悪いことを大きく、良いことを小さく見積もるクセ。',
  emotional_reasoning: '「不安に感じる＝危険だ」と、感情を事実と混同するクセ。',
  should_statements: '「〜すべき」で自分や他人を縛り、できないと責めるクセ。',
  labeling: '一つの失敗で「自分はダメな人間だ」と決めつけるクセ。',
  personalization: '自分のせいではないことまで、自分の責任にするクセ。',
};

const MOODS = ['不安', '落ち込み', '怒り', '焦り', '恥ずかしさ', 'さみしさ', '罪悪感', 'むなしさ'];

// APIが繋がらない時の予備の問い（3問それぞれ別のねらい）
const FALLBACK_QUESTIONS = [
  'その考えを裏づける事実と、逆に当てはまらない事実は、それぞれ何がありますか？',
  'もし親しい友人が同じ状況にいたら、あなたは何と声をかけますか？',
  '最悪の見方を100%信じる根拠はありますか？　一番ありそうな現実は、どんなものでしょう。',
];

// クライアント側の危機ワード（サーバと二重に守る）
const CRISIS_RE = [/死(に|の)?たい/, /消えたい/, /自殺/, /いなくなりたい/, /リスト?カット/, /死(の|ん)で/];
const isCrisis = (t) => !!t && CRISIS_RE.some((re) => re.test(t));

const SCREENS = ['situation', 'mood', 'thought', 'distortion', 'socratic', 'balance', 'result'];

const data = {
  situation: '', moods: [], moodBefore: 60,
  autoThought: '', distortionKey: '', answers: [],
  balanceThought: '', moodAfter: 50, encourage: '',
};
const moodLabel = () => (data.moods.length === 1 ? data.moods[0] : '気持ち');
let qIndex = 0;
const TOTAL_Q = 3;

const $ = (s) => document.querySelector(s);
const screens = {};
document.querySelectorAll('.screen').forEach((el) => { screens[el.dataset.screen] = el; });

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const el = screens[name] || screens.intro;
  if (el) el.classList.add('active');
  $('#restartBtn').hidden = (name === 'intro');
  const prog = $('#progress');
  const idx = SCREENS.indexOf(name);
  if (idx >= 0) {
    prog.hidden = false;
    $('#progressBar').style.width = `${((idx + 1) / SCREENS.length) * 100}%`;
  } else {
    prog.hidden = true;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCrisis() { $('#crisisOverlay').hidden = false; }
$('#crisisCloseBtn').addEventListener('click', () => { $('#crisisOverlay').hidden = true; });
$('#helpLink').addEventListener('click', showCrisis);

// 「もどる」（テキスト入力ステップのみ。入力値はDOMに残るので消えない）
document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});

async function api(stage, extra = {}) {
  const body = {
    stage,
    situation: data.situation,
    autoThought: data.autoThought,
    distortion: data.distortionKey,
    balanceThought: data.balanceThought,
    ...extra,
  };
  const res = await fetch('/api/cbt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.crisis) { showCrisis(); throw new Error('crisis'); }
  return json;
}

// ── イントロ ──
$('[data-go="situation"]').addEventListener('click', () => {
  if (overUsedToday()) {
    if (!confirm('今日はもう何度か取り組んでいます。考えすぎて疲れていませんか？\n少し休んでから、また来てもいいんですよ。\n\nそれでも続けますか？')) return;
  }
  showScreen('situation');
});

// ── 気持ちチップ ──
const chipWrap = $('#moodChips');
MOODS.forEach((m) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = m;
  b.addEventListener('click', () => {
    b.classList.toggle('selected');
    if (data.moods.includes(m)) data.moods = data.moods.filter((x) => x !== m);
    else data.moods.push(m);
  });
  chipWrap.appendChild(b);
});

// ── スライダー ──
function bindSlider(input, out, key) {
  const el = $(input), o = $(out);
  el.addEventListener('input', () => { o.textContent = `${el.value}%`; data[key] = +el.value; });
}
bindSlider('#moodBefore', '#moodBeforeVal', 'moodBefore');
bindSlider('#moodAfter', '#moodAfterVal', 'moodAfter');

// ── ステップ送り ──
const nextHandlers = {
  situation() {
    const v = $('#situationInput').value.trim();
    if (!v) return alert('出来事を書いてください');
    if (isCrisis(v)) return showCrisis();
    data.situation = v;
    showScreen('mood');
  },
  mood() {
    if (!data.moods.length) return alert('今の気持ちを選んでください（複数えらべます）');
    showScreen('thought');
  },
  thought() {
    const v = $('#thoughtInput').value.trim();
    if (!v) return alert('浮かんだ考えを書いてください');
    if (isCrisis(v)) return showCrisis();
    data.autoThought = v;
    showScreen('distortion');
    loadDistortions();
  },
  balance() {
    const v = $('#balanceInput').value.trim();
    if (!v) return alert('今の考えを書いてみてください');
    if (isCrisis(v)) return showCrisis();
    data.balanceThought = v;
    goResult();
  },
};

document.querySelectorAll('[data-next]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.next;
    if (key === 'distortion-skip') { data.distortionKey = ''; startSocratic(); return; }
    const h = nextHandlers[key];
    if (h) h();
  });
});

// ── ④ 歪み候補 ──
async function loadDistortions() {
  const box = $('#distortionList');
  box.innerHTML = '<div class="loading">AIが見ています…</div>';
  let items = [];
  try {
    const r = await api('distortion');
    items = (r.distortions || []).filter((d) => DISTORTIONS[d.key]);
  } catch (e) { if (e.message === 'crisis') return; }
  if (!items.length) {
    items = [
      { key: 'jumping_to_conclusions', why: '確かめる前に結論を急いでいるかもしれません。' },
      { key: 'all_or_nothing', why: '白か黒かで捉えているかもしれません。' },
    ];
  }
  box.innerHTML = '';
  items.slice(0, 2).forEach((d) => {
    const el = document.createElement('button');
    el.className = 'distortion-item';
    el.innerHTML = `<div class="d-name">${DISTORTIONS[d.key]}</div><div class="d-why"></div>`;
    el.querySelector('.d-why').textContent = d.why || '';
    el.addEventListener('click', () => {
      box.querySelectorAll('.distortion-item').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      data.distortionKey = d.key;
      setTimeout(startSocratic, 250);
    });
    box.appendChild(el);
  });
}

// ── ⑤ ソクラテス式の問い ──
async function startSocratic() {
  qIndex = 0;
  data.answers = [];
  showScreen('socratic');
  await loadQuestion();
}
async function loadQuestion() {
  $('#qCounter').textContent = `問い ${qIndex + 1} / ${TOTAL_Q}`;
  $('#questionText').textContent = '…';
  $('#answerInput').value = '';
  $('#answerNextBtn').disabled = true;
  $('#answerNextBtn').textContent = (qIndex + 1 >= TOTAL_Q) ? '考えをまとめる' : '次の問いへ';
  const fallback = FALLBACK_QUESTIONS[Math.min(qIndex, FALLBACK_QUESTIONS.length - 1)];
  try {
    const r = await api('socratic', { qIndex });
    $('#questionText').textContent = r.question || fallback;
  } catch (e) {
    if (e.message === 'crisis') return;
    $('#questionText').textContent = fallback;
  }
  $('#answerNextBtn').disabled = false;
}
$('#answerNextBtn').addEventListener('click', () => {
  const v = $('#answerInput').value.trim();
  if (isCrisis(v)) return showCrisis();
  data.answers.push({ q: $('#questionText').textContent, a: v });
  qIndex += 1;
  if (qIndex >= TOTAL_Q) { goBalance(); } else { loadQuestion(); }
});

// ── ⑥ バランス思考 ──
function goBalance() {
  const recap = $('#balanceRecap');
  recap.innerHTML = `<b>はじめの考え：</b>${escapeHtml(data.autoThought)}`;
  showScreen('balance');
}

// ── ⑦ 結果 ──
async function goResult() {
  $('#moodAfter').value = Math.min(data.moodBefore, 50);
  $('#moodAfterVal').textContent = `${$('#moodAfter').value}%`;
  data.moodAfter = +$('#moodAfter').value;
  $('#resultCard').hidden = true;
  showScreen('result');
  markUsedToday(); // 1セッション1回だけ数える（renderResultだと再評価のたびに増える）
  try {
    const r = await api('balance');
    data.encourage = r.message || '';
  } catch (e) { if (e.message === 'crisis') return; }
}

$('#seeResultBtn').addEventListener('click', () => {
  data.moodAfter = +$('#moodAfter').value;
  renderResult();
});

function renderResult() {
  $('#resultCard').hidden = false;
  $('#numBefore').textContent = `${data.moodBefore}%`;
  $('#numAfter').textContent = `${data.moodAfter}%`;
  requestAnimationFrame(() => {
    $('#fillBefore').style.width = `${data.moodBefore}%`;
    $('#fillAfter').style.width = `${data.moodAfter}%`;
  });
  const diff = data.moodBefore - data.moodAfter;
  const dt = $('#deltaText');
  if (diff > 0) dt.textContent = `${moodLabel()}が ${diff}ポイント やわらぎました`;
  else if (diff === 0) dt.textContent = '今日は変わらなかった。それでも、向き合えたことに意味があります';
  else dt.textContent = '気持ちが動くまでには時間がかかることもあります。焦らなくて大丈夫';

  $('#aiEncourage').textContent = data.encourage || '自分の言葉で見つめ直せたこと、それ自体が一歩です。';

  const learn = $('#learnBox');
  if (data.distortionKey && DISTORTION_TIPS[data.distortionKey]) {
    learn.hidden = false;
    learn.innerHTML = `<h3>今日のひとつ学び：${DISTORTIONS[data.distortionKey]}</h3>`;
    learn.appendChild(document.createTextNode(DISTORTION_TIPS[data.distortionKey]));
  } else {
    learn.hidden = true;
  }
}

// ── シェア画像 ──
$('#shareBtn').addEventListener('click', drawShareCard);
function drawShareCard() {
  const c = $('#shareCanvas'), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1080);
  g.addColorStop(0, '#14203b'); g.addColorStop(1, '#0f1424');
  x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);

  x.textAlign = 'center'; x.fillStyle = '#9aa6c8';
  x.font = '40px sans-serif';
  x.fillText('思考のセカンドオピニオン', 540, 150);

  x.fillStyle = '#eef2ff'; x.font = 'bold 64px sans-serif';
  x.fillText(`${moodLabel()}と向き合った`, 540, 380);

  // ビフォーアフター
  drawBar(x, 300, 560, data.moodBefore, '#6b7799', 'はじめ');
  drawBar(x, 300, 700, data.moodAfter, '#7dd3c0', 'いま');

  const diff = data.moodBefore - data.moodAfter;
  x.fillStyle = '#7dd3c0'; x.font = 'bold 56px sans-serif';
  x.fillText(diff > 0 ? `−${diff} ポイント` : 'また向き合えた', 540, 880);

  x.fillStyle = '#9aa6c8'; x.font = '34px sans-serif';
  x.fillText('#100DayChallenge  #認知行動療法', 540, 990);

  c.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'second-opinion.png'; a.click();
    URL.revokeObjectURL(url);
  });
}
function drawBar(x, left, y, val, color, label) {
  const w = 480;
  x.textAlign = 'left'; x.fillStyle = '#9aa6c8'; x.font = '32px sans-serif';
  x.fillText(label, left, y - 18);
  x.fillStyle = '#1b2440'; roundRect(x, left, y, w, 36, 18); x.fill();
  x.fillStyle = color; roundRect(x, left, y, w * val / 100, 36, 18); x.fill();
  x.textAlign = 'left'; x.fillStyle = '#eef2ff'; x.font = 'bold 32px sans-serif';
  x.fillText(`${val}%`, left + w + 20, y + 28);
}
function roundRect(x, l, t, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t, l + w, t + h, r);
  x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r);
  x.arcTo(l, t, l + w, t, r);
  x.closePath();
}

// ── もう一度／最初から ──
function resetAll() {
  Object.assign(data, { situation: '', moods: [], moodBefore: 60, autoThought: '', distortionKey: '', answers: [], balanceThought: '', moodAfter: 50, encourage: '' });
  qIndex = 0;
  $('#situationInput').value = ''; $('#thoughtInput').value = '';
  $('#balanceInput').value = ''; $('#answerInput').value = '';
  $('#moodBefore').value = 60; $('#moodBeforeVal').textContent = '60%';
  $('#moodAfter').value = 50; $('#moodAfterVal').textContent = '50%';
  chipWrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
  $('#resultCard').hidden = true;
}
$('#againBtn').addEventListener('click', () => { resetAll(); showScreen('situation'); });
$('#restartBtn').addEventListener('click', () => { resetAll(); showScreen('intro'); });

// ── 反芻ガード（1日3回まではやさしく止める） ──
function todayKey() { return 'tso_uses_' + new Date().toISOString().slice(0, 10); }
function overUsedToday() { return (+localStorage.getItem(todayKey()) || 0) >= 3; }
function markUsedToday() { localStorage.setItem(todayKey(), (+localStorage.getItem(todayKey()) || 0) + 1); }

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
