'use strict';

// ===== Whisky Descriptors =====
const AROMAS = [
  'バニラ', 'キャラメル', 'ハチミツ', 'フルーティー',
  'りんご', '洋梨', 'ベリー', 'シトラス',
  'フローラル', '麦芽', 'ナッツ', 'チョコレート',
  'スモーキー', 'ピーティー', 'ウッディ', 'オーク',
  'シェリー', 'スパイシー', '海塩', '草'
];

const FLAVORS = [
  '甘い', 'まろやか', 'フルーティー', 'バニラ',
  'キャラメル', 'ハチミツ', 'シトラス', 'ベリー',
  'チョコレート', 'ナッツ', 'スモーキー', 'ピーティー',
  'スパイシー', 'ビター', '辛口', 'ウッディ',
  'オーク', 'シェリー', '塩気', '麦芽',
  '長い余韻', '短い余韻'
];

// ===== Firebase =====
firebase.initializeApp({
  apiKey:            "AIzaSyBjp0JcBlh6Ytg1Zm22Hqk_vyCx_Z7x2lw",
  authDomain:        "whisky-note-e137d.firebaseapp.com",
  projectId:         "whisky-note-e137d",
  storageBucket:     "whisky-note-e137d.firebasestorage.app",
  messagingSenderId: "650822267689",
  appId:             "1:650822267689:web:4a8bd6949ace83d90efd38"
});
const db             = firebase.firestore();
const auth           = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
const COLLECTION     = 'whiskyRecords';

// ===== Storage (localStorage = オフラインキャッシュ) =====
const STORAGE_KEY = 'whisky_note_v1';
function saveToLocal(list) {
  const key = currentUser ? `${STORAGE_KEY}_${currentUser.uid}` : STORAGE_KEY;
  try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
}
function loadFromLocal() {
  const key = currentUser ? `${STORAGE_KEY}_${currentUser.uid}` : STORAGE_KEY;
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}

// ===== State =====
let allRecords          = [];
let records             = [];
let currentUser         = null;
let unsubscribeFirestore = null;
let currentSort = 'date-desc';
let searchQuery = '';
let editingId = null;       // add modal context
let currentDetailId = null;
let currentRating = 0;
let currentPhoto = null;
let currentAromas = [];
let currentFlavors = [];

// ===== Elements =====
const whiskyGrid = document.getElementById('whiskyGrid');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const avgRating = document.getElementById('avgRating');
const topRated = document.getElementById('topRated');
const addBtn = document.getElementById('addBtn');
const modalBackdrop = document.getElementById('modalBackdrop');
const whiskyModal = document.getElementById('whiskyModal');
const modalTitle = document.getElementById('modalTitle');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const saveBtn = document.getElementById('saveBtn');
const nameInput = document.getElementById('nameInput');
const distilleryInput = document.getElementById('distilleryInput');
const commentInput = document.getElementById('commentInput');
const starRating = document.getElementById('starRating');
const stars = starRating.querySelectorAll('.star');
const photoUploadArea = document.getElementById('photoUploadArea');
const photoInput = document.getElementById('photoInput');
const photoPlaceholder = document.getElementById('photoPlaceholder');
const photoPreview = document.getElementById('photoPreview');
const photoRemoveBtn = document.getElementById('photoRemoveBtn');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const sortBtn = document.getElementById('sortBtn');
const sortMenu = document.getElementById('sortMenu');
const sortOverlay = document.getElementById('sortOverlay');
const sortOptions = document.querySelectorAll('.sort-option');
const detailModal = document.getElementById('detailModal');
const detailBody = document.getElementById('detailBody');
const detailCloseBtn = document.getElementById('detailCloseBtn');
const deleteBtn = document.getElementById('deleteBtn');
const detailSaveBtn = document.getElementById('detailSaveBtn');
const confirmDialog = document.getElementById('confirmDialog');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// ===== Utils =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function starsHtml(rating, size = 'small') {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="${size === 'detail' ? 'detail-star' : 'card-star'} ${i < rating ? 'filled' : 'empty'}">★</span>`
  ).join('');
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(escapedQuery, 'gi'), m => `<mark class="highlight">${m}</mark>`);
}

