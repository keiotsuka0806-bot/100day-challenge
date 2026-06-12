// AsaBrief — 入力→/api/generate→新聞レイアウト描画→画像保存(html2canvas)

const $ = (id) => document.getElementById(id);

// 前回の入力を復元(メモはローカルにだけ保存)
$('notesInput').value = localStorage.getItem('asabrief_notes') || '';
$('planInput').value = localStorage.getItem('asabrief_plan') || '';

$('generateBtn').addEventListener('click', generate);
$('againBtn').addEventListener('click', () => {
  $('paperSection').classList.add('hidden');
  $('inputCard').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('saveBtn').addEventListener('click', saveAsImage);

async function generate() {
  const notes = $('notesInput').value.trim();
  const plan = $('planInput').value.trim();
  if (notes.length < 10) { showStatus('昨日のメモを10文字以上入力してください'); return; }

  localStorage.setItem('asabrief_notes', notes);
  localStorage.setItem('asabrief_plan', plan);

  const btn = $('generateBtn');
  btn.disabled = true;
  btn.textContent = '🖨 輪転機が回っています…(10秒ほど)';
  showStatus('');

  try {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, plan }),
    });
    const data = await r.json();
    if (!r.ok) { showStatus(data.error || 'エラーが発生しました'); return; }
    renderPaper(data);
  } catch (e) {
    showStatus('通信に失敗しました。電波の良いところでもう一度お試しください');
  } finally {
    btn.disabled = false;
    btn.textContent = '🗞 朝刊を発行する';
  }
}

function showStatus(msg) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

function renderPaper(p) {
  const now = new Date();
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()];
  $('paperDate').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日(${youbi})`;
  $('paperName').textContent = p.paperName;
  $('topHeadline').textContent = p.topHeadline;
  $('lead').textContent = p.lead;

  const wrap = $('articles');
  wrap.innerHTML = '';
  for (const a of p.articles) {
    const div = document.createElement('div');
    div.className = 'article';
    const h = document.createElement('h3');
    h.textContent = a.heading;
    const body = document.createElement('p');
    body.textContent = a.body;
    div.append(h, body);
    wrap.appendChild(div);
  }

  $('column').textContent = p.column;
  $('tomorrow').textContent = p.tomorrowHeadline || '';

  $('inputCard').classList.add('hidden');
  $('paperSection').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let html2canvasLoaded = false;
async function saveAsImage() {
  const btn = $('saveBtn');
  btn.disabled = true;
  btn.textContent = '📷 撮影中…';
  try {
    if (!html2canvasLoaded) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.onload = resolve; s.onerror = () => reject(new Error('画像ライブラリの読み込みに失敗'));
        document.head.appendChild(s);
      });
      html2canvasLoaded = true;
    }
    const canvas = await html2canvas($('paper'), { scale: 2, backgroundColor: '#f5f0e6' });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    const d = new Date();
    a.download = `asabrief_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.png`;
    a.click();
  } catch (e) {
    showStatus('画像の保存に失敗しました: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '📷 画像として保存';
  }
}
