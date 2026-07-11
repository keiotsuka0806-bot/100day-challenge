/* 自由研究ラボ — 好き×好きで世界に1つのテーマ
 * きろくは端末内(localStorage)のみ。AIは答えを書かない(問い・選択肢のみ)。
 */
'use strict';

const STORE_KEY = 'jiyukenkyu_v1';
const MAX_RECORDS = 60;

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('bad shape');
      // 形の検査: 正当JSONでもスキーマが壊れていたら直して使う(QA 2026-07-11 #12)
      const merged = { ...freshState(), ...s };
      if (!Array.isArray(merged.likes) || merged.likes.length < 2) merged.likes = ['', ''];
      if (!merged.hypothesis || typeof merged.hypothesis !== 'object') merged.hypothesis = { think: '', because: '' };
      if (!Array.isArray(merged.records)) merged.records = [];
      if (!Array.isArray(merged.themes)) merged.themes = [];
      if (merged.theme !== null && typeof merged.theme !== 'object') merged.theme = null;
      const validSteps = ['home', 'likes', 'themes', 'sirabe', 'question', 'meaning', 'method', 'hypothesis', 'lab', 'summary'];
      if (!validSteps.includes(merged.step)) merged.step = 'home';
      return merged;
    }
  } catch (e) {
    // 破損データは退避してから初期化(捨てない)
    try { localStorage.setItem(STORE_KEY + '_broken', localStorage.getItem(STORE_KEY) || ''); } catch (_) {}
  }
  return freshState();
}

function freshState() {
  return {
    step: 'home',
    likes: ['', ''], grade: '小3〜4',
    themes: [], theme: null,
    sirabe: '', question: '', meaning: '', method: '',
    hypothesis: { think: '', because: '' },
    records: [], nextQuestion: '', outcome: '',
    createdAt: null,
  };
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    toast('⚠️ 保存できませんでした。写真が多いかも。古いきろくの写真を減らしてね');
    return false;
  }
}

/* ---------- 画面遷移 ---------- */
const SCREENS = ['home', 'likes', 'themes', 'sirabe', 'question', 'meaning', 'method', 'hypothesis', 'lab', 'summary'];
const NAV_MAP = { theme: 'likes', question: 'question', method: 'method', hypothesis: 'hypothesis', lab: 'lab', summary: 'summary' };

/* 観る系(メディア)の好きの検知 */
const MEDIA_WORDS = ['漫画', 'マンガ', 'まんが', 'アニメ', 'ゲーム', '映画', 'ドラマ', '動画', 'youtube', 'ユーチューブ', '音楽', '曲', 'アイドル', '小説', '絵本', 'キャラ', '推し'];
function isMedia(s) { const t = String(s || '').toLowerCase(); return MEDIA_WORDS.some(w => t.includes(w.toLowerCase())); }
function isMediaResearch() {
  return isMedia(state.likes[0]) || isMedia(state.likes[1]) || isMedia(state.theme && state.theme.title);
}

function show(screen) {
  SCREENS.forEach(s => $('screen-' + s).classList.toggle('hidden', s !== screen));
  state.step = screen;
  save();
  $('stepNav').classList.toggle('hidden', screen === 'home');
  document.querySelectorAll('#stepNav button').forEach(b => {
    b.classList.toggle('active', NAV_MAP[b.dataset.step] === screen ||
      (b.dataset.step === 'theme' && (screen === 'likes' || screen === 'themes' || screen === 'sirabe')) ||
      (b.dataset.step === 'question' && screen === 'meaning'));
  });
  if (screen === 'sirabe') $('sirabeTheme').textContent = '🔬 テーマ: ' + (state.theme ? state.theme.title : '');
  if (screen === 'likes') renderLikeChips();
  if (screen === 'themes') { hakaseThemes(); renderThemes(); }
  if (screen === 'question') { renderChips(); $('pickedTheme').textContent = state.theme ? '🔬 テーマ: ' + state.theme.title : ''; }
  if (screen === 'meaning') $('meaningQuestion').textContent = '❓ ' + (state.question || '');
  if (screen === 'lab') renderRecords();
  if (screen === 'summary') renderPoster();
  window.scrollTo(0, 0);
}

