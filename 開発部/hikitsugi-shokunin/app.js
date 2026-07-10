// 引き継ぎ職人 — 全アプリロジック
// データは localStorage のみ（端末外に保存しない）。AI呼び出しは /api/interview（鍵なしモックで縮退）。

const LS_KEY = 'hikitsugi_wiki_v1';

const state = {
  meta: { jobType: 'その他', deadline: '', consented: false, createdAt: '' },
  sources: [],   // {id, title, text, addedAt}
  pages: [],     // {id, title, body, refs:[], origin:'draft'|'interview'|'manual', updatedAt}
  history: [],   // {q, a, pageTitle, at}
  queue: [],     // {q, target, reason}
  gaps: [],      // {id, text, done}
  plan30: null,  // [{phase, items:[]}]
  asks: [],      // {q, answer, sources:[], mock, at} 後任の質問履歴
};

let currentPageId = null;
let busy = false;

// ===== 保存・復元 =====

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    toast('⚠️ 保存に失敗しました。端末の空き容量を確認し、設定から控えを書き出してください');
  }
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch (_) {}
  if (!raw) return false;
  try {
    applyImported(JSON.parse(raw));
    return true;
  } catch (_) {
    return false;
  }
}

// 復元・インポート共通: 型を検証しながら state に流し込む（信用しない）
function applyImported(d) {
  if (!d || typeof d !== 'object') throw new Error('bad data');
  const m = d.meta && typeof d.meta === 'object' ? d.meta : {};
  state.meta = {
    jobType: ['事務', '営業', 'エンジニア', 'その他'].includes(m.jobType) ? m.jobType : 'その他',
    deadline: typeof m.deadline === 'string' ? m.deadline.slice(0, 10) : '',
    consented: m.consented === true,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
  };
  state.sources = (Array.isArray(d.sources) ? d.sources : []).slice(0, 30).map(s => ({
    id: str(s.id) || uid(),
    title: str(s.title).slice(0, 60),
    text: str(s.text).slice(0, 20000),
    addedAt: str(s.addedAt),
  })).filter(s => s.text);
  state.pages = (Array.isArray(d.pages) ? d.pages : []).slice(0, 100).map(p => ({
    id: str(p.id) || uid(),
    title: str(p.title).slice(0, 60) || '無題ページ',
    body: str(p.body).slice(0, 20000),
    refs: (Array.isArray(p.refs) ? p.refs : []).slice(0, 10).map(r => str(r).slice(0, 60)),
    origin: ['draft', 'interview', 'manual'].includes(p.origin) ? p.origin : 'manual',
    checked: p.checked === true,
    updatedAt: str(p.updatedAt),
  }));
  state.history = (Array.isArray(d.history) ? d.history : []).slice(0, 200).map(h => ({
    q: str(h.q).slice(0, 300), a: str(h.a).slice(0, 2000),
    pageTitle: str(h.pageTitle).slice(0, 60), at: str(h.at),
  }));
  state.queue = (Array.isArray(d.queue) ? d.queue : []).slice(0, 10).map(item => ({
    q: str(item.q).slice(0, 300), target: str(item.target).slice(0, 60), reason: str(item.reason).slice(0, 100),
  })).filter(item => item.q);
  state.gaps = (Array.isArray(d.gaps) ? d.gaps : []).slice(0, 50).map(g => ({
    id: str(g.id) || uid(), text: str(g.text).slice(0, 200), done: g.done === true,
  })).filter(g => g.text);
  state.plan30 = Array.isArray(d.plan30)
    ? d.plan30.slice(0, 3).map(ph => ({
        phase: str(ph.phase).slice(0, 20),
        items: (Array.isArray(ph.items) ? ph.items : []).slice(0, 6).map(i => str(i).slice(0, 200)),
      }))
    : null;
  state.asks = (Array.isArray(d.asks) ? d.asks : []).slice(0, 30).map(x => ({
    q: str(x.q).slice(0, 300), answer: str(x.answer).slice(0, 1000),
    sources: (Array.isArray(x.sources) ? x.sources : []).slice(0, 5).map(s => str(s).slice(0, 60)),
    mock: x.mock === true, at: str(x.at),
  })).filter(x => x.q);
}