// ===== Filtered & Sorted Records =====
function getDisplayRecords() {
  let list = [...records];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.distillery && r.distillery.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => {
    switch (currentSort) {
      case 'date-asc':    return new Date(a.createdAt) - new Date(b.createdAt);
      case 'date-desc':   return new Date(b.createdAt) - new Date(a.createdAt);
      case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
      case 'rating-asc':  return (a.rating || 0) - (b.rating || 0);
      case 'name-asc':    return a.name.localeCompare(b.name, 'ja');
      default:            return 0;
    }
  });

  return list;
}

// ===== Stats =====
function updateStats() {
  const total = records.length;
  totalCount.textContent = total;

  const rated = records.filter(r => r.rating > 0);
  if (rated.length > 0) {
    const avg = rated.reduce((sum, r) => sum + r.rating, 0) / rated.length;
    avgRating.textContent = avg.toFixed(1);
    const max = Math.max(...rated.map(r => r.rating));
    topRated.textContent = '★'.repeat(max);
  } else {
    avgRating.textContent = '-';
    topRated.textContent = '-';
  }
}

// ===== Render List =====
function render() {
  const list = getDisplayRecords();
  whiskyGrid.innerHTML = '';

  if (list.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
    list.forEach(record => whiskyGrid.appendChild(createCard(record)));
  }

  updateStats();
}

