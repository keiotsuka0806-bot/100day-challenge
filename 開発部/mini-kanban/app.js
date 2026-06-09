const firebaseConfig = {
  apiKey: "AIzaSyCL6s8dVDk6x_DajS-GSoAPhK64jnAOkp4",
  authDomain: "mini-kanban-kei-2999.firebaseapp.com",
  projectId: "mini-kanban-kei-2999",
  storageBucket: "mini-kanban-kei-2999.firebasestorage.app",
  messagingSenderId: "175617453240",
  appId: "1:175617453240:web:e4907601f260cd2e90984d"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// --- State ---
let currentUser = null;
let boards = {};
let currentBoardId = null;
let currentBoardData = null;
let currentBoardCards = {};
let activeListeners = [];
let dragCardId = null;
let editCardId = null;
let currentModalColumn = null;
let selectedColor = '';

function addListener(unsub) {
  activeListeners.push(unsub);
}

function clearListeners() {
  activeListeners.forEach(u => u());
  activeListeners = [];
}

// --- Auth ---
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    document.getElementById('userAvatar').src = user.photoURL || '';
    document.getElementById('userName').textContent = user.displayName || user.email;
    const hash = location.hash.slice(1);
    if (hash.startsWith('board/')) {
      openBoard(hash.replace('board/', ''));
    } else {
      showBoardsList();
    }
  } else {
    showScreen('login');
  }
});

document.getElementById('loginBtn').addEventListener('click', () => {
  auth.signInWithPopup(googleProvider).catch(err => {
    if (err.code !== 'auth/popup-closed-by-user') alert('ログインに失敗しました: ' + err.message);
  });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearListeners();
  auth.signOut();
  location.hash = '';
});

// --- Screen ---
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(`screen-${name}`).classList.remove('hidden');
}

// --- Boards List ---
function showBoardsList() {
  clearListeners();
  closeSettingsPanel();
  location.hash = '';
  showScreen('boards');
  boards = {};

  const unsubOwner = db.collection('boards')
    .where('ownerId', '==', currentUser.uid)
    .onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed') delete boards[ch.doc.id];
        else boards[ch.doc.id] = { id: ch.doc.id, ...ch.doc.data() };
      });
      renderBoardsList();
    }, err => console.error('boards listener error:', err));

  const unsubMember = db.collection('boards')
    .where('memberEmails', 'array-contains', currentUser.email)
    .onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed') delete boards[ch.doc.id];
        else boards[ch.doc.id] = { id: ch.doc.id, ...ch.doc.data() };
      });
      renderBoardsList();
    }, err => console.error('member boards listener error:', err));

  addListener(unsubOwner);
  addListener(unsubMember);
}

function renderBoardsList() {
  const list = document.getElementById('boardsList');
  list.innerHTML = '';
  const sorted = Object.values(boards).sort((a, b) =>
    (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
  );
  if (sorted.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'boards-empty';
    empty.textContent = 'まだボードがありません。「新しいボード」から作成してください。';
    list.appendChild(empty);
    return;
  }
  sorted.forEach(board => {
    const card = document.createElement('div');
    card.className = 'board-card';
    const isOwner = board.ownerId === currentUser.uid;
    const name = document.createElement('div');
    name.className = 'board-card-name';
    name.textContent = board.name;
    const meta = document.createElement('div');
    meta.className = 'board-card-meta';
    meta.textContent = (isOwner ? 'オーナー' : 'メンバー') + ' · メンバー ' + (board.memberEmails?.length || 0) + '人';
    card.appendChild(name);
    card.appendChild(meta);
    card.addEventListener('click', () => openBoard(board.id));
    list.appendChild(card);
  });
}

// --- New Board ---
document.getElementById('newBoardBtn').addEventListener('click', () => {
  document.getElementById('newBoardName').value = '';
  document.getElementById('newBoardOverlay').classList.add('visible');
  document.getElementById('newBoardName').focus();
});

document.getElementById('cancelNewBoardBtn').addEventListener('click', () => {
  document.getElementById('newBoardOverlay').classList.remove('visible');
});

document.getElementById('createBoardBtn').addEventListener('click', createBoard);
document.getElementById('newBoardName').addEventListener('keydown', e => { if (e.key === 'Enter') createBoard(); });

async function createBoard() {
  const name = document.getElementById('newBoardName').value.trim();
  if (!name) return;
  document.getElementById('newBoardOverlay').classList.remove('visible');
  const ref = await db.collection('boards').add({
    name,
    ownerId: currentUser.uid,
    ownerEmail: currentUser.email,
    memberEmails: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  openBoard(ref.id);
}

// --- Board View ---
async function openBoard(boardId) {
  clearListeners();
  currentBoardId = boardId;
  currentBoardCards = {};
  location.hash = `board/${boardId}`;

  let doc;
  try {
    doc = await db.collection('boards').doc(boardId).get();
  } catch {
    alert('ボードの取得に失敗しました。アクセス権限がない可能性があります。');
    showBoardsList();
    return;
  }

  if (!doc.exists) {
    alert('ボードが見つかりません');
    showBoardsList();
    return;
  }

  currentBoardData = { id: doc.id, ...doc.data() };
  const isOwner = currentBoardData.ownerId === currentUser.uid;
  const isMember = (currentBoardData.memberEmails || []).includes(currentUser.email);

  if (!isOwner && !isMember) {
    alert('このボードへのアクセス権限がありません。オーナーに招待を依頼してください。');
    showBoardsList();
    return;
  }

  showScreen('board');
  document.getElementById('boardNameTitle').textContent = currentBoardData.name;
  document.getElementById('settingsBtn').style.display = isOwner ? '' : 'none';

  const unsubCards = db.collection('boards').doc(boardId).collection('cards')
    .orderBy('createdAt')
    .onSnapshot(snap => {
      currentBoardCards = {};
      snap.forEach(d => { currentBoardCards[d.id] = { id: d.id, ...d.data() }; });
      renderBoard();
    }, err => console.error('cards listener error:', err));

  addListener(unsubCards);
}

document.getElementById('backBtn').addEventListener('click', () => {
  closeSettingsPanel();
  showBoardsList();
});

document.getElementById('shareBoardBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(location.href).then(() => {
    const btn = document.getElementById('shareBoardBtn');
    btn.textContent = '✅ コピーしました';
    setTimeout(() => { btn.textContent = '🔗 URLをコピー'; }, 2000);
  });
});