function str(v) { return typeof v === 'string' ? v : ''; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function nowIso() { return new Date().toISOString(); }
function todayLocal() { return new Date().toLocaleDateString('sv-SE'); }  // ローカル時刻のYYYY-MM-DD（toISOStringはUTCで日付がズレる）

// ===== XSS対策・ミニMarkdown描画 =====

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// escape済みテキストに対して最小限のMarkdown（見出し・太字・箇条書き・[[リンク]]）を適用
function renderMarkdown(md) {
  const lines = escapeHtml(md).split('\n');
  const out = [];
  let inList = false;
  for (const line of lines) {
    let l = line;
    if (/^##\s+/.test(l)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${inline(l.replace(/^##\s+/, ''))}</h3>`);
    } else if (/^[-・]\s+/.test(l)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(l.replace(/^[-・]\s+/, ''))}</li>`);
    } else if (l.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<div class="para-gap"></div>');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${inline(l)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');

  function inline(t) {
    return t
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[\[([^\]|]{1,60})\]\]/g, (_, name) => `<a href="#" class="wiki-link" data-page="${name}">${name}</a>`);
  }
}

// ===== 機密らしき文字列の伏せ字（送信前・端末内） =====

function maskSensitive(text) {
  return String(text)
    .replace(/((?:パスワード|パスﾜｰﾄﾞ|password|passwd|pass|pw|secret|api[_\s-]?key|token|暗証番号)[\s]*[:：=＝]?[\s]*)([^\s、。,]{4,})/gi, '$1●●●●')
    .replace(/((?:口座|振込先|account)[^\d]{0,10})(\d[\d-]{5,})/gi, '$1●●●●')
    .replace(/\b\d{13,16}\b/g, '●●●●');
}

// ===== API =====

async function api(payload) {
  const res = await fetch('api/interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, jobType: state.meta.jobType }),
  });
  if (res.status === 429) throw new Error('混み合っています。1分ほど待ってからもう一度どうぞ');
  if (!res.ok) throw new Error('通信に失敗しました');
  return res.json();
}

function withConsent(fn) {
  if (state.meta.consented) { fn(); return; }
  show('#modal-consent');
  $('#btn-consent-ok').onclick = () => {
    state.meta.consented = true;
    save();
    hide('#modal-consent');
    fn();
  };
  $('#btn-consent-cancel').onclick = () => hide('#modal-consent');
}

function mockNotice(data) {
  if (data && data.mock) toast('🔌 いまはお試しモード（AI未接続）。接続後に本物の生成になります');
}

// ===== DOMヘルパー =====

const $ = sel => document.querySelector(sel);
function show(sel) { $(sel).classList.remove('hidden'); }
function hide(sel) { $(sel).classList.add('hidden'); }

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function setBusy(btn, on, labelBusy) {
  busy = on;
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = labelBusy || '処理中…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

// ===== 画面: セットアップ =====

function initSetup() {
  $('#btn-setup-done').addEventListener('click', () => {
    state.meta.jobType = $('#setup-jobtype').value;
    state.meta.deadline = $('#setup-deadline').value || '';
    state.meta.createdAt = nowIso();
    save();
    hide('#screen-setup');
    show('#screen-main');
    renderAll();
  });
}

// ===== タブ =====

function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  ['sources', 'interview', 'wiki', 'ask', 'export'].forEach(t => {
    $(`#tab-${t}`).classList.toggle('hidden', t !== name);
  });
  if (name === 'wiki') backToList();
  if (name === 'ask') renderAsks();
  if (name === 'export') renderExportTab();
}

// ===== 資料タブ =====

function initSources() {
  const textEl = $('#source-text');
  textEl.addEventListener('input', () => {
    $('#source-len').textContent = `${textEl.value.length}字`;
  });
  $('#btn-add-source').addEventListener('click', () => {
    const title = $('#source-title').value.trim() || `資料${state.sources.length + 1}`;
    const text = textEl.value.trim();
    if (!text) { toast('資料の本文を貼り付けてください'); return; }
    state.sources.push({ id: uid(), title: title.slice(0, 60), text: text.slice(0, 20000), addedAt: nowIso() });
    $('#source-title').value = '';
    textEl.value = '';
    $('#source-len').textContent = '0字';
    save();
    renderSources();
    toast('資料を追加しました');
  });
  $('#btn-draft').addEventListener('click', () => withConsent(runDraft));

  const zone = $('#drop-zone');
  $('#input-files').addEventListener('change', e => {
    handleFiles(e.target.files);
    e.target.value = '';
  });
  ['dragover', 'dragenter'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault();
    zone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault();
    zone.classList.remove('dragging');
  }));
  zone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
}

// ===== ファイル読み取り（PDF/Word/PowerPoint。すべて端末内で完結） =====

const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const MAX_FILE_MB = 20;

async function handleFiles(fileList) {
  const files = [...fileList].slice(0, 6);
  for (const file of files) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast(`⚠️ ${file.name}: ${MAX_FILE_MB}MBを超えるファイルは読み込めません`);
      continue;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    toast(`📄 ${file.name} を読み取っています…`);
    try {
      let text = '';
      if (ext === 'pdf') text = await extractPdf(file);
      else if (ext === 'docx') text = await extractDocx(file);
      else if (ext === 'pptx') text = await extractPptx(file);
      else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') text = await extractExcel(file);
      else if (ext === 'txt' || ext === 'md') text = await file.text();
      else { toast(`⚠️ ${file.name}: 対応形式はPDF / .docx / .pptx / .xlsx / テキストです（古い.doc/.pptは新形式で保存し直してください）`); continue; }

      text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (text.length < 50) {
        toast(`⚠️ ${file.name}: 文字をほとんど取り出せませんでした（スキャンPDF・画像中心の資料かもしれません）`);
        continue;
      }
      const title = file.name.replace(/\.[^.]+$/, '').slice(0, 60);
      state.sources.push({ id: uid(), title, text: text.slice(0, 20000), addedAt: nowIso() });
      save();
      renderSources();
      toast(`✅ ${title} を資料に追加しました（${Math.min(text.length, 20000)}字${text.length > 20000 ? '・上限で切り詰め' : ''}）`);
    } catch (e) {
      toast(`⚠️ ${file.name}: 読み取りに失敗しました（${e.message}）`);
    }
  }
}