function createCard(record) {
  const card = document.createElement('div');
  card.className = 'whisky-card';
  card.dataset.id = record.id;

  const photoHtml = record.photo
    ? `<img src="${record.photo}" alt="${escapeHtml(record.name)}" loading="lazy">`
    : `<div class="card-photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

  const distilleryHtml = record.distillery
    ? `<div class="card-distillery">${highlight(record.distillery, searchQuery)}</div>`
    : '';

  const commentHtml = record.comment
    ? `<div class="card-comment-preview">${escapeHtml(record.comment)}</div>`
    : '';

  card.innerHTML = `
    <div class="card-photo">${photoHtml}</div>
    <div class="card-info">
      <div class="card-top">
        <div class="card-name">${highlight(record.name, searchQuery)}</div>
        <div class="card-rating">${starsHtml(record.rating || 0)}</div>
      </div>
      <div class="card-bottom">
        ${distilleryHtml}
        <div class="card-date">${formatDate(record.createdAt)}</div>
      </div>
      ${commentHtml}
    </div>
  `;

  card.addEventListener('click', () => openDetail(record.id));
  return card;
}

// ===== Tag Lists =====
function setupTagList(containerId, options, arr) {
  const old = document.getElementById(containerId);
  if (!old) return;
  const container = old.cloneNode(false);
  old.parentNode.replaceChild(container, old);

  function render() {
    container.innerHTML = '';

    // Predefined tags
    options.forEach(opt => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'tag' + (arr.includes(opt) ? ' selected' : '');
      tag.textContent = opt;
      tag.addEventListener('click', () => {
        const idx = arr.indexOf(opt);
        if (idx >= 0) arr.splice(idx, 1); else arr.push(opt);
        tag.classList.toggle('selected');
      });
      container.appendChild(tag);
    });

    // Custom tags (values not in predefined options)
    arr.filter(v => !options.includes(v)).forEach(opt => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'tag selected';
      tag.innerHTML = `${escapeHtml(opt)}<span class="tag-remove">✕</span>`;
      tag.addEventListener('click', () => {
        arr.splice(arr.indexOf(opt), 1);
        render();
      });
      container.appendChild(tag);
    });

    // "その他" button
    const otherBtn = document.createElement('button');
    otherBtn.type = 'button';
    otherBtn.className = 'tag tag-other-btn';
    otherBtn.textContent = '＋ その他';
    otherBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'tag-other-input';
      input.placeholder = '自由入力';
      otherBtn.replaceWith(input);
      input.focus();

      let done = false;
      function confirm() {
        if (done) return;
        done = true;
        const val = input.value.trim();
        if (val && !arr.includes(val)) arr.push(val);
        render();
      }
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); confirm(); }
        if (e.key === 'Escape') { done = true; render(); }
      });
      input.addEventListener('blur', confirm);
    });
    container.appendChild(otherBtn);
  }

  render();
}

// ===== Add Modal =====
function openAddModal() {
  editingId = null;
  currentRating = 0;
  currentPhoto = null;
  currentAromas.splice(0);
  currentFlavors.splice(0);
  modalTitle.textContent = 'ウイスキーを追加';
  nameInput.value = '';
  distilleryInput.value = '';
  commentInput.value = '';
  updateStarUI(0);
  resetPhotoUI();
  setupTagList('aromaTagList', AROMAS, currentAromas);
  setupTagList('flavorTagList', FLAVORS, currentFlavors);
  openModal();
}

function openModal() {
  modalBackdrop.classList.add('open');
  whiskyModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => nameInput.focus(), 400);
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  whiskyModal.classList.remove('open');
  document.body.style.overflow = '';
}

function saveRecord() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    nameInput.style.borderColor = 'var(--danger)';
    setTimeout(() => (nameInput.style.borderColor = ''), 1500);
    return;
  }

  const record = {
    id: generateId(),
    name,
    distillery: distilleryInput.value.trim(),
    rating: currentRating,
    aromas: [...currentAromas],
    flavors: [...currentFlavors],
    comment: commentInput.value.trim(),
    photo: currentPhoto,
    userId: currentUser ? currentUser.uid : null,
    userName: currentUser ? (currentUser.displayName || currentUser.email || '名無し') : '名無し',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  closeModal();
  db.collection(COLLECTION).doc(record.id).set(record).catch(console.error);
}

// ===== Star Rating (Add Modal) =====
function updateStarUI(value) {
  stars.forEach(star => {
    star.classList.toggle('active', parseInt(star.dataset.value) <= value);
  });
}

stars.forEach(star => {
  star.addEventListener('click', () => {
    const v = parseInt(star.dataset.value);
    currentRating = currentRating === v ? 0 : v;
    updateStarUI(currentRating);
  });
  star.addEventListener('mouseenter', () => {
    const v = parseInt(star.dataset.value);
    stars.forEach(s => s.classList.toggle('hover', parseInt(s.dataset.value) <= v));
  });
});

starRating.addEventListener('mouseleave', () => {
  stars.forEach(s => s.classList.remove('hover'));
});

// ===== Photo =====
function resetPhotoUI() {
  photoPreview.src = '';
  photoPreview.hidden = true;
  photoPlaceholder.style.display = '';
  photoRemoveBtn.hidden = true;
  photoInput.value = '';
}

function showInPreview(url) {
  if (detailModal.classList.contains('open')) {
    const prev = document.getElementById('detailPhotoPreview');
    const ph   = document.getElementById('detailPhotoPlaceholder');
    const rm   = document.getElementById('detailPhotoRemoveBtn');
    if (prev) { prev.src = url; prev.hidden = false; }
    if (ph)   ph.style.display = 'none';
    if (rm)   rm.hidden = false;
  } else {
    photoPreview.src = url;
    photoPreview.hidden = false;
    photoPlaceholder.style.display = 'none';
    photoRemoveBtn.hidden = false;
  }
}

photoUploadArea.addEventListener('click', () => photoInput.click());

function fileToDataUrlDirect(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = async () => {
      try {
        // decode() ensures pixel data is ready; ignore failure and proceed
        if (typeof img.decode === 'function') {
          try { await img.decode(); } catch {}
        }
        const maxSize = 1200;
        let { width, height } = img;
        if (!width || !height) throw new Error('Invalid dimensions');
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (!dataUrl || dataUrl === 'data:,') throw new Error('Empty canvas output');
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
    img.src = url;
  });
}

photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  if (!file) return;

  // Show preview immediately via blob URL — renders on iOS for any format including HEIC
  const blobUrl = URL.createObjectURL(file);
  showInPreview(blobUrl);

  let dataUrl = null;

  // 1. Canvas → JPEG
  try { dataUrl = await blobToDataUrl(file); } catch {}

  // 2. heic2any → JPEG (for desktop HEIC)
  if (!dataUrl && typeof heic2any !== 'undefined') {
    try {
      const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      const blob = Array.isArray(result) ? result[0] : result;
      dataUrl = await blobToDataUrl(blob);
    } catch {}
  }

  // 3. FileReader raw (last resort — stores original bytes)
  if (!dataUrl) {
    try { dataUrl = await fileToDataUrlDirect(file); } catch {}
  }

  URL.revokeObjectURL(blobUrl);

  if (dataUrl) {
    currentPhoto = dataUrl;
    showInPreview(dataUrl); // switch to persistent data URL
  } else {
    currentPhoto = null;
    resetPhotoUI();
    alert('画像の読み込みに失敗しました。');
  }
  photoInput.value = '';
});

photoRemoveBtn.addEventListener('click', e => {
  e.stopPropagation();
  currentPhoto = null;
  resetPhotoUI();
});

// ===== Detail View (inline edit) =====
function openDetail(id) {
  const record = records.find(r => r.id === id);
  if (!record) return;
  currentDetailId = id;
  currentRating = record.rating || 0;
  currentPhoto = record.photo || null;
  currentAromas.splice(0, currentAromas.length, ...(record.aromas || []));
  currentFlavors.splice(0, currentFlavors.length, ...(record.flavors || []));

  const stars5 = [1, 2, 3, 4, 5].map(v =>
    `<button class="star${v <= currentRating ? ' active' : ''}" data-value="${v}" aria-label="${v}星">★</button>`
  ).join('');

  detailBody.innerHTML = `
    <div class="photo-upload-area" id="detailPhotoArea">
      <div class="photo-placeholder" id="detailPhotoPlaceholder" ${currentPhoto ? 'style="display:none"' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>タップして写真を追加</span>
      </div>
      <img class="photo-preview" id="detailPhotoPreview" alt="プレビュー" ${currentPhoto ? `src="${currentPhoto}"` : 'hidden'}>
      <button class="photo-remove-btn" id="detailPhotoRemoveBtn" ${currentPhoto ? '' : 'hidden'} aria-label="写真を削除">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="form-fields">
      <div class="form-group">
        <label class="form-label">銘柄 <span class="required">*</span></label>
        <input class="form-input" type="text" id="detailNameInput" value="${escapeHtml(record.name)}" placeholder="例: 山崎 12年">
      </div>
      <div class="form-group">
        <label class="form-label">蒸留所</label>
        <input class="form-input" type="text" id="detailDistilleryInput" value="${escapeHtml(record.distillery || '')}" placeholder="例: サントリー山崎蒸溜所">
      </div>
      <div class="form-group">
        <label class="form-label">評価</label>
        <div class="star-rating" id="detailStarRating">${stars5}</div>
      </div>
      <div class="form-group">
        <label class="form-label">香り</label>
        <div class="tag-list" id="detailAromaTagList"></div>
      </div>
      <div class="form-group">
        <label class="form-label">味わい</label>
        <div class="tag-list" id="detailFlavorTagList"></div>
      </div>
      <div class="form-group">
        <label class="form-label">コメント</label>
        <textarea class="form-textarea" id="detailCommentInput" rows="5" placeholder="その他メモ…">${escapeHtml(record.comment || '')}</textarea>
      </div>
      <div class="detail-meta">記録日: ${formatDate(record.createdAt)}</div>
    </div>
  `;

  // Star rating events for detail view
  const detailStarRating = document.getElementById('detailStarRating');
  const detailStars = detailStarRating.querySelectorAll('.star');

  detailStars.forEach(star => {
    star.addEventListener('click', () => {
      const v = parseInt(star.dataset.value);
      currentRating = currentRating === v ? 0 : v;
      detailStars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= currentRating));
    });
    star.addEventListener('mouseenter', () => {
      const v = parseInt(star.dataset.value);
      detailStars.forEach(s => s.classList.toggle('hover', parseInt(s.dataset.value) <= v));
    });
  });
  detailStarRating.addEventListener('mouseleave', () => {
    detailStars.forEach(s => s.classList.remove('hover'));
  });

  // Tag lists for detail view
  setupTagList('detailAromaTagList', AROMAS, currentAromas);
  setupTagList('detailFlavorTagList', FLAVORS, currentFlavors);

  // Photo events for detail view
  document.getElementById('detailPhotoArea').addEventListener('click', () => photoInput.click());
  document.getElementById('detailPhotoRemoveBtn').addEventListener('click', e => {
    e.stopPropagation();
    currentPhoto = null;
    const prev = document.getElementById('detailPhotoPreview');
    const ph   = document.getElementById('detailPhotoPlaceholder');
    const rm   = document.getElementById('detailPhotoRemoveBtn');
    if (prev) { prev.hidden = true; prev.src = ''; }
    if (ph)   ph.style.display = '';
    if (rm)   rm.hidden = true;
    photoInput.value = '';
  });

  detailModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  detailModal.classList.remove('open');
  document.body.style.overflow = '';
  currentDetailId = null;
}

function saveDetailRecord() {
  const nameEl = document.getElementById('detailNameInput');
  const name = nameEl.value.trim();
  if (!name) {
    nameEl.focus();
    nameEl.style.borderColor = 'var(--danger)';
    setTimeout(() => (nameEl.style.borderColor = ''), 1500);
    return;
  }

  const idx = records.findIndex(r => r.id === currentDetailId);
  if (idx === -1) return;

  const updated = {
    ...records[idx],
    name,
    distillery: document.getElementById('detailDistilleryInput').value.trim(),
    rating:     currentRating,
    aromas:     [...currentAromas],
    flavors:    [...currentFlavors],
    comment:    document.getElementById('detailCommentInput').value.trim(),
    photo:      currentPhoto,
    updatedAt:  new Date().toISOString(),
  };

  closeDetail();
  db.collection(COLLECTION).doc(updated.id).set(updated).catch(console.error);
}

// ===== Delete =====
function openConfirm() {
  confirmDialog.classList.add('open');
}

function closeConfirm() {
  confirmDialog.classList.remove('open');
}

function deleteRecord(id) {
  db.collection(COLLECTION).doc(id).delete().catch(console.error);
}

// ===== Sort =====
function toggleSort() {
  const isOpen = sortMenu.classList.contains('open');
  sortMenu.classList.toggle('open', !isOpen);
  sortOverlay.classList.toggle('open', !isOpen);
}

function closeSort() {
  sortMenu.classList.remove('open');
  sortOverlay.classList.remove('open');
}


// ===== Export / Import =====
function exportData() {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `whisky-note-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeSort();
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const parsed   = JSON.parse(e.target.result);
      const imported = Array.isArray(parsed) ? parsed : (parsed.records || []);
      if (!Array.isArray(imported) || imported.length === 0) {
        alert('有効なデータが見つかりませんでした。');
        return;
      }
      if (!confirm(`${imported.length}件のデータを読み込みます。\n現在のデータは上書きされます。よろしいですか？`)) return;
      const batch = db.batch();
      const existing = await db.collection(COLLECTION).get();
      existing.docs.forEach(d => batch.delete(d.ref));
      imported.forEach(r => batch.set(db.collection(COLLECTION).doc(r.id), r));
      await batch.commit();
      alert(`${imported.length}件のデータを読み込みました。`);
    } catch {
      alert('読み込みに失敗しました。正しいJSONファイルを選択してください。');
    }
  };
  reader.readAsText(file);
}

