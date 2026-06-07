'use strict';

// ── State ──
let currentImage  = null;
let currentResult = null;
let cameraStream  = null;
let radarChart    = null;

// ── DOM refs ──
const $ = id => document.getElementById(id);
const setupOverlay    = $('setupOverlay');
const apiKeyInput     = $('apiKeyInput');
const saveKeyBtn      = $('saveKeyBtn');
const keyError        = $('keyError');
const dropZone        = $('dropZone');
const dropContent     = $('dropContent');
const previewImg      = $('previewImg');
const fileInput       = $('fileInput');
const cameraBtn       = $('cameraBtn');
const selectedHint    = $('selectedHint');
const analyzeBtn      = $('analyzeBtn');
const uploadSection   = $('uploadSection');
const cameraSection   = $('cameraSection');
const cameraVideo     = $('cameraVideo');
const captureBtn      = $('captureBtn');
const captureCanvas   = $('captureCanvas');
const cancelCameraBtn = $('cancelCameraBtn');
const loadingSection  = $('loadingSection');
const errorSection    = $('errorSection');
const resultsSection  = $('resultsSection');
const historyBtn      = $('historyBtn');
const settingsBtn     = $('settingsBtn');
const historyPanel    = $('historyPanel');
const panelOverlay    = $('panelOverlay');
const closeHistoryBtn = $('closeHistoryBtn');
const historyList     = $('historyList');
const newPhotoBtn     = $('newPhotoBtn');

// ── Init ──
function init() {
  setupOverlay.classList.add('hidden');
  settingsBtn.classList.add('hidden');
  bindEvents();
  renderHistory();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ── Event binding ──
function bindEvents() {
  saveKeyBtn.addEventListener('click', saveApiKey);
  apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });

  settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = localStorage.getItem('foodscore_key') || '';
    keyError.classList.add('hidden');
    setupOverlay.classList.remove('hidden');
  });

  fileInput.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) loadFile(f);
    fileInput.value = '';
  });

  dropZone.addEventListener('click', () => { if (!currentImage) fileInput.click(); });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadFile(f);
  });

  cameraBtn.addEventListener('click', openCamera);
  captureBtn.addEventListener('click', capturePhoto);
  cancelCameraBtn.addEventListener('click', closeCamera);

  analyzeBtn.addEventListener('click', analyze);
  newPhotoBtn.addEventListener('click', resetToUpload);
  $('retryBtn').addEventListener('click', () => showSection('uploadSection'));
  $('shareBtn').addEventListener('click', () => {
    if (currentResult && currentImage) shareResult(currentResult, currentImage.dataUrl);
  });
  $('copyTagsBtn').addEventListener('click', copyHashtags);

  historyBtn.addEventListener('click', openHistory);
  closeHistoryBtn.addEventListener('click', closeHistory);
  panelOverlay.addEventListener('click', closeHistory);
}

// ── Legacy settings overlay ──
function saveApiKey() {
  setupOverlay.classList.add('hidden');
  keyError.classList.add('hidden');
}

// ── Image load ──
function loadFile(file) {
  const mediaType = file.type.includes('png') ? 'image/png'
    : file.type.includes('webp') ? 'image/webp'
    : file.type.includes('gif')  ? 'image/gif'
    : 'image/jpeg';
  const reader = new FileReader();
  reader.onload = e => setImage(e.target.result, mediaType);
  reader.readAsDataURL(file);
}

function setImage(dataUrl, mediaType = 'image/jpeg') {
  currentImage = { dataUrl, mediaType };
  previewImg.src = dataUrl;
  previewImg.classList.remove('hidden');
  dropContent.classList.add('hidden');
  selectedHint.classList.remove('hidden');
  analyzeBtn.classList.remove('hidden');
}

// ── Camera ──
async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } }
    });
    cameraVideo.srcObject = cameraStream;
    showSection('cameraSection');
  } catch {
    alert('カメラを起動できませんでした。ファイルから選択してください。');
  }
}

function capturePhoto() {
  const v = cameraVideo;
  captureCanvas.width  = v.videoWidth  || 1280;
  captureCanvas.height = v.videoHeight || 960;
  captureCanvas.getContext('2d').drawImage(v, 0, 0);
  const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.88);
  closeCamera();
  setImage(dataUrl, 'image/jpeg');
  showSection('uploadSection');
}

function closeCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  showSection('uploadSection');
}