async function extractPdf(file) {
  if (!window.pdfjsLib) throw new Error('PDF読み取りライブラリが未読込。通信環境を確認して再読み込みしてください');
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  const doc = await pdfjsLib.getDocument({
    data: await file.arrayBuffer(),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',  // 日本語等のCJKフォント解読に必須
    cMapPacked: true,
  }).promise;
  const maxPages = Math.min(doc.numPages, 50);
  const out = [];
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out.push(tc.items.map(it => it.str).join(' '));
  }
  if (doc.numPages > maxPages) out.push(`（${doc.numPages}ページ中、先頭${maxPages}ページのみ読み取り）`);
  return out.join('\n');
}

function decodeXmlEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function xmlTexts(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  const parts = [];
  let m;
  while ((m = re.exec(xml))) parts.push(decodeXmlEntities(m[1]));
  return parts;
}

async function extractExcel(file) {
  if (!window.XLSX) throw new Error('Excel読み取りライブラリが未読込。通信環境を確認して再読み込みしてください');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const out = [];
  for (const name of wb.SheetNames.slice(0, 10)) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
    if (csv.trim()) out.push(wb.SheetNames.length > 1 ? `--- シート: ${name} ---\n${csv.trim()}` : csv.trim());
  }
  if (wb.SheetNames.length > 10) out.push(`（${wb.SheetNames.length}シート中、先頭10シートのみ読み取り）`);
  return out.join('\n\n');
}

async function extractDocx(file) {
  if (!window.JSZip) throw new Error('読み取りライブラリが未読込。通信環境を確認して再読み込みしてください');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('Word文書の中身が見つかりません');
  const xml = await doc.async('string');
  return xml.split('</w:p>').map(p => xmlTexts(p, 'w:t').join('')).filter(t => t.trim()).join('\n');
}

async function extractPptx(file) {
  if (!window.JSZip) throw new Error('読み取りライブラリが未読込。通信環境を確認して再読み込みしてください');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNum = name => Number((name.match(/slide(\d+)\.xml$/) || [])[1] || 0);
  const slides = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNum(a) - slideNum(b));
  if (!slides.length) throw new Error('スライドが見つかりません');
  const out = [];
  for (const name of slides) {
    const xml = await zip.file(name).async('string');
    const t = xmlTexts(xml, 'a:t').join('\n');
    if (t.trim()) out.push(`--- スライド${slideNum(name)} ---\n${t}`);
  }
  return out.join('\n');
}

function renderSources() {
  const ul = $('#source-list');
  ul.textContent = '';
  state.sources.forEach(s => {
    const li = document.createElement('li');
    li.className = 'source-item';
    const info = document.createElement('div');
    info.className = 'source-info';
    const t = document.createElement('strong');
    t.textContent = s.title;
    const meta = document.createElement('span');
    meta.textContent = `${s.text.length}字`;
    info.append(t, meta);
    const del = document.createElement('button');
    del.className = 'btn-danger-text';
    del.textContent = '削除';
    del.addEventListener('click', () => {
      state.sources = state.sources.filter(x => x.id !== s.id);
      save(); renderSources();
    });
    li.append(info, del);
    ul.appendChild(li);
  });
  $('#btn-draft').disabled = state.sources.length === 0;
}

async function runDraft() {
  if (busy) return;
  const btn = $('#btn-draft');
  setBusy(btn, true, '🪄 AIが資料を読んでいます…');
  try {
    const sources = state.sources.slice(0, 6).map(s => ({ title: s.title, text: maskSensitive(s.text).slice(0, 6000) }));
    const data = await api({ mode: 'draft', sources });
    mockNotice(data);
    let added = 0;
    (data.pages || []).forEach(p => {
      upsertPage(p.title, p.body, { refs: p.refs || [], origin: 'draft' });
      added++;
    });
    (data.gaps || []).forEach(addGap);
    save();
    renderAll();
    switchTab('wiki');
    toast(`下書きWikiを${added}ページ作りました。次は🎙️取材で穴を埋めましょう`);
  } catch (e) {
    toast(`⚠️ ${e.message}`);
  } finally {
    setBusy(btn, false);
  }
}

// ===== 取材タブ =====

function initInterview() {
  $('#btn-start-interview').addEventListener('click', () => withConsent(nextQuestion));
  $('#btn-skip-q').addEventListener('click', () => {
    state.queue.shift();
    save();
    withConsent(nextQuestion);
  });
  $('#btn-send-answer').addEventListener('click', () => withConsent(sendAnswer));
  initVoice();
}

// ===== 音声入力（Web Speech API。非対応ブラウザではボタンを隠す） =====