// ===== Event Listeners =====
addBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
saveBtn.addEventListener('click', saveRecord);

detailCloseBtn.addEventListener('click', closeDetail);
detailSaveBtn.addEventListener('click', saveDetailRecord);

deleteBtn.addEventListener('click', openConfirm);
confirmCancelBtn.addEventListener('click', closeConfirm);
confirmDeleteBtn.addEventListener('click', () => {
  const id = currentDetailId;
  closeConfirm();
  closeDetail();
  setTimeout(() => deleteRecord(id), 300);
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  render();
  if (searchQuery.length >= 2) {
    document.getElementById('myCollectionLabel').hidden = false;
    renderCommunityResults();
    showLocalDBResults(searchQuery);
  } else {
    hideWikiSection();
  }
});
clearSearchBtn.addEventListener('click', () => {
  searchQuery = '';
  searchInput.value = '';
  render();
  searchInput.focus();
  hideWikiSection();
});

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importInput').click();
});
document.getElementById('importInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) { importData(file); e.target.value = ''; }
});

sortBtn.addEventListener('click', e => {
  e.stopPropagation();
  toggleSort();
});
sortOverlay.addEventListener('click', closeSort);

sortOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    currentSort = opt.dataset.sort;
    sortOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    closeSort();
    render();
  });
});

