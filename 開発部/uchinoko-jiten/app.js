// うちの子語録辞典 — localStorageのみ(認証・DB不要)。AI語釈は /api/jiten (鍵なしモック)。

const LS_KEY = 'uchinoko_jiten_v1';
const LS_NAME = 'uchinoko_jiten_name_v1';

const GYO = [
  ['あ行', 'あいうえおぁぃぅぇぉゔ'],
  ['か行', 'かきくけこがぎぐげご'],
  ['さ行', 'さしすせそざじずぜぞ'],
  ['た行', 'たちつてとだぢづでどっ'],
  ['な行', 'なにぬねの'],
  ['は行', 'はひふへほばびぶべぼぱぴぷぺぽ'],
  ['ま行', 'まみむめも'],
  ['や行', 'やゆよゃゅょ'],
  ['ら行', 'らりるれろ'],
  ['わ行', 'わをん'],
];

function newId() {
  return 'e' + Date.now() + Math.random().toString(36).slice(2, 6);
}

// 復元・旧データ経由で任意のJSONが入りうるため、描画前に必ず型と中身を固定する
function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
  const goroku = str(raw.goroku, 40).trim();
  if (!goroku) return null;
  const photo = typeof raw.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.photo)
    ? raw.photo : null;
  return {
    id: typeof raw.id === 'string' && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : newId(),
    goroku,
    age: str(raw.age, 10),
    photo,
    yomi: str(raw.yomi, 60) || goroku,
    hinshi: str(raw.hinshi, 30),
    teigi: str(raw.teigi, 400),
    yourei: Array.isArray(raw.yourei) ? raw.yourei.filter(y => typeof y === 'string').map(y => y.slice(0, 200)).slice(0, 2) : [],
    gogen: str(raw.gogen, 400),
    createdAt: str(raw.createdAt, 30) || new Date().toISOString()
  };
}

function loadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY)) || [];
    return (Array.isArray(raw) ? raw : []).map(sanitizeEntry).filter(Boolean);
  } catch { return []; }
}

function saveEntries() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
    return true;
  } catch { return false; }
}

let entries = loadEntries();