function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('#btn-voice');
  if (!SR) { btn.classList.add('hidden'); return; }
  const rec = new SR();
  rec.lang = 'ja-JP';
  rec.interimResults = true;
  rec.continuous = true;
  let listening = false;
  let baseText = '';
  const ta = $('#answer-text');
  rec.onresult = e => {
    let text = '';
    for (const r of e.results) text += r[0].transcript;
    ta.value = (baseText + text).slice(0, 1500);
  };
  rec.onerror = () => { try { rec.stop(); } catch (_) {} };
  rec.onend = () => {
    listening = false;
    btn.classList.remove('listening');
    btn.textContent = '🎤 話して答える';
  };
  btn.addEventListener('click', () => {
    if (listening) { rec.stop(); return; }
    baseText = ta.value ? ta.value.trim() + ' ' : '';
    try {
      rec.start();
      listening = true;
      btn.classList.add('listening');
      btn.textContent = '⏹ 聞き取り中…（押して終了）';
    } catch (_) {}
  });
}

// ===== 今日のノルマ（1日3問） =====

const DAILY_GOAL = 3;

function answeredToday() {
  const today = new Date().toDateString();
  return state.history.filter(h => h.at && new Date(h.at).toDateString() === today).length;
}

function renderDailyGoal() {
  const el = $('#daily-goal');
  const n = answeredToday();
  let text = `きょうの取材: ${Math.min(n, DAILY_GOAL)}/${DAILY_GOAL}問`;
  if (n >= DAILY_GOAL) text += ' — きょうの分はおしまい🎉（続けてもOK）';
  else if (state.meta.deadline) {
    const days = Math.max(0, Math.ceil((new Date(state.meta.deadline + 'T23:59:59') - new Date()) / 86400000));
    text += `（1日3問×残り${days}日 ≒ あと${days * DAILY_GOAL}問ぶん聞けます）`;
  } else {
    text += '（1問30秒。喋るだけでOK）';
  }
  el.textContent = text;
}

async function nextQuestion() {
  if (busy) return;
  if (!state.queue.length) {
    const btn = $('#btn-start-interview');
    setBusy(btn, true, '🎙️ 質問を考えています…');
    try {
      const data = await api({
        mode: 'question',
        pageSummaries: pageSummaries(),
        askedQs: state.history.slice(-10).map(h => h.q),
      });
      mockNotice(data);
      state.queue = (data.questions || []).slice(0, 3);
      save();
    } catch (e) {
      toast(`⚠️ ${e.message}`);
      setBusy(btn, false);
      return;
    }
    setBusy(btn, false);
  }
  renderInterview();
}

async function sendAnswer() {
  if (busy) return;
  const current = state.queue[0];
  const a = $('#answer-text').value.trim();
  if (!current) return;
  if (!a) { toast('回答を書いてください（スキップも可）'); return; }
  const btn = $('#btn-send-answer');
  setBusy(btn, true, '✍️ Wikiに整えています…');
  try {
    const data = await api({
      mode: 'integrate',
      q: current.q,
      a: maskSensitive(a).slice(0, 1500),
      pageTitles: state.pages.map(p => p.title),
    });
    mockNotice(data);
    const title = data.pageTitle || current.target || '取材メモ';
    appendToPage(title, data.addition || a, current.q);
    (data.gaps || []).forEach(addGap);
    state.history.push({ q: current.q, a, pageTitle: title, at: nowIso() });
    state.queue.shift();
    $('#answer-text').value = '';
    save();
    renderAll();
    toast(`「${title}」に追記しました`);
    if (!state.queue.length) nextQuestion();
  } catch (e) {
    toast(`⚠️ ${e.message}`);
  } finally {
    setBusy(btn, false);
  }
}

function renderInterview() {
  renderDailyGoal();
  const current = state.queue[0];
  if (current) {
    hide('#interview-empty');
    show('#interview-card');
    $('#q-text').textContent = current.q;
    $('#q-reason').textContent = current.reason ? `狙い: ${current.reason}` : '';
    $('#q-target').textContent = current.target ? `→ ${current.target}` : '';
  } else {
    show('#interview-empty');
    hide('#interview-card');
  }
  const log = $('#interview-log');
  log.textContent = '';
  state.history.slice().reverse().slice(0, 20).forEach(h => {
    const div = document.createElement('div');
    div.className = 'log-item';
    const q = document.createElement('p');
    q.className = 'log-q';
    q.textContent = `Q. ${h.q}`;
    const a = document.createElement('p');
    a.className = 'log-a';
    a.textContent = `→ 「${h.pageTitle}」に追記済み`;
    div.append(q, a);
    log.appendChild(div);
  });
}

// ===== Wikiタブ =====

function pageSummaries() {
  return state.pages.slice(0, 20).map(p => ({
    title: p.title,
    outline: p.body.replace(/\n+/g, ' ').slice(0, 250),
  }));
}

function findPageByTitle(title) {
  const norm = String(title).trim();
  return state.pages.find(p => p.title === norm);
}

function upsertPage(title, body, opts = {}) {
  const existing = findPageByTitle(title);
  if (existing) {
    existing.body = existing.body ? existing.body + '\n\n' + body : body;
    (opts.refs || []).forEach(r => { if (!existing.refs.includes(r)) existing.refs.push(r); });
    existing.updatedAt = nowIso();
    return existing;
  }
  const page = {
    id: uid(),
    title: String(title).trim().slice(0, 60) || '無題ページ',
    body: body || '',
    refs: opts.refs || [],
    origin: opts.origin || 'manual',
    checked: false,
    updatedAt: nowIso(),
  };
  state.pages.push(page);
  return page;
}