// ── Section switching ──
function showSection(id) {
  ['uploadSection', 'cameraSection', 'loadingSection', 'errorSection', 'resultsSection']
    .forEach(s => $(s).classList.toggle('hidden', s !== id));
}

// ── Analyze ──
async function analyze() {
  if (!currentImage) return;

  showSection('loadingSection');
  try {
    const resized = await resizeImage(currentImage.dataUrl, 1200);
    const base64  = resized.split(',')[1];
    const result  = await callScoringApi(base64, 'image/jpeg');
    currentResult = result;
    displayResults(result, currentImage.dataUrl);
    saveHistory(result, currentImage.dataUrl);
  } catch (err) {
    showError(formatApiError(err));
  }
}

// ── Error display ──
function showError(message) {
  $('errorMsg').textContent = message;
  showSection('errorSection');
}

// ── Image resize ──
function resizeImage(dataUrl, maxDim) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else        { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.88));
    };
    img.src = dataUrl;
  });
}

// ── Scoring API ──
async function callScoringApi(base64, mediaType) {
  const res = await fetch('/api/analyzeFood', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: base64,
      mediaType
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `APIエラー (${res.status})`);
  }

  return res.json();
}

function formatApiError(err) {
  const message = err?.message || '';
  if (message.includes('OPENAI_API_KEY')) {
    return 'AI採点の準備がまだ完了していません。管理者側のAPIキー設定を確認してください。';
  }
  if (
    message.includes('利用枠') ||
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('current quota')
  ) {
    return 'AI採点の利用枠が上限に達しています。管理者側の課金設定を確認するまで、しばらく採点できません。';
  }
  if (message.includes('認証設定') || message.includes('invalid api key')) {
    return 'AI採点の認証設定に問題があります。管理者側のAPIキー設定を確認してください。';
  }
  if (message.includes('混み合っています') || message.includes('rate limit')) {
    return 'AI採点へのアクセスが混み合っています。少し時間をおいてもう一度試してください。';
  }
  if (message.includes('本日の採点回数上限')) {
    return message;
  }
  if (message.includes('画像サイズ')) {
    return message;
  }
  if (message.includes('unsupported mediaType')) {
    return 'この画像形式は対応していません。JPEG、PNG、WebPの写真で試してください。';
  }
  return message || '採点に失敗しました。別の写真でもう一度お試しください。';
}

