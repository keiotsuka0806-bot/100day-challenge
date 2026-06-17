'use strict';

const STORE_KEY = 'portfolio_forge_v1';

const el = {
  addForm: document.getElementById('addForm'),
  fName: document.getElementById('fName'),
  fUrl: document.getElementById('fUrl'),
  fDesc: document.getElementById('fDesc'),
  fTags: document.getElementById('fTags'),
  fDate: document.getElementById('fDate'),
  itemList: document.getElementById('itemList'),
  filterBar: document.getElementById('filterBar'),
  previewFrame: document.getElementById('previewFrame'),
  siteTitle: document.getElementById('siteTitle'),
  downloadBtn: document.getElementById('downloadBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  exportBtn: document.getElementById('exportBtn'),
};

let state = load();
let activeTag = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { title: 'My Works', items: [] };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

el.siteTitle.value = state.title || 'My Works';

// --- HTMLエスケープ（生成物に入れるユーザー入力を無害化） ---
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --- URLは http/https のみ許可（javascript: 等のスキームを弾く） ---
function safeUrl(u) {
  const s = String(u || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  return '';
}

// --- 追加 ---
el.addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = el.fName.value.trim();
  if (!name) return;
  const tags = el.fTags.value.split(',').map(t => t.trim()).filter(Boolean);
  state.items.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name,
    url: el.fUrl.value.trim(),
    desc: el.fDesc.value.trim(),
    tags,
    date: el.fDate.value || '',
  });
  el.addForm.reset();
  el.fName.focus();
  commit();
});

// --- 一覧描画（editor側はtextContentで安全に） ---
function renderList() {
  el.itemList.innerHTML = '';
  if (state.items.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-hint';
    li.textContent = '左のフォームから作品を追加してください。';
    el.itemList.appendChild(li);
    return;
  }
  state.items.forEach((it) => {
    const li = document.createElement('li');
    li.className = 'item';
    const info = document.createElement('div');
    info.className = 'info';
    const nm = document.createElement('div');
    nm.className = 'name'; nm.textContent = it.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = [it.date, (it.tags || []).join(' / '), it.url].filter(Boolean).join('　');
    info.append(nm, meta);
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '✕'; del.title = '削除';
    del.setAttribute('aria-label', it.name + ' を削除');
    del.addEventListener('click', () => {
      state.items = state.items.filter(x => x.id !== it.id);
      commit();
    });
    li.append(info, del);
    el.itemList.appendChild(li);
  });
}

// --- タグのフィルタチップ ---
function allTags() {
  const set = new Set();
  state.items.forEach(it => (it.tags || []).forEach(t => set.add(t)));
  return [...set];
}
function renderFilter() {
  el.filterBar.innerHTML = '';
  const tags = allTags();
  if (tags.length === 0) return;
  const mk = (label, tag) => {
    const b = document.createElement('button');
    b.className = 'filter-chip' + ((activeTag === tag) ? ' is-active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { activeTag = tag; renderFilter(); renderPreview(); });
    return b;
  };
  el.filterBar.appendChild(mk('すべて', null));
  tags.forEach(t => el.filterBar.appendChild(mk(t, t)));
}

// --- 生成する作品集HTML（単一ファイル・インラインCSS） ---
function buildPortfolioHTML(forDownload) {
  const title = esc(state.title || 'My Works');
  const items = [...state.items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const shown = activeTag ? items.filter(it => (it.tags || []).includes(activeTag)) : items;

  const cards = shown.map(it => {
    const url = safeUrl(it.url);
    const tagHtml = (it.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const link = url
      ? `<a class="card-link" href="${esc(url)}" target="_blank" rel="noopener">開く ↗</a>` : '';
    const titleHtml = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(it.name)}</a>`
      : esc(it.name);
    return `<article class="card">
      <div class="card-date">${esc(it.date)}</div>
      <h2 class="card-title">${titleHtml}</h2>
      <p class="card-desc">${esc(it.desc)}</p>
      <div class="card-tags">${tagHtml}</div>
      ${link}
    </article>`;
  }).join('\n');

  const count = shown.length;
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  :root { --ink:#1b1d29; --muted:#6b7088; --line:#e7e8ef; --accent:#7c5cff; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif; color:var(--ink); background:#fafaff; line-height:1.6; }
  header { text-align:center; padding:56px 20px 28px; }
  header h1 { margin:0; font-size:2rem; letter-spacing:.02em; }
  header p { color:var(--muted); margin:6px 0 0; }
  main { max-width:1040px; margin:0 auto; padding:0 20px 60px; display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:18px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:8px; transition:transform .12s, box-shadow .12s; }
  .card:hover { transform:translateY(-3px); box-shadow:0 10px 30px rgba(30,20,80,.08); }
  .card-date { font-size:.74rem; color:var(--muted); }
  .card-title { font-size:1.1rem; margin:0; }
  .card-title a { color:var(--ink); text-decoration:none; }
  .card-title a:hover { color:var(--accent); }
  .card-desc { font-size:.88rem; color:#444a60; margin:0; flex:1; }
  .card-tags { display:flex; flex-wrap:wrap; gap:5px; }
  .tag { font-size:.72rem; background:#f0eeff; color:var(--accent); border-radius:999px; padding:2px 9px; }
  .card-link { font-size:.82rem; color:var(--accent); text-decoration:none; font-weight:600; margin-top:2px; }
  footer { text-align:center; color:var(--muted); font-size:.78rem; padding:0 20px 40px; }
</style></head>
<body>
  <header><h1>${title}</h1><p>${count} projects</p></header>
  <main>${cards || '<p style="grid-column:1/-1;text-align:center;color:#888">作品がありません。</p>'}</main>
  <footer>Generated with PortfolioForge</footer>
</body></html>`;
}

function renderPreview() {
  const html = buildPortfolioHTML(false);
  el.previewFrame.srcdoc = html;
  el.downloadBtn.disabled = state.items.length === 0;
}

// --- 全体更新 ---
function commit() {
  save();
  renderList();
  renderFilter();
  renderPreview();
}

el.siteTitle.addEventListener('input', () => { state.title = el.siteTitle.value; commit(); });

// --- DL ---
el.downloadBtn.addEventListener('click', () => {
  const blob = new Blob([buildPortfolioHTML(true)], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'portfolio.html';
  a.click();
  URL.revokeObjectURL(a.href);
});

// --- JSON 書出 ---
el.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'portfolio-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

// --- JSON 取込 ---
el.importBtn.addEventListener('click', () => el.importFile.click());
el.importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const items = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(items)) throw new Error('items配列がありません');
      state.items = items.map(it => ({
        id: it.id || (Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
        name: String(it.name || '名称未設定'),
        url: String(it.url || ''),
        desc: String(it.desc || ''),
        tags: Array.isArray(it.tags) ? it.tags.map(String) : [],
        date: String(it.date || ''),
      }));
      if (!Array.isArray(data) && data.title) { state.title = data.title; el.siteTitle.value = data.title; }
      activeTag = null;
      commit();
    } catch (err) {
      alert('JSONを読み込めませんでした: ' + err.message);
    }
    el.importFile.value = '';
  };
  reader.readAsText(file);
});

commit();