function $(id) { return document.getElementById(id); }

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => t.classList.add('hidden'), 3500);
}

/* 祝祭オーバーレイ(タップか2.6秒で閉じる) */
function celebrate(emoji, msg) {
  $('celebrateEmoji').textContent = emoji;
  $('celebrateMsg').textContent = msg;
  const el = $('celebrate');
  el.classList.remove('hidden');
  clearTimeout(celebrate._tm);
  celebrate._tm = setTimeout(() => el.classList.add('hidden'), 2600);
}

/* はかせの動的セリフ */
function hakaseThemes() {
  const [a, b] = state.likes;
  $('hkThemes').textContent = `ほほう…「${a}」×「${b}」⁉ その掛け算、わしも初めて見たぞ。どれがいちばんワクワクするか、きみの直感で選ぶんじゃ。`;
}

function hakaseLab() {
  const n = state.records.length;
  const msg =
    n === 0 ? 'さあ、たんけんの始まりじゃ。今日の1件目を待っとるぞ。' :
    n < 3 ? `${n}日分たまったのう。研究は「つづき」が命じゃ。` :
    n < 7 ? `${n}日分！むむ、きみは本物の研究者の目をしとるな…` :
    `${n}日分…！ここまで続けた小学生を、わしはほとんど知らんぞ。`;
  $('hkLab').textContent = msg;
}

/* ---------- API(鍵なしモック対応) ---------- */
async function callAssist(mode, payload) {
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetch('/api/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ...payload }),
      signal: ctrl.signal,
    });
    clearTimeout(tm);
    // 事実と違う「オフライン」表示をしない: 状態別にreasonを分ける(QA 2026-07-11)
    if (res.status === 429) return { ok: true, mock: true, reason: 'busy', data: localMock(mode, payload) };
    if (!res.ok) return { ok: true, mock: true, reason: 'ai_error', data: localMock(mode, payload) };
    return await res.json();
  } catch (e) {
    // サーバー自体に届かない(ローカルプレビュー・ネット切断) → クライアント側モック
    return { ok: true, mock: true, reason: 'offline', data: localMock(mode, payload) };
  }
}

function mockNotice(reason) {
  if (reason === 'no_key') return '（いまは体験モード: AI未接続のため定番の型から提案しています）';
  if (reason === 'ai_error') return '（AIの調子が悪いみたいじゃ。定番の型から提案しています）';
  if (reason === 'busy') return '（混み合っとるようじゃ。1分待ってもう一度。いまは定番の型から提案）';
  return '（オフラインのため、定番の型から提案しています）';
}

function localMock(mode, p) {
  if (mode === 'themes') {
    const [a, b] = p.likes;
    // 近すぎ検知: 2つとも観る系 → 「同じ作品のA版とB版をくらべる」内容分析型に切り替え
    if (isMedia(a) && isMedia(b)) {
      return { themes: [
        { title: `${a}×${b}: 同じ作品の${a}版と${b}版をくらべる`, naze: `同じ話なのに違いがある＝作った人の工夫が数字で見えるから`, toi_hint: `同じシーンは、${a}では何コマ（何ページ）？ ${b}では何秒？` },
        { title: `${a}×${b}: 人気作品のかくれたルールをさがす`, naze: `「人気の秘密」が数字で見つかったら大発見だから`, toi_hint: `人気の作品とそうでない作品で、◯◯の回数はちがう？` },
        { title: `${a}×${b}: みんなの「思いこみ」を数字でたしかめる`, naze: `みんなが信じていることを、実際に数えた人はほとんどいないから`, toi_hint: `「${b}は原作どおり」って本当？ セリフはどれくらい変わってる？` },
      ]};
    }
    return { themes: [
      { title: `${a}×${b}: ${b}の中の「${a}のしくみ」をさがす`, naze: `だれも${a}と${b}を同時に調べた人はいないから`, toi_hint: `${b}のどこに${a}と同じ形がある？` },
      { title: `${a}×${b}: ${a}で${b}を再現してみる`, naze: `作ってみると「本物のすごさ」が数字でわかるから`, toi_hint: `${a}で${b}を作ると、本物と何がちがう？` },
      { title: `${a}×${b}: 30日で${b}と${a}はどう変わる？`, naze: `毎日同じ時間に見ると、見えなかった変化が見えるから`, toi_hint: `1日目と30日目で何がいちばん変わる？` },
    ]};
  }
  if (mode === 'toi') {
    return { hints: [
      'その問いは「数字」で答えられる？（何個・何秒・何通り）',
      '「くらべる相手」はいる？（差があってはじめて意味が出るよ）',
      '30日間つづけて見たら変化がわかる形にできる？',
    ]};
  }
  if (mode === 'kurabe') {
    return { hints: [
      '人気の作品 vs そうでない作品（人気の秘密をさがす）',
      '1巻（最初） vs 最終巻（最新）（変化・成長を見る）',
      '原作 vs アニメ版（思いこみをたしかめる）',
      'きのう vs 今日（時間でくらべる）',
      '日なた vs 日かげ（場所・条件でくらべる）',
    ]};
  }
  return {};
}