document.getElementById('wikiDetailCloseBtn').addEventListener('click', closeWikiDetail);
document.getElementById('wikiAddBtn').addEventListener('click', () => {
  if (!currentWikiSummary) return;
  if (currentWikiSummary._community) addFromCommunity(currentWikiSummary._data);
  else if (currentWikiSummary._local) addFromLocalDB(currentWikiSummary._data);
});
document.getElementById('googleSignInBtn').addEventListener('click', signIn);
document.getElementById('signOutBtn').addEventListener('click', signOut);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (confirmDialog.classList.contains('open'))                          closeConfirm();
    else if (whiskyModal.classList.contains('open'))                       closeModal();
    else if (document.getElementById('wikiDetailModal').classList.contains('open')) closeWikiDetail();
    else if (detailModal.classList.contains('open'))                       closeDetail();
    else if (sortMenu.classList.contains('open'))                          closeSort();
  }
});

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveRecord();
});

// ===== Local DB Display =====
let currentWikiSummary = null;

function showLocalDBResults(query) {
  const section = document.getElementById('wikiSection');
  const results = document.getElementById('wikiResults');
  const hits    = searchLocalDB(query);

  if (hits.length === 0) { section.hidden = true; return; }

  section.hidden = false;
  results.innerHTML = '';
  results.appendChild(createLocalOverview(hits[0]));

  if (hits.length > 1) {
    const label = document.createElement('div');
    label.className = 'wiki-related-label';
    label.textContent = `${hits[0].brand} の他のボトル`;
    results.appendChild(label);
    const list = document.createElement('div');
    list.className = 'wiki-related-list';
    hits.slice(1).forEach(w => list.appendChild(createLocalRelatedItem(w)));
    results.appendChild(list);
  }
}

