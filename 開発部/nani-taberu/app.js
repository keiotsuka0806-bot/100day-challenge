// ── 状態 ──
const STAPLE_PFC = {
  rice:   { label: 'ごはん', icon: '🍚', p: 4, f: 1, c: 55 },
  bread:  { label: 'パン',   icon: '🍞', p: 8, f: 4, c: 48 },
  noodle: { label: '麺類',   icon: '🍜', p: 5, f: 1, c: 52 },
  none:   { label: null,     icon: null,  p: 0, f: 0, c: 0  },
};
let selectedStaple = 'rice';
let currentUser = null;
let recipes = FALLBACK_RECIPES;
let currentMealSet = null;
let selectedMoods = [];
let todayRecords = [];  // 本日の食事記録
let recentIds = new Set(); // 直近7日に食べたレシピID
let pfcTarget = { p: 120, f: 50, c: 250 };
let todayPfc = { p: 0, f: 0, c: 0 };
let db, auth;

// ── Firebase 初期化 ──
function initFirebase() {
  firebase.initializeApp(CONFIG.firebase);
  db   = firebase.firestore();
  auth = firebase.auth();

  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      showMain();
      loadUserData();
    } else {
      showLogin();
    }
  });
}

// ── 画面切り替え ──
function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainScreen').classList.remove('visible');
}

async function showMain() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainScreen').classList.add('visible');
  showLoading('レシピを読み込み中…');
  try {
    recipes = await loadRecipes();
  } catch (e) {
    console.error(e);
    showToast('レシピの読み込みに失敗しました');
  } finally {
    hideLoading();
  }
  renderPfcBars();
}

// ── ユーザーデータ読み込み ──
function loadUserData() {
  const uid = currentUser.uid;
  const today = todayStr();

  // ユーザー設定
  db.collection('users').doc(uid).get().then(doc => {
    if (doc.exists) pfcTarget = doc.data().pfcTarget || pfcTarget;
  });

  // 本日の記録
  db.collection('mealHistory').doc(uid).collection('records')
    .where('date', '==', today)
    .onSnapshot(snap => {
      todayRecords = snap.docs.map(d => d.data());
      todayPfc = sumPfc(todayRecords);
      renderPfcBars();
    });

  // 直近7日の記録
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  db.collection('mealHistory').doc(uid).collection('records')
    .where('date', '>=', sevenDaysAgo.toISOString().slice(0, 10))
    .get().then(snap => {
      recentIds = new Set();
      snap.docs.forEach(d => {
        const set = d.data().set || {};
        for (const dish of Object.values(set)) {
          if (dish?.id) recentIds.add(dish.id);
        }
      });
    });

  // 履歴リスト
  db.collection('mealHistory').doc(uid).collection('records')
    .orderBy('createdAt', 'desc').limit(20)
    .onSnapshot(snap => {
      renderHistory(snap.docs.map(d => d.data()));
    });
}

// ── PFC バー描画 ──
function renderPfcBars() {
  const keys = ['p', 'f', 'c'];
  const labels = ['P', 'F', 'C'];
  keys.forEach((k, i) => {
    const pct = Math.min(100, Math.round((todayPfc[k] / pfcTarget[k]) * 100));
    const fill = document.getElementById(`pfc-fill-${k}`);
    const pctEl = document.getElementById(`pfc-pct-${k}`);
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  });
}