function appendToPage(title, addition, question) {
  const page = findPageByTitle(title) || upsertPage(title, '', { origin: 'interview' });
  const block = `## 取材より: ${question.slice(0, 60)}\n${addition}`;
  page.body = page.body ? page.body + '\n\n' + block : block;
  page.updatedAt = nowIso();
}

function initWiki() {
  $('#btn-new-page').addEventListener('click', () => {
    const title = prompt('新しいページ名');
    if (!title || !title.trim()) return;
    if (findPageByTitle(title)) { toast('同名ページがあります'); return; }
    const page = upsertPage(title.trim(), '', { origin: 'manual' });
    save();
    openPage(page.id, true);
  });
  $('#btn-back-list').addEventListener('click', backToList);
  $('#btn-check-page').addEventListener('click', () => {
    const page = state.pages.find(p => p.id === currentPageId);
    if (!page) return;
    page.checked = !page.checked;
    save();
    renderCheckButton(page);
    toast(page.checked ? '✔ 確認済みにしました' : '確認済みを外しました');
  });
  $('#btn-edit-page').addEventListener('click', () => {
    const page = state.pages.find(p => p.id === currentPageId);
    if (!page) return;
    $('#page-edit-text').value = page.body;
    show('#page-editor');
    hide('#page-body');
  });
  $('#btn-save-page').addEventListener('click', () => {
    const page = state.pages.find(p => p.id === currentPageId);
    if (!page) return;
    page.body = $('#page-edit-text').value.slice(0, 20000);
    page.updatedAt = nowIso();
    save();
    openPage(page.id);
    toast('保存しました');
  });
  $('#btn-delete-page').addEventListener('click', () => {
    const page = state.pages.find(p => p.id === currentPageId);
    if (!page) return;
    if (!confirm(`「${page.title}」を削除しますか？`)) return;
    state.pages = state.pages.filter(p => p.id !== currentPageId);
    save();
    backToList();
    renderAll();
  });
  // [[リンク]]クリック（存在しないページはその場で作る）
  $('#page-body').addEventListener('click', e => {
    const a = e.target.closest('.wiki-link');
    if (!a) return;
    e.preventDefault();
    const name = a.dataset.page;
    const page = findPageByTitle(name) || upsertPage(name, '', { origin: 'manual' });
    save();
    openPage(page.id);
  });
}

function renderPageList() {
  const ul = $('#page-list');
  ul.textContent = '';
  const originLabel = { draft: '📥 資料から', interview: '🎙️ 取材から', manual: '✍️ 手動' };
  state.pages.forEach(p => {
    const li = document.createElement('li');
    li.className = 'page-item';
    const t = document.createElement('strong');
    t.textContent = `${p.checked ? '✅ ' : ''}${p.title}`;
    const meta = document.createElement('span');
    meta.className = 'page-meta';
    meta.textContent = `${originLabel[p.origin] || ''} · ${p.body.length}字`;
    li.append(t, meta);
    li.addEventListener('click', () => openPage(p.id));
    ul.appendChild(li);
  });
  $('#page-count').textContent = state.pages.length ? ` ${state.pages.length}` : '';
  const checkedCount = state.pages.filter(p => p.checked).length;
  $('#check-progress').textContent = state.pages.length ? `確認済み ${checkedCount}/${state.pages.length}` : '';
}

function openPage(id, edit = false) {
  const page = state.pages.find(p => p.id === id);
  if (!page) return;
  switchTab('wiki');  // 先にタブを切り替える（switchTab→backToListがcurrentPageIdを消すため、セットはこの後）
  currentPageId = id;
  hide('#wiki-list-view');
  show('#wiki-page-view');
  $('#page-title').textContent = page.title;
  renderCheckButton(page);
  const refs = $('#page-refs');
  refs.textContent = '';
  page.refs.forEach(r => {
    const chip = document.createElement('span');
    chip.className = 'ref-chip';
    chip.textContent = `出典: ${r}`;
    refs.appendChild(chip);
  });
  $('#page-body').innerHTML = page.body
    ? renderMarkdown(page.body)
    : '<p class="empty-note">まだ本文がありません。「編集」で書くか、🎙️取材で埋めましょう。</p>';
  if (edit) {
    $('#page-edit-text').value = page.body;
    show('#page-editor'); hide('#page-body');
  } else {
    hide('#page-editor'); show('#page-body');
  }
}

function backToList() {
  currentPageId = null;
  show('#wiki-list-view');
  hide('#wiki-page-view');
  renderPageList();
}

function renderCheckButton(page) {
  const btn = $('#btn-check-page');
  btn.textContent = page.checked ? '✅ 確認済み' : '✔ 確認済みにする';
  btn.classList.toggle('is-checked', page.checked);
}

// ===== 質問タブ（後任モード） =====