/* ---------- 問いチップ(観る系/観察系で出し分け) ---------- */
const CHIPS_BASE = [
  ['どっちが？', '◯◯と △△では どちらが どれくらい ちがう？'],
  ['どう変わる？', '◯◯は 30日で どう変わる？'],
  ['何通り？', '◯◯は 何通り ある？'],
  ['何秒？', '◯◯は 何秒（何分）かかる？'],
  ['何個？', '◯◯は 何個（何匹）いる？'],
];
const CHIPS_MEDIA = [
  ['同じシーンは？', '同じシーンは、漫画では何コマ？ アニメでは何秒？'],
  ['人気作vs他', '人気の◯◯と そうでない◯◯で、△△の回数はちがう？'],
  ['最初vs最後', '1巻と最終巻で、◯◯は どう変わった？'],
  ['原作どおり？', '原作とアニメで、◯◯は どれくらい変わってる？'],
  ['1話に何回？', '◯◯は 1話に何回（何種類）出てくる？'],
];

function renderChips() {
  const wrap = $('questionChips');
  wrap.innerHTML = '';
  const set = isMediaResearch() ? CHIPS_MEDIA : CHIPS_BASE;
  set.forEach(([label, tpl]) => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = label;
    c.addEventListener('click', () => { $('questionInput').value = tpl; $('questionInput').focus(); });
    wrap.appendChild(c);
  });
}

/* ---------- ①好き×好き→テーマ ---------- */
const LIKE_SUGGESTIONS = ['恐竜', '虫', 'ねこ', '犬', 'サッカー', '野球', 'ダンス', '折り紙', 'お菓子づくり', '料理', 'ゲーム', '漫画', 'アニメ', '電車', '車', '宇宙', '天気', '音楽', 'お絵かき', '植物'];

function renderLikeChips() {
  const wrap = $('likeChips');
  if (wrap.childElementCount) return;
  LIKE_SUGGESTIONS.forEach(word => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = word;
    c.addEventListener('click', () => {
      if (!$('like1').value.trim()) $('like1').value = word;
      else if (!$('like2').value.trim() && $('like1').value.trim() !== word) $('like2').value = word;
      else if ($('like1').value.trim() !== word) $('like2').value = word; // 両方埋まってたら2つ目を入れ替え
    });
    wrap.appendChild(c);
  });
}
async function makeThemes() {
  const a = $('like1').value.trim();
  const b = $('like2').value.trim();
  if (!a || !b) { toast('好きなものを2つ入れてね'); return; }
  state.likes = [a, b];
  state.grade = $('grade').value;
  save();
  const btn = $('btnThemes');
  btn.disabled = true;
  $('likesStatus').textContent = `🧑‍🔬 うーむ、「${a}」×「${b}」…わしの研究ノートをめくっとるところじゃ…（10秒ほど待つのじゃ）`;
  const res = await callAssist('themes', { likes: state.likes, grade: state.grade });
  btn.disabled = false;
  $('likesStatus').textContent = '';
  if (!res.ok || !res.data || !Array.isArray(res.data.themes)) { toast('うまくいかなかった。もう一度おしてね'); return; }
  state.themes = res.data.themes.slice(0, 3);
  save();
  $('themesHint').textContent = `「${a}」×「${b}」の掛け算 ` + (res.mock ? mockNotice(res.reason) : '');
  renderThemes();
  show('themes');
}