// --- Kanban Rendering ---
const LABEL_COLORS = {
  '': '#e0e0e0',
  red: '#ef5350',
  orange: '#ff9800',
  yellow: '#fdd835',
  green: '#66bb6a',
  blue: '#42a5f5',
  purple: '#ab47bc',
};

function renderBoard() {
  ['todo', 'inprogress', 'done'].forEach(col => {
    const container = document.getElementById(`cards-${col}`);
    const colCards = Object.values(currentBoardCards).filter(c => c.column === col);
    container.innerHTML = '';
    colCards.forEach(card => container.appendChild(buildCardEl(card)));
    document.getElementById(`count-${col}`).textContent = colCards.length;
  });
}

function buildCardEl(card) {
  const el = document.createElement('div');
  el.className = 'card';
  el.draggable = true;
  el.dataset.id = card.id;
  if (card.color) el.style.borderLeftColor = LABEL_COLORS[card.color] || LABEL_COLORS[''];

  const title = document.createElement('p');
  title.className = 'card-title';
  title.textContent = card.title;
  el.appendChild(title);

  if (card.dueDate) {
    const due = document.createElement('span');
    due.className = 'card-due';
    const isPast = card.dueDate < todayStr() && card.column !== 'done';
    if (isPast) due.classList.add('overdue');
    due.textContent = '📅 ' + card.dueDate;
    el.appendChild(due);
  }

  el.addEventListener('click', () => openEditModal(card));
  el.addEventListener('dragstart', e => {
    dragCardId = card.id;
    setTimeout(() => el.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    dragCardId = null;
  });
  return el;
}

// Drag and drop
document.querySelectorAll('.cards').forEach(zone => {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (!dragCardId) return;
    const newCol = zone.id.replace('cards-', '');
    if (currentBoardCards[dragCardId]?.column !== newCol) {
      db.collection('boards').doc(currentBoardId).collection('cards').doc(dragCardId).update({ column: newCol });
    }
  });
});

// --- Card Modal ---
const cardOverlay = document.getElementById('cardOverlay');
const cardTitleInput = document.getElementById('cardTitle');
const cardDueInput = document.getElementById('cardDue');

document.querySelectorAll('.add-btn').forEach(btn => {
  btn.addEventListener('click', () => openAddModal(btn.dataset.column));
});

function openAddModal(column) {
  editCardId = null;
  currentModalColumn = column;
  cardTitleInput.value = '';
  cardDueInput.value = '';
  document.getElementById('modalTitle').textContent = 'カードを追加';
  document.getElementById('deleteCardBtn').style.display = 'none';
  applyColorSelection('');
  cardOverlay.classList.add('visible');
  cardTitleInput.focus();
}

function openEditModal(card) {
  editCardId = card.id;
  currentModalColumn = card.column;
  cardTitleInput.value = card.title;
  cardDueInput.value = card.dueDate || '';
  document.getElementById('modalTitle').textContent = 'カードを編集';
  document.getElementById('deleteCardBtn').style.display = '';
  applyColorSelection(card.color || '');
  cardOverlay.classList.add('visible');
  cardTitleInput.focus();
}

function closeCardModal() { cardOverlay.classList.remove('visible'); }

function applyColorSelection(color) {
  selectedColor = color;
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === color);
  });
}

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => applyColorSelection(btn.dataset.color));
});