function initAsk() {
  $('#btn-ask').addEventListener('click', () => withConsent(runAsk));
}

async function runAsk() {
  if (busy) return;
  const q = $('#ask-text').value.trim();
  if (!q) { toast('質問を書いてください'); return; }
  if (!state.pages.length) { toast('まだWikiページがありません（資料 or 取材から作れます）'); return; }
  const btn = $('#btn-ask');
  setBusy(btn, true, '📖 Wikiを読んでいます…');
  try {
    const data = await api({
      mode: 'ask',
      question: q,
      pages: state.pages.slice(0, 12).map(p => ({ title: p.title, body: maskSensitive(p.body).slice(0, 1200) })),
    });
    mockNotice(data);
    state.asks.unshift({
      q,
      answer: data.answer || '',
      sources: Array.isArray(data.sources) ? data.sources.slice(0, 5) : [],
      mock: data.mock === true,
      at: nowIso(),
    });
    state.asks = state.asks.slice(0, 30);
    $('#ask-text').value = '';
    save();
    renderAsks();
  } catch (e) {
    toast(`⚠️ ${e.message}`);
  } finally {
    setBusy(btn, false);
  }
}

function renderAsks() {
  const log = $('#ask-log');
  log.textContent = '';
  state.asks.forEach(x => {
    const card = document.createElement('div');
    card.className = 'ask-item';
    const q = document.createElement('p');
    q.className = 'ask-q';
    q.textContent = `Q. ${x.q}`;
    const a = document.createElement('p');
    a.className = 'ask-a';
    a.textContent = x.answer;
    card.append(q, a);
    if (x.sources.length) {
      const srcRow = document.createElement('div');
      srcRow.className = 'ask-sources';
      x.sources.forEach(title => {
        const chip = document.createElement('button');
        chip.className = 'ref-chip ref-chip-link';
        chip.textContent = `📄 ${title}`;
        chip.addEventListener('click', () => {
          const page = findPageByTitle(title);
          if (page) openPage(page.id);
        });
        srcRow.appendChild(chip);
      });
      card.appendChild(srcRow);
    }
    log.appendChild(card);
  });
}

// ===== 抜け漏れ =====

function addGap(text) {
  const t = String(text).trim().slice(0, 200);
  if (!t) return;
  if (state.gaps.some(g => g.text === t)) return;
  state.gaps.push({ id: uid(), text: t, done: false });
}

function renderGaps() {
  const ul = $('#gap-list');
  ul.textContent = '';
  const open = state.gaps.filter(g => !g.done);
  if (!open.length) {
    const li = document.createElement('li');
    li.className = 'empty-note';
    li.textContent = state.gaps.length ? '🎉 抜け漏れはすべて解決済みです' : 'まだ検出されていません（資料の下書き生成・取材で自動的に見つかります）';
    ul.appendChild(li);
    return;
  }
  open.forEach(g => {
    const li = document.createElement('li');
    li.className = 'gap-item';
    const p = document.createElement('p');
    p.textContent = g.text;
    const actions = document.createElement('div');
    actions.className = 'gap-actions';
    const ask = document.createElement('button');
    ask.className = 'btn-secondary';
    ask.textContent = '🎙️ 取材で聞く';
    ask.addEventListener('click', () => {
      state.queue.unshift({ q: g.text.endsWith('？') || g.text.endsWith('?') ? g.text : `${g.text} — 詳しく教えてください`, target: '', reason: '抜け漏れの解消' });
      g.done = true;
      save();
      switchTab('interview');
      renderInterview();
      renderGaps();
    });
    const done = document.createElement('button');
    done.className = 'btn-text';
    done.textContent = '解決済み';
    done.addEventListener('click', () => { g.done = true; save(); renderGaps(); });
    actions.append(ask, done);
    li.append(p, actions);
    ul.appendChild(li);
  });
}

// ===== 30日プラン =====

function initPlan30() {
  $('#btn-plan30').addEventListener('click', () => withConsent(runPlan30));
}

async function runPlan30() {
  if (busy) return;
  if (!state.pages.length) { toast('先にWikiページを作ってください（資料 or 取材から）'); return; }
  const btn = $('#btn-plan30');
  setBusy(btn, true, '🗓️ プランを組んでいます…');
  try {
    const data = await api({ mode: 'plan30', pageSummaries: pageSummaries(), deadline: state.meta.deadline });
    mockNotice(data);
    if (Array.isArray(data.plan) && data.plan.length) {
      state.plan30 = data.plan;
      save();
      renderPlan30();
      toast('最初の30日プランができました');
    } else {
      toast('⚠️ プランを生成できませんでした');
    }
  } catch (e) {
    toast(`⚠️ ${e.message}`);
  } finally {
    setBusy(btn, false);
  }
}