function kataToHira(s) {
  return s.replace(/[ァ-ン]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
function gyoOf(yomi) {
  const head = kataToHira(yomi || '').charAt(0);
  for (const [name, chars] of GYO) if (chars.includes(head)) return name;
  return 'その他';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
function dictName() {
  const name = localStorage.getItem(LS_NAME) || '';
  return name ? `${name}語辞典` : 'うちの子語録辞典';
}

const entryList = document.getElementById('entryList');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const gyoIndex = document.getElementById('gyoIndex');
let filterText = '';

function matches(e, q) {
  const hay = kataToHira([e.goroku, e.yomi, e.teigi, e.gogen, ...(e.yourei || [])].join(' '));
  return hay.includes(kataToHira(q));
}

function render() {
  emptyState.hidden = entries.length > 0;
  const groups = new Map();
  const shown = filterText ? entries.filter(e => matches(e, filterText)) : entries;
  const sorted = [...shown].sort((a, b) =>
    kataToHira(a.yomi || '').localeCompare(kataToHira(b.yomi || ''), 'ja'));
  for (const e of sorted) {
    const g = gyoOf(e.yomi);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(e);
  }
  const order = [...GYO.map(g => g[0]), 'その他'];
  entryList.innerHTML = order.filter(g => groups.has(g)).map(g => `
    <div class="gyo-group" data-gyo="${esc(g)}">
      <h2 class="gyo-head"><span>${esc(g)}</span></h2>
      ${groups.get(g).map(entryHTML).join('')}
    </div>`).join('');
  if (filterText && sorted.length === 0 && entries.length > 0) {
    entryList.innerHTML = `<p class="no-hit">「${esc(filterText)}」は本辞典に未収録です。</p>`;
  }
  document.querySelectorAll('.entry').forEach(el => {
    el.querySelector('.card-btn').addEventListener('click', () => exportCard(el.dataset.id));
    el.querySelector('.del-btn').addEventListener('click', () => removeEntry(el.dataset.id));
  });
  renderGyoIndex(groups);
}

function entryHTML(e) {
  return `
  <article class="entry card" data-id="${esc(e.id)}">
    ${e.photo ? `<img class="entry-photo" src="${esc(e.photo)}" alt="${esc(e.goroku)}のころの写真">` : ''}
    <div class="entry-head">
      <span class="midashi">${esc(e.goroku)}</span>
      <span class="yomi">〖${esc(e.yomi)}〗</span>
      <span class="hinshi">${esc(e.hinshi || '')}</span>
      ${e.age ? `<span class="age-tag">${esc(e.age)}</span>` : ''}
    </div>
    <p class="teigi">${esc(e.teigi)}</p>
    ${(e.yourei || []).map(y => `<p class="yourei">▷ ${esc(y)}</p>`).join('')}
    <p class="gogen"><span class="gogen-label">【語源考察】</span>${esc(e.gogen)}</p>
    <div class="entry-actions">
      <button class="card-btn ghost-btn" type="button">📷 カード保存</button>
      <button class="del-btn ghost-btn" type="button">削除</button>
    </div>
  </article>`;
}

function renderGyoIndex(groups) {
  gyoIndex.innerHTML = GYO.map(([name]) => {
    const has = groups.has(name);
    return `<button type="button" class="gyo-jump${has ? '' : ' off'}" data-gyo="${name}" ${has ? '' : 'disabled'}>${name.charAt(0)}</button>`;
  }).join('');
  gyoIndex.querySelectorAll('.gyo-jump:not(.off)').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = entryList.querySelector(`.gyo-group[data-gyo="${btn.dataset.gyo}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

searchInput.addEventListener('input', () => {
  filterText = searchInput.value.trim();
  render();
});

function removeEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`「${e.goroku}」を辞典から削除しますか?`)) return;
  entries = entries.filter(x => x.id !== id);
  saveEntries();
  render();
}

const photoInput = document.getElementById('photoInput');
const photoBtn = document.getElementById('photoBtn');
const photoPreview = document.getElementById('photoPreview');
const photoClear = document.getElementById('photoClear');
let currentPhoto = null;

photoBtn.addEventListener('click', () => photoInput.click());
photoClear.addEventListener('click', () => setPhoto(null));

function setPhoto(dataUrl) {
  currentPhoto = dataUrl;
  photoPreview.src = dataUrl || '';
  photoPreview.hidden = !dataUrl;
  photoClear.hidden = !dataUrl;
  photoBtn.textContent = dataUrl ? '📷 写真を変える' : '📷 写真を選ぶ';
}

photoInput.addEventListener('change', () => {
  const file = photoInput.files && photoInput.files[0];
  photoInput.value = '';
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    // 端末内保存のため縮小(最大640px・JPEG)してlocalStorage容量を守る
    const scale = Math.min(1, 640 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    setPhoto(cv.toDataURL('image/jpeg', 0.8));
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('この写真は読み込めませんでした。別の写真でお試しください。');
  };
  img.src = url;
});

const gorokuInput = document.getElementById('gorokuInput');
const imiInput = document.getElementById('imiInput');
const ageInput = document.getElementById('ageInput');
const addBtn = document.getElementById('addBtn');
const formStatus = document.getElementById('formStatus');

async function addEntry() {
  if (addBtn.disabled) return; // Enter連打での二重登録防止
  const goroku = gorokuInput.value.trim();
  if (!goroku) { formStatus.textContent = '見出し語を入れてください'; return; }
  addBtn.disabled = true;
  formStatus.textContent = '編纂委員会が語釈を執筆中…';
  try {
    const res = await fetch('/api/jiten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goroku, imi: imiInput.value.trim(), age: ageInput.value })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error((data && data.error) || '語釈をつくれませんでした。時間をおいてもう一度どうぞ');
    const entry = sanitizeEntry({ id: newId(), goroku, age: ageInput.value, photo: currentPhoto, ...{
      yomi: data.yomi, hinshi: data.hinshi, teigi: data.teigi, yourei: data.yourei, gogen: data.gogen
    } });
    entry.photo = currentPhoto; // sanitizeはdata:image形式のみ通す(canvas生成なので常に適合)
    entries.push(entry);
    if (!saveEntries()) {
      entry.photo = null;
      if (!saveEntries()) {
        entries.pop();
        render();
        formStatus.textContent = '保存容量がいっぱいで載せられませんでした。古い項目の削除か、控えの書き出し→整理をどうぞ';
        return;
      }
      alert('保存容量が残りわずかのため、この項目は写真なしで保存しました。');
    }
    filterText = '';
    searchInput.value = '';
    render();
    gorokuInput.value = ''; imiInput.value = ''; ageInput.value = '';
    setPhoto(null);
    formStatus.textContent = data.mock ? '載せました(お試し語釈。本物のAI語釈は公開版で)'
      : data.fallback ? '載せました(AIが混み合っていたため簡易語釈です)'
      : '辞典に載せました 📖';
    setTimeout(() => { formStatus.textContent = ''; }, 4000);
  } catch (err) {
    formStatus.textContent = err.message;
  } finally {
    addBtn.disabled = false;
  }
}

addBtn.addEventListener('click', addEntry);
// IME教訓: 変換確定Enterを誤検知しない
[gorokuInput, imiInput].forEach(el => el.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); addEntry(); }
}));

const settingsModal = document.getElementById('settingsModal');
const childNameInput = document.getElementById('childNameInput');
const dictTitle = document.getElementById('dictTitle');

function applyTitle() {
  dictTitle.textContent = dictName();
  document.title = dictName();
}
document.getElementById('settingsBtn').addEventListener('click', () => {
  childNameInput.value = localStorage.getItem(LS_NAME) || '';
  settingsModal.classList.add('open');
});
document.getElementById('settingsSave').addEventListener('click', () => {
  localStorage.setItem(LS_NAME, childNameInput.value.trim());
  applyTitle();
  settingsModal.classList.remove('open');
});
document.getElementById('settingsClose').addEventListener('click', () => settingsModal.classList.remove('open'));

function wrapText(ctx, text, x, y, maxW, lineH, maxLines = 12) {
  const chars = [...String(text)];
  let line = '', lines = 0;
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxW) {
      lines++;
      if (lines >= maxLines) {
        while (line && ctx.measureText(line + '…').width > maxW) line = line.slice(0, -1);
        ctx.fillText(line + '…', x, y);
        return y + lineH;
      }
      ctx.fillText(line, x, y); y += lineH; line = ch;
    } else line += ch;
  }
  if (line) { ctx.fillText(line, x, y); y += lineH; }
  return y;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function exportCard(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  await document.fonts.ready; // 明朝体の読込前に描くと書体が崩れるため
  const cv = document.getElementById('cardCanvas');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, PAD = 90;

  ctx.fillStyle = '#f7f3e8'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#b5443c'; ctx.lineWidth = 10; ctx.strokeRect(35, 35, W - 70, H - 70);
  ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 2; ctx.strokeRect(55, 55, W - 110, H - 110);

  ctx.fillStyle = '#8a7f6a'; ctx.font = '600 34px "Noto Serif JP", serif';
  ctx.textAlign = 'center';
  ctx.fillText(`—— ${dictName()} ——`, W / 2, 140);

  let photoDrawn = false;
  if (e.photo) {
    const img = await loadImage(e.photo);
    if (img) {
      // 300x360の枠に「収まるように」縮小(潰さない)
      const fit = Math.min(300 / img.width, 360 / img.height);
      const dw = Math.round(img.width * fit), dh = Math.round(img.height * fit);
      const px = W - PAD - dw, py = 200;
      ctx.save();
      ctx.translate(px + dw / 2, py + dh / 2);
      ctx.rotate(0.035);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(43,38,32,.35)'; ctx.shadowBlur = 14;
      ctx.fillRect(-dw / 2 - 12, -dh / 2 - 12, dw + 24, dh + 24);
      ctx.shadowBlur = 0;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      photoDrawn = true;
    }
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2620';
  ctx.font = '700 96px "Noto Serif JP", serif';
  let y = 300;
  y = wrapText(ctx, e.goroku, PAD, y, photoDrawn ? W - PAD * 2 - 340 : W - PAD * 2, 110, 2);
  if (photoDrawn) y = Math.max(y, 620);
  ctx.font = '600 40px "Noto Serif JP", serif';
  ctx.fillStyle = '#6b5f4d';
  ctx.fillText(`〖${e.yomi}〗 ${e.hinshi || ''}${e.age ? '　' + e.age : ''}`, PAD, y + 10);
  y += 90;

  ctx.fillStyle = '#2b2620'; ctx.font = '400 44px "Noto Serif JP", serif';
  y = wrapText(ctx, e.teigi, PAD, y, W - PAD * 2, 64, 6);
  y += 30;
  ctx.fillStyle = '#4a4238'; ctx.font = '400 40px "Noto Serif JP", serif';
  for (const yo of (e.yourei || []).slice(0, 1)) {
    y = wrapText(ctx, '▷ ' + yo, PAD, y, W - PAD * 2, 58, 3);
  }
  y += 30;
  ctx.fillStyle = '#b5443c'; ctx.font = '600 40px "Noto Serif JP", serif';
  ctx.fillText('【語源考察】', PAD, y); y += 60;
  ctx.fillStyle = '#4a4238'; ctx.font = '400 38px "Noto Serif JP", serif';
  y = wrapText(ctx, e.gogen, PAD, y, W - PAD * 2, 56, 6);

  ctx.fillStyle = '#8a7f6a'; ctx.font = '400 30px "Noto Serif JP", serif';
  ctx.textAlign = 'center';
  ctx.fillText('うちの子語録辞典', W / 2, H - 100);

  // スマホは共有シート(LINE等へ直接)、PCはダウンロード
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `${dictName()}_${e.goroku}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: dictName() }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.download = file.name;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

document.getElementById('backupExport').addEventListener('click', () => {
  const data = { app: 'uchinoko-jiten', version: 1, name: localStorage.getItem(LS_NAME) || '', entries };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `uchinoko-jiten-hikae-${new Date().toISOString().slice(0, 10)}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

document.getElementById('backupImportBtn').addEventListener('click', () =>
  document.getElementById('backupImport').click());

document.getElementById('backupImport').addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'uchinoko-jiten' || !Array.isArray(data.entries)) throw new Error();
    const clean = data.entries.map(sanitizeEntry).filter(Boolean);
    if (!confirm(`控えから ${clean.length} 語を読み込みます。今の辞典に追加しますか?`)) return;
    const ids = new Set(entries.map(e => e.id));
    for (const e of clean) if (!ids.has(e.id)) entries.push(e);
    if (typeof data.name === 'string' && data.name && !localStorage.getItem(LS_NAME)) {
      localStorage.setItem(LS_NAME, data.name.slice(0, 10));
    }
    if (!saveEntries()) { alert('容量が足りず、一部を保存できませんでした。'); }
    applyTitle(); render();
    alert('読み込みました 📖');
  } catch {
    alert('この控えファイルは読み込めませんでした。');
  }
});

applyTitle();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