document.getElementById('cancelCardBtn').addEventListener('click', closeCardModal);
cardOverlay.addEventListener('click', e => { if (e.target === cardOverlay) closeCardModal(); });
document.getElementById('saveCardBtn').addEventListener('click', saveCard);
cardTitleInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveCard(); });

function saveCard() {
  const title = cardTitleInput.value.trim();
  if (!title) { cardTitleInput.focus(); return; }
  const cardsRef = db.collection('boards').doc(currentBoardId).collection('cards');
  if (editCardId) {
    cardsRef.doc(editCardId).update({ title, color: selectedColor, dueDate: cardDueInput.value || '' });
  } else {
    cardsRef.add({
      title,
      column: currentModalColumn,
      color: selectedColor,
      dueDate: cardDueInput.value || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
  closeCardModal();
}

document.getElementById('deleteCardBtn').addEventListener('click', () => {
  if (!editCardId) return;
  db.collection('boards').doc(currentBoardId).collection('cards').doc(editCardId).delete();
  closeCardModal();
});

// --- Settings Panel ---
document.getElementById('settingsBtn').addEventListener('click', openSettingsPanel);
document.getElementById('closeSettingsBtn').addEventListener('click', closeSettingsPanel);
document.getElementById('panelBackdrop').addEventListener('click', closeSettingsPanel);

function openSettingsPanel() {
  document.getElementById('boardNameInput').value = currentBoardData.name;
  renderMembersList();
  document.getElementById('settingsPanel').classList.remove('hidden');
  // アニメーション用
  requestAnimationFrame(() => document.getElementById('settingsPanel').classList.add('open'));
}

function closeSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.remove('open');
  setTimeout(() => panel.classList.add('hidden'), 250);
}

function renderMembersList() {
  const list = document.getElementById('membersList');
  list.innerHTML = '';

  const ownerEl = document.createElement('div');
  ownerEl.className = 'member-row';
  const ownerEmail = document.createElement('span');
  ownerEmail.textContent = currentBoardData.ownerEmail;
  const ownerBadge = document.createElement('span');
  ownerBadge.className = 'badge';
  ownerBadge.textContent = 'オーナー';
  ownerEl.appendChild(ownerEmail);
  ownerEl.appendChild(ownerBadge);
  list.appendChild(ownerEl);

  const emails = currentBoardData.memberEmails || [];
  if (emails.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'members-empty';
    empty.textContent = 'まだメンバーがいません';
    list.appendChild(empty);
    return;
  }

  emails.forEach(email => {
    const row = document.createElement('div');
    row.className = 'member-row';
    const emailSpan = document.createElement('span');
    emailSpan.textContent = email;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '削除';
    removeBtn.addEventListener('click', () => removeMember(email));
    row.appendChild(emailSpan);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

document.getElementById('saveBoardNameBtn').addEventListener('click', async () => {
  const name = document.getElementById('boardNameInput').value.trim();
  if (!name) return;
  await db.collection('boards').doc(currentBoardId).update({ name });
  currentBoardData.name = name;
  document.getElementById('boardNameTitle').textContent = name;
});

document.getElementById('inviteBtn').addEventListener('click', inviteMember);
document.getElementById('inviteEmail').addEventListener('keydown', e => { if (e.key === 'Enter') inviteMember(); });

async function inviteMember() {
  const email = document.getElementById('inviteEmail').value.trim().toLowerCase();
  if (!email || !email.includes('@')) { alert('正しいメールアドレスを入力してください'); return; }
  if (email === currentUser.email) { alert('自分自身は招待できません'); return; }
  if ((currentBoardData.memberEmails || []).includes(email)) { alert('すでに招待済みです'); return; }

  await db.collection('boards').doc(currentBoardId).update({
    memberEmails: firebase.firestore.FieldValue.arrayUnion(email)
  });
  currentBoardData.memberEmails = [...(currentBoardData.memberEmails || []), email];
  document.getElementById('inviteEmail').value = '';
  renderMembersList();
}

async function removeMember(email) {
  if (!confirm(`${email} をボードから削除しますか？`)) return;
  await db.collection('boards').doc(currentBoardId).update({
    memberEmails: firebase.firestore.FieldValue.arrayRemove(email)
  });
  currentBoardData.memberEmails = (currentBoardData.memberEmails || []).filter(e => e !== email);
  renderMembersList();
}

document.getElementById('deleteBoardBtn').addEventListener('click', async () => {
  if (!confirm(`「${currentBoardData.name}」を削除しますか？\nカードもすべて削除されます。この操作は元に戻せません。`)) return;
  const cardsSnap = await db.collection('boards').doc(currentBoardId).collection('cards').get();
  const batch = db.batch();
  cardsSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection('boards').doc(currentBoardId));
  await batch.commit();
  showBoardsList();
});

// --- Utility ---
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// SW登録
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