function renderThemes() {
  const wrap = $('themeCards');
  wrap.innerHTML = '';
  state.themes.forEach((t, i) => {
    const card = document.createElement('button');
    card.className = 'card theme';
    const title = document.createElement('b'); title.textContent = t.title;
    const naze = document.createElement('span'); naze.textContent = '💡 ' + (t.naze || '');
    const hint = document.createElement('span'); hint.className = 'toi-hint'; hint.textContent = '❓ ' + (t.toi_hint || '');
    card.append(title, naze, hint);
    card.addEventListener('click', () => {
      state.theme = t;
      save();
      $('pickedTheme').textContent = '🔬 テーマ: ' + t.title;
      // 問いは自動で入れない(Kei FB 2026-07-12: AIの問いをなぞる体験になる)。例は「ちらっと見る」の中だけ
      show('sirabe'); // まず先行しらべへ
    });
    wrap.appendChild(card);
  });
}

/* ---------- ②問い ---------- */
async function askQuestionHints() {
  const btn = $('btnAskAI');
  btn.disabled = true;
  const res = await callAssist('toi', { theme: state.theme ? state.theme.title : '', question: $('questionInput').value.trim(), grade: state.grade });
  btn.disabled = false;
  const box = $('aiQuestionHints');
  box.innerHTML = '';
  box.classList.remove('hidden');
  const hints = (res.data && res.data.hints) || [];
  const head = document.createElement('p');
  head.textContent = '🧑‍🔬 はかせからの問いかけ ' + (res.mock ? mockNotice(res.reason) : '（答えはきみが決める）');
  box.appendChild(head);
  const ul = document.createElement('ul');
  hints.slice(0, 4).forEach(h => { const li = document.createElement('li'); li.textContent = h; ul.appendChild(li); });
  box.appendChild(ul);
}

function saveQuestion() {
  const q = $('questionInput').value.trim();
  if (!q) { toast('問いを書いてね（チップを押すと型が入るよ）'); return; }
  state.question = q;
  if (!save()) return; // 保存できていないのに先へ進まない(QA 2026-07-11 #11)
  show('meaning'); // だから何？ゲートへ
}

/* ---------- ②b だから何？ゲート ---------- */
function pickMeaning(m) {
  state.meaning = m;
  if (!save()) return;
  show('method');
}

async function askKurabeHints() {
  const btn = $('btnKurabe');
  btn.disabled = true;
  const res = await callAssist('kurabe', { theme: state.theme ? state.theme.title : '', question: state.question, grade: state.grade });
  btn.disabled = false;
  const box = $('kurabeHints');
  box.innerHTML = '';
  box.classList.remove('hidden');
  const head = document.createElement('p');
  head.textContent = '🧑‍🔬 「くらべる相手」の候補じゃ（選ぶのはきみ） ' + (res.mock ? mockNotice(res.reason) : '');
  box.appendChild(head);
  const ul = document.createElement('ul');
  ((res.data && res.data.hints) || []).slice(0, 5).forEach(h => { const li = document.createElement('li'); li.textContent = h; ul.appendChild(li); });
  box.appendChild(ul);
  const tail = document.createElement('p');
  tail.textContent = '👆 くらべる相手が決まったら「← 問いを直す」で問いに入れてみよう';
  box.appendChild(tail);
}

/* ---------- ③はかり方 / ④仮説 ---------- */
function pickMethod(m) {
  state.method = m;
  if (!save()) return;
  show('hypothesis');
}