function hideWikiSection() {
  document.getElementById('wikiSection').hidden = true;
  document.getElementById('myCollectionLabel').hidden = true;
  document.getElementById('communitySection').hidden = true;
}

// ===== Community Records =====
function renderCommunityResults() {
  const section = document.getElementById('communitySection');
  const grid    = document.getElementById('communityGrid');

  if (!searchQuery || !currentUser) { section.hidden = true; return; }

  const q = searchQuery.toLowerCase();
  const hits = allRecords.filter(r =>
    r.userId && r.userId !== currentUser.uid &&
    (r.name.toLowerCase().includes(q) ||
     (r.distillery && r.distillery.toLowerCase().includes(q)))
  );

  if (hits.length === 0) { section.hidden = true; return; }

  section.hidden = false;
  grid.innerHTML = '';
  hits.forEach(r => grid.appendChild(createCommunityCard(r)));
}

function createCommunityCard(record) {
  const card = document.createElement('div');
  card.className = 'whisky-card community-card';

  const photoHtml = record.photo
    ? `<img src="${record.photo}" alt="${escapeHtml(record.name)}" loading="lazy">`
    : `<div class="card-photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

  const distilleryHtml = record.distillery
    ? `<div class="card-distillery">${highlight(record.distillery, searchQuery)}</div>`
    : '';

  card.innerHTML = `
    <div class="card-photo">${photoHtml}</div>
    <div class="card-info">
      <div class="card-top">
        <div class="card-name">${highlight(record.name, searchQuery)}</div>
        <div class="card-rating">${starsHtml(record.rating || 0)}</div>
      </div>
      <div class="card-bottom">
        ${distilleryHtml}
        <div class="card-recorder">👤 ${escapeHtml(record.userName || '?')}</div>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openCommunityDetail(record));
  return card;
}

function openCommunityDetail(record) {
  currentWikiSummary = { _community: true, _data: record };
  const body   = document.getElementById('wikiDetailBody');
  const addBtn = document.getElementById('wikiAddBtn');
  addBtn.textContent = '＋ マイコレクションに追加';

  const tagsHtml = [
    ...(record.aromas && record.aromas.length ? [
      `<div class="detail-divider"></div>
       <div class="detail-section-label">香り</div>
       <div class="tag-list" style="padding-bottom:8px">
         ${record.aromas.map(a => `<span class="tag">${escapeHtml(a)}</span>`).join('')}
       </div>`
    ] : []),
    ...(record.flavors && record.flavors.length ? [
      `<div class="detail-section-label">味わい</div>
       <div class="tag-list">
         ${record.flavors.map(f => `<span class="tag">${escapeHtml(f)}</span>`).join('')}
       </div>`
    ] : []),
  ].join('');

  body.innerHTML = `
    ${record.photo
      ? `<img class="detail-photo" src="${record.photo}" alt="${escapeHtml(record.name)}">`
      : `<div class="detail-photo-placeholder">🥃</div>`}
    <div class="detail-info">
      <h1 class="detail-name">${escapeHtml(record.name)}</h1>
      ${record.distillery ? `<div class="detail-distillery">🏭 ${escapeHtml(record.distillery)}</div>` : ''}
      <div class="detail-stars">${starsHtml(record.rating || 0, 'detail')}</div>
      ${tagsHtml}
      ${record.comment ? `
        <div class="detail-divider"></div>
        <div class="detail-section-label">コメント</div>
        <div class="detail-comment">${escapeHtml(record.comment)}</div>` : ''}
      <div class="detail-date">📝 ${escapeHtml(record.userName || 'Unknown')} さんの記録</div>
    </div>
  `;

  document.getElementById('wikiDetailModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function addFromCommunity(record) {
  closeWikiDetail();
  setTimeout(() => {
    editingId = null;
    currentRating = 0;
    currentPhoto = null;
    currentAromas.splice(0, currentAromas.length, ...(record.aromas || []));
    currentFlavors.splice(0, currentFlavors.length, ...(record.flavors || []));
    modalTitle.textContent = 'ウイスキーを追加';
    nameInput.value = record.name;
    distilleryInput.value = record.distillery || '';
    commentInput.value = '';
    updateStarUI(0);
    resetPhotoUI();
    setupTagList('aromaTagList', AROMAS, currentAromas);
    setupTagList('flavorTagList', FLAVORS, currentFlavors);
    openModal();
  }, 350);
}

function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /Line\/|FBAN|FBAV|Instagram|Twitter\/|Snapchat/i.test(ua);
}