// ── Display results ──
function displayResults(result, imageDataUrl) {
  showSection('resultsSection');

  $('resultImg').src = imageDataUrl;

  const total = result['合計'];
  const color = scoreColor(total);

  animateNum($('totalScore'), total, 1100);
  $('totalScore').style.color       = color;
  $('scoreBadge').style.borderColor = color;
  $('scoreBadge').style.boxShadow   = `0 0 16px ${color}55`;

  $('gradeText').textContent  = gradeText(total);
  $('gradeText').style.color  = color;

  const food = result['料理名'] || '';
  const foodBadge = $('foodBadge');
  if (food && food !== '料理') {
    foodBadge.textContent = food;
    foodBadge.classList.remove('hidden');
  } else {
    foodBadge.classList.add('hidden');
  }

  $('oneLiner').textContent = `「${result['一言評価']}」`;

  setTimeout(() => {
    setBar('bar-color', 'val-color', result['色彩バランス']);
    setBar('bar-comp',  'val-comp',  result['構図・アングル']);
    setBar('bar-light', 'val-light', result['明度・光']);
    setBar('bar-plate', 'val-plate', result['料理の盛り付け']);
  }, 150);

  if (radarChart) { radarChart.destroy(); radarChart = null; }
  radarChart = new Chart($('radarChart').getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['色彩\nバランス', '構図・\nアングル', '明度・光', '盛り付け'],
      datasets: [{
        data: [result['色彩バランス'], result['構図・アングル'], result['明度・光'], result['料理の盛り付け']],
        backgroundColor: 'rgba(245,158,11,0.12)',
        borderColor: color,
        borderWidth: 2.5,
        pointBackgroundColor: color,
        pointBorderColor: '#0f0f13',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      animation: { duration: 900 },
      scales: {
        r: {
          min: 0, max: 25,
          ticks: { display: false, stepSize: 5 },
          grid:       { color: 'rgba(255,255,255,0.08)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' },
          pointLabels:{ color: '#64748b', font: { size: 11 } }
        }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });

  const tags = result['ハッシュタグ'] || [];
  const hashtagSection = $('hashtagSection');
  if (tags.length > 0) {
    $('hashtagText').textContent = tags.join(' ');
    hashtagSection.classList.remove('hidden');
  } else {
    hashtagSection.classList.add('hidden');
  }

  $('adviceList').innerHTML = (result['改善アドバイス'] || [])
    .map(a => `<li>${escHtml(a)}</li>`).join('');

  $('retakePoint').textContent = result['撮り直しポイント'] || '';

  setTimeout(() => resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function setBar(barId, valId, value) {
  const pct = Math.round((value / 25) * 100);
  $(barId).style.width      = pct + '%';
  $(barId).style.background = scoreColor(pct);
  $(valId).innerHTML        = `${value}<small>/25</small>`;
  $(valId).style.color      = scoreColor(pct);
}

function animateNum(el, target, duration) {
  const start = performance.now();
  const tick = t => {
    const p = Math.min((t - start) / duration, 1);
    el.textContent = Math.round(easeOut(p) * target);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function scoreColor(score) {
  if (score >= 88) return '#f59e0b';
  if (score >= 76) return '#22c55e';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function gradeText(score) {
  if (score >= 90) return '✨ パーフェクト！インスタ映え確定';
  if (score >= 80) return '🌟 とても良い！SNS映え十分';
  if (score >= 70) return '👍 良い写真。少し調整すれば映えます';
  if (score >= 60) return '📸 まずまず。改善でぐっと変わります';
  if (score >= 40) return '🔧 要改善。アドバイスを参考に！';
  return '📚 基礎から改善しましょう';
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Share ──
async function shareResult(result, imageDataUrl) {
  const total     = result['合計'];
  const food      = result['料理名'] || '料理';
  const tags      = (result['ハッシュタグ'] || []).join(' ');
  const appUrl    = 'https://food-score-sigma.vercel.app';
  const shareText = `${food}の見え方は${total}点でした！\n${gradeText(total)}\n\n${tags}\n\n📸 FoodScore\n${appUrl}`;

  try {
    const cardUrl = await generateShareCard(imageDataUrl, result);
    const blob    = await fetch(cardUrl).then(r => r.blob());
    const file    = new File([blob], 'foodscore.jpg', { type: 'image/jpeg' });
    const canShareFile = navigator.canShare && navigator.canShare({ files: [file] });

    if (navigator.share && canShareFile) {
      await navigator.share({ title: `FoodScore ${total}点`, text: shareText, files: [file] });
    } else if (navigator.share) {
      await navigator.share({ title: `FoodScore ${total}点`, text: shareText });
    } else {
      const a = document.createElement('a');
      a.href = cardUrl; a.download = `foodscore-${total}pt.jpg`; a.click();
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      navigator.share?.({ title: `FoodScore ${total}点`, text: shareText }).catch(() => {});
    }
  }
}

async function generateShareCard(imageDataUrl, result) {
  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx   = canvas.getContext('2d');
  const total = result['合計'];
  const color = scoreColor(total);
  const font  = `-apple-system, "Hiragino Sans", "Yu Gothic", "Helvetica Neue", sans-serif`;

  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imageDataUrl; });

  // Photo cover-crop
  const scale = Math.max(W / img.width, H / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);

  // Dark gradient bottom-half overlay
  const grad = ctx.createLinearGradient(0, H * 0.36, 0, H);
  grad.addColorStop(0,   'rgba(15,15,19,0)');
  grad.addColorStop(0.4, 'rgba(15,15,19,0.82)');
  grad.addColorStop(1,   'rgba(15,15,19,0.98)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Score circle top-right
  const cx = W - 108, cy = 110, r = 88;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `900 60px ${font}`;
  ctx.fillText(String(total), cx, cy - 14);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `400 22px ${font}`;
  ctx.fillText('/ 100', cx, cy + 38);

  // Food name
  const food = result['料理名'] || '';
  if (food && food !== '料理') {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.font = `700 28px ${font}`;
    ctx.fillText(food, 64, H - 330);
  }

  // Grade
  ctx.fillStyle = '#f1f5f9';
  ctx.font = `800 50px ${font}`;
  wrapCanvasText(ctx, gradeText(total), 64, H - 278, W - 200, 64);

  // One-liner
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `400 26px ${font}`;
  wrapCanvasText(ctx, `「${result['一言評価']}」`, 64, H - 198, W - 128, 38);

  // Hashtags
  const tags = (result['ハッシュタグ'] || []).slice(0, 5).join(' ');
  if (tags) {
    ctx.fillStyle = '#f59e0b';
    ctx.font = `400 22px ${font}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(tags, 64, H - 76);
  }

  // Watermark
  ctx.fillStyle = 'rgba(100,116,139,0.55)';
  ctx.font = `400 20px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText('FoodScore', W - 64, H - 44);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function wrapCanvasText(ctx, text, x, y, maxW, lineH) {
  const chars = [...text];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH; line = ch;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function copyHashtags() {
  const tags = $('hashtagText').textContent;
  navigator.clipboard?.writeText(tags).then(() => {
    const btn = $('copyTagsBtn');
    const orig = btn.textContent;
    btn.textContent = '✓ コピー済み';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }).catch(() => {});
}

// ── Reset ──
function resetToUpload() {
  currentImage = null; currentResult = null;
  previewImg.src = '';
  previewImg.classList.add('hidden');
  dropContent.classList.remove('hidden');
  selectedHint.classList.add('hidden');
  analyzeBtn.classList.add('hidden');
  showSection('uploadSection');
  uploadSection.scrollIntoView({ behavior: 'smooth' });
}

// ── History ──
function getHistory() {
  try { return JSON.parse(localStorage.getItem('foodscore_history') || '[]'); }
  catch { return []; }
}

function saveHistory(result, dataUrl) {
  const hist = getHistory();
  resizeImage(dataUrl, 200).then(thumb => {
    hist.unshift({
      id:    Date.now(),
      date:  new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      score: result['合計'],
      food:  result['料理名'] || '料理',
      grade: gradeText(result['合計']),
      result,
      thumb
    });
    if (hist.length > 30) hist.splice(30);
    localStorage.setItem('foodscore_history', JSON.stringify(hist));
    renderHistory();
  });
}

function renderHistory() {
  const hist = getHistory();
  if (!hist.length) {
    historyList.innerHTML = '<p class="history-empty">まだ採点記録がありません。<br>料理写真をアップロードして始めましょう！</p>';
    return;
  }

  let trendHtml = '';
  if (hist.length >= 2) {
    const scores = hist.slice(0, 10).reverse().map(h => h.score);
    const n = scores.length;
    const px = (i) => 5 + (i / (n - 1)) * 90;
    const py = (s) => 5 + (1 - s / 100) * 90;
    const pts  = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ');
    const dots = scores.map((s, i) => `<circle cx="${px(i)}" cy="${py(s)}" r="3.5" fill="#f59e0b"/>`).join('');
    const diff = scores[n - 1] - scores[n - 2];
    const diffStr   = diff >= 0 ? `+${diff}` : String(diff);
    const diffColor = diff >= 0 ? '#22c55e' : '#ef4444';
    trendHtml = `
      <div class="trend-wrap">
        <div class="trend-header">
          <span class="trend-label">スコア推移 (直近${n}件)</span>
          <span class="trend-diff" style="color:${diffColor}">${diffStr}点</span>
        </div>
        <svg class="trend-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points="${pts}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${dots}
        </svg>
      </div>`;
  }

  historyList.innerHTML = trendHtml + hist.map((item, idx) => `
    <div class="history-item" data-idx="${idx}" role="button" tabindex="0">
      <img class="history-thumb" src="${item.thumb}" alt="" loading="lazy">
      <div class="history-info">
        <div class="history-food">${escHtml(item.food || '料理')}</div>
        <div class="history-score" style="color:${scoreColor(item.score)}">${item.score}点</div>
        <div class="history-date">${escHtml(item.date)}</div>
      </div>
      <div class="history-arrow">›</div>
    </div>
  `).join('');

  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = getHistory()[+el.dataset.idx];
      if (item?.result) showHistoryDetail(item);
    });
  });
}

function showHistoryDetail(item) {
  closeHistory();
  setTimeout(() => {
    currentImage  = { dataUrl: item.thumb, mediaType: 'image/jpeg' };
    currentResult = item.result;
    displayResults(item.result, item.thumb);
  }, 320);
}

function openHistory() {
  renderHistory();
  historyPanel.classList.remove('hidden');
  panelOverlay.classList.remove('hidden');
  requestAnimationFrame(() => historyPanel.classList.add('open'));
}

function closeHistory() {
  historyPanel.classList.remove('open');
  panelOverlay.classList.add('hidden');
  setTimeout(() => historyPanel.classList.add('hidden'), 310);
}

init();