function saveHypo() {
  const think = $('hypoThink').value.trim();
  const because = $('hypoBecause').value.trim();
  if (!think) { toast('「こうなると思う！」を書いてね'); return; }
  state.hypothesis = { think, because };
  if (!state.createdAt) state.createdAt = new Date().toISOString();
  if (!save()) return;
  show('lab');
}

/* ---------- ⑤観察きろく ---------- */
let pendingPhoto = null;

function onPhotoPicked(file) {
  if (!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const MAX = 640;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    pendingPhoto = cv.toDataURL('image/jpeg', 0.62); // 60件×localStorage 5MB制限から逆算した品質(QA 2026-07-11 #10)
    const prev = $('recPreview');
    prev.src = pendingPhoto;
    prev.classList.remove('hidden');
    URL.revokeObjectURL(url);
  };
  img.onerror = () => { toast('この写真は読み込めなかった'); URL.revokeObjectURL(url); };
  img.src = url;
}

function addRecord() {
  const memo = $('recMemo').value.trim();
  if (!memo && !pendingPhoto) { toast('メモか写真、どちらかは入れてね'); return; }
  if (state.records.length >= MAX_RECORDS) { toast(`きろくは${MAX_RECORDS}件まで。まとめに進もう！`); return; }
  state.records.push({ date: todayStr(), memo, photo: pendingPhoto });
  if (!save()) { state.records.pop(); return; } // 容量オーバー時は巻き戻す
  pendingPhoto = null;
  $('recMemo').value = '';
  $('recPreview').classList.add('hidden');
  $('recPhoto').value = '';
  // 容量の先回り警告(QuotaExceededで突然止まる前に伝える)
  try {
    if (JSON.stringify(state).length > 3_800_000) toast('🧑‍🔬 写真がだいぶ増えたのう。そろそろ文字だけの記録にするか、古い写真つき記録を消すのじゃ');
  } catch (_) {}
  const n = state.records.length;
  if (n === 1) celebrate('🎉', 'はじめての記録じゃ！きみは今日から研究員じゃぞ！');
  else if (n === 7) celebrate('⭐', '7日分…！本物の研究者のリズムじゃ！');
  else if (n === 30) celebrate('🏆', '30日やりきった⁉ わしの研究人生でも滅多に見ん根性じゃ！');
  else toast('📗 きろくした！（' + n + '日分）');
  renderRecords();
}

function cut(s, n) { return [...String(s)].slice(0, n).join(''); } // 絵文字(サロゲートペア)を分断しない切り詰め

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderRecords() {
  hakaseLab();
  $('labQuestion').textContent = '❓ ' + (state.question || '') +
    (state.method === '比べる' ? '\n⚖️ くらべるときは、変えることは1つだけ！（2つ変えると、どっちが原因か分からなくなるよ）' : '');
  $('recCount').textContent = state.records.length ? `これまでのきろく（${state.records.length}件）` : 'まだきろくはないよ。今日の1件目をどうぞ！';
  const list = $('recordList');
  list.innerHTML = '';
  [...state.records].reverse().forEach((r, revIdx) => {
    const idx = state.records.length - 1 - revIdx;
    const div = document.createElement('div');
    div.className = 'record';
    if (r.photo) { const im = document.createElement('img'); im.src = r.photo; im.alt = '観察写真'; div.appendChild(im); }
    const p = document.createElement('p');
    const d = document.createElement('b'); d.textContent = r.date + ' ';
    p.appendChild(d);
    p.appendChild(document.createTextNode(r.memo || ''));
    const del = document.createElement('button');
    del.className = 'rec-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'このきろくを消す');
    del.addEventListener('click', () => {
      if (!confirm('このきろくを消す？（もどせません）')) return;
      state.records.splice(idx, 1);
      save(); renderRecords();
    });
    div.append(p, del);
    list.appendChild(div);
  });
}