function signIn() {
  if (isInAppBrowser()) {
    auth.signInWithRedirect(googleProvider).catch(e => console.error('Sign in error:', e));
  } else {
    auth.signInWithPopup(googleProvider).catch(e => console.error('Sign in error:', e));
  }
}

function signOut() {
  closeSort();
  auth.signOut().catch(e => console.error('Sign out error:', e));
}

// ===== Local DB Search =====
function searchLocalDB(query) {
  const q = query.toLowerCase();
  return WHISKY_DB.filter(w =>
    w.name.toLowerCase().includes(q) ||
    w.nameEn.toLowerCase().includes(q) ||
    w.brand.toLowerCase().includes(q) ||
    w.brandEn.toLowerCase().includes(q) ||
    w.distillery.toLowerCase().includes(q)
  );
}

function createLocalOverview(w) {
  const el = document.createElement('div');
  el.className = 'wiki-overview';
  el.innerHTML = `
    <div class="wiki-overview-img-placeholder" style="font-size:56px">🥃</div>
    <div class="wiki-overview-body">
      <div class="wiki-overview-source">
        <div class="wiki-w-dot" style="background:var(--amber);font-size:10px">DB</div>
        ウイスキーデータベース
      </div>
      <div class="wiki-overview-title">${escapeHtml(w.name)}</div>
      <div class="wiki-overview-subtitle">${escapeHtml(w.distillery)}</div>
      <div class="wiki-fact-chips">
        <span class="wiki-fact-chip">${escapeHtml(w.country)}</span>
        <span class="wiki-fact-chip">${escapeHtml(w.type)}</span>
        ${w.age !== 'ノンエイジ' ? `<span class="wiki-fact-chip">${escapeHtml(w.age)}</span>` : ''}
        <span class="wiki-fact-chip">${escapeHtml(w.abv)}</span>
        <span class="wiki-fact-chip">${escapeHtml(w.region)}</span>
      </div>
      <div class="wiki-extract">${escapeHtml(w.desc)}</div>
      ${w.aromas.length ? `
        <div style="margin-top:12px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">香り</div>
          <div class="wiki-fact-chips">${w.aromas.map(a => `<span class="wiki-fact-chip">${escapeHtml(a)}</span>`).join('')}</div>
        </div>` : ''}
      ${w.flavors.length ? `
        <div style="margin-top:10px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">味わい</div>
          <div class="wiki-fact-chips">${w.flavors.map(f => `<span class="wiki-fact-chip">${escapeHtml(f)}</span>`).join('')}</div>
        </div>` : ''}
      <div class="wiki-overview-footer">
        <span class="wiki-attribution">ウイスキーDB</span>
        <button class="btn-wiki-add">＋ コレクションに追加</button>
      </div>
    </div>
  `;
  el.querySelector('.btn-wiki-add').addEventListener('click', e => {
    e.stopPropagation();
    addFromLocalDB(w);
  });
  return el;
}

function createLocalRelatedItem(w) {
  const item = document.createElement('div');
  item.className = 'wiki-related-item';
  item.innerHTML = `
    <div class="wiki-related-thumb-ph">🥃</div>
    <div class="wiki-related-info">
      <div class="wiki-related-title">${escapeHtml(w.name)}</div>
      <div class="wiki-related-desc">${escapeHtml(w.type)} / ${escapeHtml(w.age)} / ${escapeHtml(w.abv)}</div>
    </div>
    <span class="wiki-related-arrow">›</span>
  `;
  item.addEventListener('click', () => showLocalDetail(w));
  return item;
}