function renderPlan30() {
  const box = $('#plan30-box');
  box.textContent = '';
  if (!state.plan30) {
    const btn = document.createElement('button');
    btn.id = 'btn-plan30';
    btn.className = 'btn-secondary';
    btn.textContent = 'Wikiからプランを生成';
    btn.addEventListener('click', () => withConsent(runPlan30));
    box.appendChild(btn);
    return;
  }
  state.plan30.forEach(ph => {
    const h = document.createElement('h4');
    h.textContent = ph.phase;
    box.appendChild(h);
    const ul = document.createElement('ul');
    ph.items.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = renderMarkdown(item).replace(/^<p>|<\/p>$/g, '');
      ul.appendChild(li);
    });
    box.appendChild(ul);
  });
  const re = document.createElement('button');
  re.className = 'btn-text';
  re.textContent = '↻ 作り直す';
  re.addEventListener('click', () => withConsent(runPlan30));
  box.appendChild(re);
}

// ===== 書き出し =====

function renderExportTab() {
  renderCompletion();
  renderGaps();
  renderPlan30();
}

// ===== 完了率・完了証明 =====

function completionStats() {
  const pages = state.pages.length;
  const checked = state.pages.filter(p => p.checked).length;
  const gapsTotal = state.gaps.length;
  const gapsDone = state.gaps.filter(g => g.done).length;
  const pageScore = pages ? checked / pages : 0;
  const gapScore = gapsTotal ? gapsDone / gapsTotal : 1;
  const planScore = state.plan30 ? 1 : 0;
  const rate = pages ? Math.round((pageScore * 0.5 + gapScore * 0.3 + planScore * 0.2) * 100) : 0;
  return { pages, checked, gapsTotal, gapsDone, answers: state.history.length, rate };
}

function renderCompletion() {
  const s = completionStats();
  $('#meter-fill').style.width = `${s.rate}%`;
  $('#completion-label').textContent = s.pages
    ? `${s.rate}%（確認済み ${s.checked}/${s.pages}ページ・取材 ${s.answers}問・抜け漏れ解消 ${s.gapsDone}/${s.gapsTotal}件）`
    : 'まだページがありません。資料か取材から始めましょう';
}