/* ---------- ⑥まとめ(模造紙) ---------- */
function renderPoster() {
  $('nextQuestion').value = state.nextQuestion || '';
  const el = $('poster');
  el.innerHTML = '';
  const blocks = [
    ['🎯 目的（しらべたいこと）', (state.question || '（②で問いを書こう）') + (state.meaning ? `\n→ わかること: ${state.meaning}` : '')],
    ['📚 しらべたこと（先行しらべ）', state.sirabe || '（①bでしらべたことを書くとここに入るよ）'],
    ['🔮 よそう（仮説）', state.hypothesis.think ? `${state.hypothesis.think}\nなぜなら… ${state.hypothesis.because}` : '（④で書こう）'],
    ['🧰 方法（はかり方）', state.method ? `「${state.method}」ではかった` : '（③で選ぼう）'],
    ['📊 結果（きろくから）', !state.records.length ? '（たんけんできろくしよう）'
      : state.records.length === 1 ? `1日分のきろく:「${cut(state.records[0].memo || '写真', 40)}」`
      : `${state.records.length}日分のきろく。最初:「${cut(state.records[0].memo || '写真', 40)}」→ 最新:「${cut(state.records[state.records.length - 1].memo || '写真', 40)}」`],
    ['💡 わかったこと', (state.outcome === 'ちがった' ? 'よそうと違った=大発見！なぜ違ったのかを、' : state.outcome === '当たった' ? 'よそうが当たった理由を、' : '← ここは ') + 'きみの言葉で！（AIは書きません）'],
    ['🔭 次に知りたいこと', state.nextQuestion || '（この画面の上の欄に書くとここに入るよ）'],
  ];
  blocks.forEach(([h, body]) => {
    const b = document.createElement('div');
    b.className = 'poster-block' + (h.includes('わかったこと') && h.includes('💡') ? ' freeform' : '');
    const hd = document.createElement('h4'); hd.textContent = h;
    const tx = document.createElement('p'); tx.textContent = body;
    b.append(hd, tx);
    el.appendChild(b);
  });
}

/* ---------- 起動 ---------- */
function clearInputs() {
  // stateリセット時にDOMの残留テキストも消す(QA 2026-07-11 #2: 旧研究の混入防止)
  ['like1', 'like2', 'sirabeNote', 'questionInput', 'hypoThink', 'hypoBecause', 'recMemo', 'nextQuestion'].forEach(id => { $(id).value = ''; });
  $('aiQuestionHints').classList.add('hidden');
  $('kurabeHints').classList.add('hidden');
  $('recPreview').classList.add('hidden');
  $('recPhoto').value = '';
  pendingPhoto = null;
  document.querySelectorAll('.outcome-btn').forEach(x => x.classList.remove('chip-on'));
}