function showLocalDetail(w) {
  currentWikiSummary = { _local: true, _data: w };
  document.getElementById('wikiAddBtn').textContent = '＋ コレクションに追加';
  const body = document.getElementById('wikiDetailBody');
  body.innerHTML = `
    <div class="detail-photo-placeholder" style="font-size:72px;aspect-ratio:16/9">🥃</div>
    <div class="detail-info">
      <h1 class="detail-name">${escapeHtml(w.name)}</h1>
      <div class="detail-distillery">🏭 ${escapeHtml(w.distillery)}</div>
      <div class="wiki-fact-chips" style="margin:12px 0">
        <span class="wiki-fact-chip">${escapeHtml(w.country)}</span>
        <span class="wiki-fact-chip">${escapeHtml(w.type)}</span>
        ${w.age !== 'ノンエイジ' ? `<span class="wiki-fact-chip">${escapeHtml(w.age)}</span>` : ''}
        <span class="wiki-fact-chip">${escapeHtml(w.abv)}</span>
        <span class="wiki-fact-chip">${escapeHtml(w.region)}</span>
      </div>
      <div class="detail-divider"></div>
      <div class="detail-section-label">概要</div>
      <div class="detail-comment">${escapeHtml(w.desc)}</div>
      ${w.aromas.length ? `
        <div style="margin-top:16px">
          <div class="detail-section-label">香り</div>
          <div class="wiki-fact-chips">${w.aromas.map(a => `<span class="wiki-fact-chip">${escapeHtml(a)}</span>`).join('')}</div>
        </div>` : ''}
      ${w.flavors.length ? `
        <div style="margin-top:12px">
          <div class="detail-section-label">味わい</div>
          <div class="wiki-fact-chips">${w.flavors.map(f => `<span class="wiki-fact-chip">${escapeHtml(f)}</span>`).join('')}</div>
        </div>` : ''}
      <div class="detail-date">出典: ウイスキーデータベース</div>
    </div>
  `;
  document.getElementById('wikiDetailModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function addFromLocalDB(w) {
  closeWikiDetail();
  setTimeout(() => {
    editingId = null;
    currentRating = 0;
    currentPhoto = null;
    currentAromas.splice(0, currentAromas.length, ...w.aromas);
    currentFlavors.splice(0, currentFlavors.length, ...w.flavors);
    modalTitle.textContent = 'ウイスキーを追加';
    nameInput.value = w.name;
    distilleryInput.value = w.distillery;
    commentInput.value = '';
    updateStarUI(0);
    resetPhotoUI();
    setupTagList('aromaTagList', AROMAS, currentAromas);
    setupTagList('flavorTagList', FLAVORS, currentFlavors);
    openModal();
  }, 350);
}

function closeWikiDetail() {
  document.getElementById('wikiDetailModal').classList.remove('open');
  document.body.style.overflow = '';
  currentWikiSummary = null;
}

// ===== Init: Auth 状態管理 =====
auth.getRedirectResult().catch(e => {
  if (e.code !== 'auth/no-auth-event') {
    console.error('Redirect result error:', e);
    const btn = document.getElementById('googleSignInBtn');
    if (btn) {
      btn.textContent = 'ログインに失敗しました。再度お試しください。';
      btn.disabled = false;
    }
  }
});

auth.onAuthStateChanged(user => {
  currentUser = user;
  const loginScreen = document.getElementById('loginScreen');

  if (user) {
    loginScreen.style.display = 'none';

    // ユーザー名をソートメニューに表示
    const label = document.getElementById('currentUserLabel');
    if (label) label.textContent = user.displayName || user.email || 'ユーザー';

    // ローカルキャッシュで即時表示
    records = loadFromLocal();
    render();

    // Firestoreリアルタイム同期開始
    if (unsubscribeFirestore) unsubscribeFirestore();
    unsubscribeFirestore = db.collection(COLLECTION).onSnapshot(
      snapshot => {
        allRecords = snapshot.docs.map(d => d.data());
        records = allRecords.filter(r => !r.userId || r.userId === currentUser.uid);
        saveToLocal(records);
        render();
        if (searchQuery.length >= 2) renderCommunityResults();
      },
      error => console.error('Firestore sync error:', error)
    );
  } else {
    loginScreen.style.display = '';
    records    = [];
    allRecords = [];
    if (unsubscribeFirestore) { unsubscribeFirestore(); unsubscribeFirestore = null; }
    render();
  }
});