function drawCertificate() {
  const s = completionStats();
  const W = 1080, H = 1400;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');

  x.fillStyle = '#faf8f4';
  x.fillRect(0, 0, W, H);
  x.strokeStyle = '#22304d'; x.lineWidth = 14; x.strokeRect(46, 46, W - 92, H - 92);
  x.strokeStyle = '#c47b2c'; x.lineWidth = 3; x.strokeRect(72, 72, W - 144, H - 144);

  x.textAlign = 'center';
  x.fillStyle = '#22304d';
  x.font = 'bold 76px "Hiragino Mincho ProN", "Yu Mincho", serif';
  x.fillText('引き継ぎ完了証明', W / 2, 230);
  x.fillStyle = '#8a8272';
  x.font = '30px -apple-system, sans-serif';
  x.fillText(new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) + ' 現在', W / 2, 300);

  x.fillStyle = '#c47b2c';
  x.font = 'bold 190px -apple-system, sans-serif';
  x.fillText(`${s.rate}%`, W / 2, 580);
  x.fillStyle = '#22304d';
  x.font = 'bold 38px -apple-system, sans-serif';
  x.fillText('引き継ぎ完了率', W / 2, 650);

  const lines = [
    `業務ページ ${s.pages}ページ（確認済み ${s.checked}）`,
    `取材に答えた数 ${s.answers}問`,
    `抜け漏れの解消 ${s.gapsDone}/${s.gapsTotal}件`,
    state.plan30 ? '後任の最初の30日プラン 作成済み' : '後任の最初の30日プラン 未作成',
  ];
  if (state.meta.deadline) lines.push(`最終出社日 ${state.meta.deadline}`);
  x.font = '36px -apple-system, sans-serif';
  lines.forEach((l, i) => x.fillText(l, W / 2, 790 + i * 80));

  x.fillStyle = '#8a8272';
  x.font = '26px -apple-system, sans-serif';
  x.fillText('後任へ: 引き継ぎWiki（HTML）とセットでどうぞ', W / 2, H - 170);
  x.fillText('引き継ぎ職人で作成', W / 2, H - 120);

  c.toBlob(blob => {
    if (!blob) { toast('⚠️ 画像の生成に失敗しました'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `引き継ぎ完了証明_${todayLocal()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('📜 完了証明を書き出しました');
  }, 'image/png');
}

function slugify(title, i) {
  return `page-${i}-${encodeURIComponent(title).replace(/%/g, '')}`.slice(0, 60);
}

function buildExportHtml() {
  const titleToSlug = new Map();
  state.pages.forEach((p, i) => titleToSlug.set(p.title, slugify(p.title, i)));

  const renderBody = body => renderMarkdown(body).replace(
    /<a href="#" class="wiki-link" data-page="([^"]*)">([^<]*)<\/a>/g,
    (_, name, label) => titleToSlug.has(name)
      ? `<a href="#${titleToSlug.get(name)}">${label}</a>`
      : `<span class="deadlink">${label}</span>`
  );

  const nav = state.pages.map((p, i) => `<li><a href="#${slugify(p.title, i)}">${p.checked ? '✅ ' : ''}${escapeHtml(p.title)}</a></li>`).join('');
  const sections = state.pages.map((p, i) =>
    `<section id="${slugify(p.title, i)}"><h2>${escapeHtml(p.title)}</h2>` +
    (p.refs.length ? `<p class="refs">出典: ${p.refs.map(escapeHtml).join(' / ')}</p>` : '') +
    `${renderBody(p.body)}</section>`
  ).join('\n');

  const plan = state.plan30
    ? `<section id="plan30"><h2>🗓️ 最初の30日プラン</h2>` +
      state.plan30.map(ph =>
        `<h3>${escapeHtml(ph.phase)}</h3><ul>` +
        ph.items.map(item => `<li><label><input type="checkbox"> ${renderBody(item).replace(/^<p>|<\/p>$/g, '')}</label></li>`).join('') +
        `</ul>`).join('') +
      `</section>`
    : '';

  const date = new Date().toLocaleDateString('ja-JP');
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>引き継ぎWiki（${date}版）</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;color:#1e2430;background:#faf8f4;line-height:1.75}
.layout{display:flex;flex-wrap:wrap;max-width:1080px;margin:0 auto}
nav{flex:1 1 220px;padding:24px;border-right:1px solid #e5e0d5;position:sticky;top:0;align-self:flex-start;max-height:100vh;overflow-y:auto}
main{flex:3 1 480px;padding:24px;min-width:0}
nav ul{list-style:none;padding:0;margin:0}nav li{margin:6px 0}
a{color:#22508d}h1{font-size:22px}h2{border-bottom:2px solid #22304d;padding-bottom:6px;margin-top:40px}
section{margin-bottom:24px}.refs{font-size:12px;color:#8a8272;background:#f1ede3;display:inline-block;padding:2px 10px;border-radius:99px}
.deadlink{color:#999;border-bottom:1px dashed #bbb}.para-gap{height:8px}
ul{padding-left:22px}footer{padding:24px;color:#8a8272;font-size:12px;text-align:center}
@media (max-width:720px){nav{position:static;max-height:none;border-right:none;border-bottom:1px solid #e5e0d5}}
</style></head><body>
<div class="layout">
<nav><h1>📔 引き継ぎWiki</h1><p>${date}版</p><ul>${nav}${state.plan30 ? '<li><a href="#plan30">🗓️ 最初の30日プラン</a></li>' : ''}</ul></nav>
<main>${plan}${sections}</main>
</div>
<footer>引き継ぎ職人で作成 — わからないことがあれば、まず関連ページのリンクを辿ってみてください</footer>
</body></html>`;
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function initExport() {
  $('#btn-certificate').addEventListener('click', () => {
    if (!state.pages.length) { toast('まだページがありません'); return; }
    drawCertificate();
  });
  $('#btn-export-html').addEventListener('click', () => {
    if (!state.pages.length) { toast('まだページがありません'); return; }
    download(`引き継ぎWiki_${todayLocal()}.html`, buildExportHtml(), 'text/html');
    toast('HTMLを書き出しました。そのまま後任に渡せます');
  });
}

// ===== 設定 =====

function initSettings() {
  $('#btn-settings').addEventListener('click', () => {
    $('#settings-jobtype').value = state.meta.jobType;
    $('#settings-deadline').value = state.meta.deadline;
    show('#modal-settings');
  });
  $('#btn-close-settings').addEventListener('click', () => {
    state.meta.jobType = $('#settings-jobtype').value;
    state.meta.deadline = $('#settings-deadline').value || '';
    save();
    hide('#modal-settings');
    renderDeadline();
  });
  $('#btn-export-json').addEventListener('click', () => {
    download(`hikitsugi_backup_${todayLocal()}.json`, JSON.stringify(state, null, 2), 'application/json');
    toast('控えを書き出しました');
  });
  $('#input-import-json').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyImported(JSON.parse(reader.result));
        save();
        renderAll();
        hide('#modal-settings');
        toast('控えから復元しました');
      } catch (_) {
        toast('⚠️ 控えファイルを読み込めませんでした');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  $('#btn-wipe').addEventListener('click', () => {
    if (!confirm('すべてのデータを消去しますか？（控えを書き出していない場合、元に戻せません）')) return;
    try { localStorage.removeItem(LS_KEY); } catch (_) {}
    location.reload();
  });
}

function renderDeadline() {
  const badge = $('#deadline-badge');
  if (!state.meta.deadline) { badge.classList.add('hidden'); return; }
  const days = Math.ceil((new Date(state.meta.deadline + 'T23:59:59') - new Date()) / 86400000);
  badge.classList.remove('hidden');
  if (days > 1) badge.textContent = `期限まで ${days}日`;
  else if (days >= 0) badge.textContent = '期限は今日/明日！';
  else badge.textContent = '期限超過';
  badge.classList.toggle('urgent', days <= 7);
}

// ===== 全体描画・起動 =====

function renderAll() {
  renderSources();
  renderInterview();
  renderPageList();
  renderAsks();
  renderDeadline();
  renderExportTab();
}

function init() {
  initSetup();
  initTabs();
  initSources();
  initInterview();
  initWiki();
  initAsk();
  initPlan30();
  initExport();
  initSettings();

  if (load()) {
    show('#screen-main');
    renderAll();
  } else {
    show('#screen-setup');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