function init() {
  // 「つづきから」用に、show('home')でstepが上書きされる前の到達点を退避(QA 2026-07-11 #1)
  const resumeStep = state.step;
  // ホーム
  $('btnStart').addEventListener('click', () => {
    if (state.createdAt || state.theme) {
      if (!confirm('前の研究のきろくが残っています。新しく始めると消えます。いい？')) return;
      state = freshState(); save();
      clearInputs();
    }
    show('likes');
  });
  if (state.theme || state.createdAt) {
    $('btnContinue').classList.remove('hidden');
    $('continueLabel').textContent = state.theme ? [...state.theme.title].slice(0, 18).join('') : 'テーマ決めから';
    $('btnContinue').addEventListener('click', () => show(resumeStep === 'home' || !resumeStep ? 'lab' : resumeStep));
  }
  // ナビ
  document.querySelectorAll('#stepNav button').forEach(b =>
    b.addEventListener('click', () => show(NAV_MAP[b.dataset.step])));
  // ①
  $('btnThemes').addEventListener('click', makeThemes);
  $('btnRetheme').addEventListener('click', () => show('likes'));
  // ①b しらべてみよう
  $('btnSirabeDone').addEventListener('click', () => {
    state.sirabe = $('sirabeNote').value.trim();
    if (!save()) return;
    show('question');
  });
  $('btnSirabeAllKnown').addEventListener('click', () => {
    state.sirabe = $('sirabeNote').value.trim();
    if (!save()) return;
    toast('しらべて分かるのも大事な一歩！ちがうテーマにしよう');
    show('themes');
  });
  // ②(チップはrenderChipsで動的生成)
  $('btnAskAI').addEventListener('click', askQuestionHints);
  $('btnSaveQuestion').addEventListener('click', saveQuestion);
  // ②b
  document.querySelectorAll('#meaningCards .meaning').forEach(c =>
    c.addEventListener('click', () => pickMeaning(c.dataset.meaning)));
  $('btnKurabe').addEventListener('click', askKurabeHints);
  $('btnBackQuestion').addEventListener('click', () => show('question'));
  // ③
  document.querySelectorAll('#methodCards .method').forEach(c =>
    c.addEventListener('click', () => pickMethod(c.dataset.method)));
  // ④
  $('btnSaveHypo').addEventListener('click', saveHypo);
  // ⑤
  $('recPhoto').addEventListener('change', e => onPhotoPicked(e.target.files[0]));
  $('btnAddRecord').addEventListener('click', addRecord);
  $('btnToSummary').addEventListener('click', () => show('summary'));
  // まとめ: よそうとくらべてどうじゃった？
  document.querySelectorAll('.outcome-btn').forEach(b =>
    b.addEventListener('click', () => {
      state.outcome = b.dataset.outcome;
      save();
      document.querySelectorAll('.outcome-btn').forEach(x => x.classList.toggle('chip-on', x === b));
      if (state.outcome === 'ちがった') {
        celebrate('💥', 'よそうと違った⁉ それこそ、いちばんの大発見じゃーー！！');
        $('hkSummary').textContent = '予想外れは失敗ではない。「世界がきみの予想より面白かった」という証拠じゃ。なぜ違ったのか、きみの言葉で「わかったこと」に書くんじゃぞ。';
      } else if (state.outcome === '当たった') {
        celebrate('🎯', 'よそうが当たった！見事な読みじゃ！');
        $('hkSummary').textContent = '当たった理由まで書けたら一級品の研究じゃ。「なぜなら」の予想も当たっとったか、確かめてみるんじゃ。';
      } else {
        toast('🧑‍🔬 まだわからない、も立派な答えじゃ。たんけんを続けよう');
      }
      renderPoster();
    }));
  // ⑥
  $('nextQuestion').addEventListener('change', () => { state.nextQuestion = $('nextQuestion').value.trim(); save(); renderPoster(); });
  $('btnPrint').addEventListener('click', () => window.print());
  $('btnReset').addEventListener('click', () => {
    if (!confirm('本当に全部消して最初から？（きろくも消えます）')) return;
    state = freshState(); save(); location.reload();
  });
  // 入力途中の下書きも自動保存(確定ボタン前にリロードしても消えない/QA 2026-07-11 #5)
  $('questionInput').addEventListener('change', () => { state.question = $('questionInput').value.trim(); save(); });
  $('sirabeNote').addEventListener('change', () => { state.sirabe = $('sirabeNote').value.trim(); save(); });
  $('hypoThink').addEventListener('change', () => { state.hypothesis.think = $('hypoThink').value.trim(); save(); });
  $('hypoBecause').addEventListener('change', () => { state.hypothesis.because = $('hypoBecause').value.trim(); save(); });
  // 祝祭はタップでも閉じられる
  $('celebrate').addEventListener('click', () => $('celebrate').classList.add('hidden'));
  // 復元
  document.querySelectorAll('.outcome-btn').forEach(x => x.classList.toggle('chip-on', x.dataset.outcome === state.outcome));
  $('like1').value = state.likes[0] || '';
  $('like2').value = state.likes[1] || '';
  $('grade').value = state.grade;
  $('questionInput').value = state.question || '';
  $('sirabeNote').value = state.sirabe || '';
  $('hypoThink').value = state.hypothesis.think || '';
  $('hypoBecause').value = state.hypothesis.because || '';
  show('home');
}

init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