// ── 主食選択 ──
function selectStaple(key, el) {
  selectedStaple = key;
  document.querySelectorAll('.staple-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (currentMealSet) renderMealSet(currentMealSet, false);
}

// ── タグ選択 ──
function toggleMood(tag, el) {
  if (selectedMoods.includes(tag)) {
    selectedMoods = selectedMoods.filter(t => t !== tag);
    el.classList.remove('active');
  } else {
    selectedMoods.push(tag);
    el.classList.add('active');
  }
}

// ── 献立を決める ──
async function decideMeal() {
  if (recipes.soup.length === 0 && recipes.main.length === 0) {
    showToast('レシピがまだ読み込まれていません');
    return;
  }
  const pfcDeficit = {
    p: pfcTarget.p - todayPfc.p,
    f: pfcTarget.f - todayPfc.f,
    c: pfcTarget.c - todayPfc.c,
  };
  currentMealSet = buildMealSetNoDuplicate(recipes, selectedMoods, recentIds, pfcDeficit);
  renderMealSet(currentMealSet, true);
}

// ── 1品削除 ──
function removeDish(role) {
  if (!currentMealSet) return;
  currentMealSet[role] = null;
  renderMealSet(currentMealSet, false);
}

// ── 1品だけ再抽選 ──
function rerollDish(role) {
  if (!currentMealSet) return;
  const pfcDeficit = { p: pfcTarget.p - todayPfc.p, f: pfcTarget.f - todayPfc.f, c: pfcTarget.c - todayPfc.c };
  const exclude = role === 'side1' ? currentMealSet.side2?.id : (role === 'side2' ? currentMealSet.side1?.id : null);
  const pool = role.startsWith('side')
    ? recipes.side.filter(r => r.id !== exclude)
    : recipes[role === 'soup' ? 'soup' : 'main'];
  const picked = pickOne(pool, selectedMoods, recentIds, pfcDeficit);
  if (picked) currentMealSet[role] = picked;
  renderMealSet(currentMealSet, false);
}

// ── 献立カード描画 ──
function renderMealSet(mealSet, animate) {
  const container = document.getElementById('mealSetContainer');
  const footer    = document.getElementById('mealFooter');

  const dishes = [
    { role: 'soup',  icon: '🍲', label: '汁物',  data: mealSet.soup  },
    { role: 'main',  icon: '🥩', label: '主菜',  data: mealSet.main  },
    { role: 'side1', icon: '🥗', label: '副菜①', data: mealSet.side1 },
    { role: 'side2', icon: '🥗', label: '副菜②', data: mealSet.side2 },
  ];

  container.innerHTML = `
    ${selectedStaple !== 'none' ? `
    <div class="meal-row">
      <span class="meal-icon">${STAPLE_PFC[selectedStaple].icon}</span>
      <div class="meal-info">
        <div class="meal-name">${STAPLE_PFC[selectedStaple].label}</div>
        <div class="meal-pfc">P ${STAPLE_PFC[selectedStaple].p}g / F ${STAPLE_PFC[selectedStaple].f}g / C ${STAPLE_PFC[selectedStaple].c}g</div>
      </div>
    </div>` : ''}
    ${dishes.map(d => d.data ? `
      <div class="meal-row${animate ? ' slot-in' : ''}" id="dish-row-${d.role}">
        <span class="meal-icon">${d.icon}</span>
        <div class="meal-info">
          <div class="meal-name">${escHtml(d.data.title)}</div>
          <div class="meal-pfc">P ${d.data.pfc.p}g / F ${d.data.pfc.f}g / C ${d.data.pfc.c}g</div>
        </div>
        <div class="meal-actions">
          <button class="btn-icon" onclick="openRecipe('${d.data.id}')">📖</button>
          <button class="btn-icon btn-reroll" onclick="rerollDish('${d.role}')">↺</button>
          <button class="btn-icon btn-remove" onclick="removeDish('${d.role}')">✕</button>
        </div>
      </div>
    ` : '').join('')}
  `;

  container.classList.remove('hidden');
  footer.classList.remove('hidden');

  const total = calcTotalPfc(mealSet, STAPLE_PFC[selectedStaple]);
  document.getElementById('totalPfc').textContent = `P ${total.p}g / F ${total.f}g / C ${total.c}g`;
}

// ── 食べた！ボタン ──
async function markAte(timing) {
  if (!currentMealSet || !currentUser) return;
  const total = calcTotalPfc(currentMealSet);
  const record = {
    date: todayStr(),
    timing,
    set: {
      soup:  currentMealSet.soup  ? { id: currentMealSet.soup.id,  name: currentMealSet.soup.title,  pfc: currentMealSet.soup.pfc  } : null,
      main:  currentMealSet.main  ? { id: currentMealSet.main.id,  name: currentMealSet.main.title,  pfc: currentMealSet.main.pfc  } : null,
      side1: currentMealSet.side1 ? { id: currentMealSet.side1.id, name: currentMealSet.side1.title, pfc: currentMealSet.side1.pfc } : null,
      side2: currentMealSet.side2 ? { id: currentMealSet.side2.id, name: currentMealSet.side2.title, pfc: currentMealSet.side2.pfc } : null,
    },
    totalPfc: total,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('mealHistory').doc(currentUser.uid).collection('records').add(record);
  showToast('記録しました！');
  currentMealSet = null;
  document.getElementById('mealSetContainer').innerHTML = '';
  document.getElementById('mealFooter').classList.add('hidden');
}

// ── 食事タイミング選択 ──
function showTimingPicker() {
  document.getElementById('timingModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTimingPicker() {
  document.getElementById('timingModal').classList.remove('open');
  document.body.style.overflow = '';
}

function selectTiming(key) {
  closeTimingPicker();
  markAte(key);
}

// ── レシピモーダル ──
function openRecipe(recipeId) {
  const all = [...recipes.soup, ...recipes.main, ...recipes.side];
  const recipe = all.find(r => String(r.id) === String(recipeId));
  if (!recipe) return;

  const modal = document.getElementById('recipeModal');
  document.getElementById('modalTitle').textContent = recipe.title;
  document.getElementById('modalImg').src = recipe.image || '';
  document.getElementById('modalImg').style.display = recipe.image ? 'block' : 'none';
  document.getElementById('modalIngredients').innerHTML =
    (recipe.materials || []).map(m => `<span class="ingredient-chip">${escHtml(m)}</span>`).join('');
  document.getElementById('modalDescription').textContent = recipe.description || '';
  const linkEl = document.getElementById('modalLink');
  if (recipe.url && recipe.url !== '#') {
    linkEl.style.display = 'block';
    linkEl.href = recipe.url;
  } else {
    linkEl.style.display = 'none';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeRecipe() {
  document.getElementById('recipeModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── 履歴描画 ──
function renderHistory(records) {
  const list = document.getElementById('historyList');
  if (records.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🍽️</div><p>まだ記録がありません</p></div>`;
    return;
  }
  list.innerHTML = records.map(r => {
    const dishes = Object.values(r.set || {}).filter(Boolean).map(d => d.name).join('・');
    const timing = { breakfast:'朝食', lunch:'昼食', dinner:'夕食' }[r.timing] || r.timing;
    return `
      <div class="history-item">
        <div class="history-date">${r.date} ${timing}</div>
        <div class="history-dishes">${escHtml(dishes)}</div>
        <div class="meal-pfc" style="margin-top:.25rem">P ${r.totalPfc?.p||0}g / F ${r.totalPfc?.f||0}g / C ${r.totalPfc?.c||0}g</div>
      </div>
    `;
  }).join('');
}

// ── タブ切り替え ──
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`nav-${tab}`).classList.add('active');
}

// ── ユーティリティ ──
function todayStr() {
  return new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '-').replace(/(\d)-(\d{1})-/, '$1-0$2-').replace(/-(\d)$/, '-0$1');
}

function sumPfc(records) {
  const total = { p: 0, f: 0, c: 0 };
  for (const r of records) {
    if (r.totalPfc) {
      total.p += r.totalPfc.p || 0;
      total.f += r.totalPfc.f || 0;
      total.c += r.totalPfc.c || 0;
    }
  }
  return total;
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showLoading(msg) {
  const el = document.getElementById('loadingOverlay');
  document.getElementById('loadingMsg').textContent = msg || '読み込み中…';
  el.style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── 起動 ──
document.addEventListener('DOMContentLoaded', initFirebase);
