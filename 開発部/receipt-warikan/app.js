const state = {
  members: [],
  items: [],
  adjustPercent: 0,
  pendingImage: null,
};

let seq = 0;
const newId = () => `id_${Date.now()}_${seq++}`;
const yen = (n) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

const $ = (id) => document.getElementById(id);

/* ---------- メンバー ---------- */
function addMember() {
  const name = $('memberName').value.trim();
  if (!name) return;
  state.members.push({ id: newId(), name });
  $('memberName').value = '';
  renderMembers();
  renderItems();
  renderTotals();
}

function removeMember(id) {
  state.members = state.members.filter((m) => m.id !== id);
  state.items.forEach((it) => {
    delete it.shares[id];
  });
  renderMembers();
  renderItems();
  renderTotals();
}

function renderMembers() {
  const box = $('memberList');
  box.textContent = '';
  state.members.forEach((m) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = m.name;
    const x = document.createElement('button');
    x.textContent = '×';
    x.setAttribute('aria-label', `${m.name} を削除`);
    x.onclick = () => removeMember(m.id);
    chip.appendChild(x);
    box.appendChild(chip);
  });
}

/* ---------- 品目 ---------- */
function addItem(name, price, qty) {
  const n = (name ?? $('itemName').value).trim();
  const p = Number(price ?? $('itemPrice').value);
  const q = Math.max(1, Math.round(Number(qty ?? $('itemQty').value) || 1));
  if (!n || !Number.isFinite(p) || p < 0) return;
  state.items.push({ id: newId(), name: n, unitPrice: p, qty: q, shares: {} });
  $('itemName').value = '';
  $('itemPrice').value = '';
  $('itemQty').value = '1';
  renderItems();
  renderTotals();
}

function changeQty(id, delta) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  it.qty = Math.max(1, it.qty + delta);
  renderItems();
  renderTotals();
}

// タップ数の合計（割り当ての重み）
const assignedCount = (it) => Object.values(it.shares).reduce((s, n) => s + n, 0);

function addUnit(itemId, memberId) {
  const it = state.items.find((i) => i.id === itemId);
  if (!it) return;
  it.shares[memberId] = (it.shares[memberId] || 0) + 1;
  renderItems();
  renderTotals();
}

function removeUnit(itemId, memberId) {
  const it = state.items.find((i) => i.id === itemId);
  if (!it || !it.shares[memberId]) return;
  it.shares[memberId] -= 1;
  if (it.shares[memberId] <= 0) delete it.shares[memberId];
  renderItems();
  renderTotals();
}

function removeItem(id) {
  state.items = state.items.filter((it) => it.id !== id);
  renderItems();
  renderTotals();
}

function renderItems() {
  const box = $('itemList');
  box.textContent = '';
  if (state.items.length === 0) {
    const e = document.createElement('p');
    e.className = 'empty';
    e.textContent = 'まだ品目がありません。レシートを読み取るか手入力で追加してください。';
    box.appendChild(e);
    return;
  }
  state.items.forEach((it) => {
    const row = document.createElement('div');
    row.className = 'item-row';

    const head = document.createElement('div');
    head.className = 'item-head';
    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = it.name;

    const stepper = document.createElement('span');
    stepper.className = 'qty-stepper';
    const minus = document.createElement('button');
    minus.textContent = '−';
    minus.setAttribute('aria-label', '数量を減らす');
    minus.onclick = () => changeQty(it.id, -1);
    const qtyLabel = document.createElement('span');
    qtyLabel.className = 'qty';
    qtyLabel.textContent = `×${it.qty}`;
    const plus = document.createElement('button');
    plus.textContent = '+';
    plus.setAttribute('aria-label', '数量を増やす');
    plus.onclick = () => changeQty(it.id, 1);
    stepper.append(minus, qtyLabel, plus);

    const price = document.createElement('span');
    price.className = 'item-price';
    price.textContent = yen(it.unitPrice * it.qty);

    const del = document.createElement('button');
    del.className = 'item-del';
    del.textContent = '🗑';
    del.setAttribute('aria-label', '品目を削除');
    del.onclick = () => removeItem(it.id);
    head.append(name, stepper, price, del);
    row.appendChild(head);

    if (state.members.length > 0) {
      const guide = document.createElement('p');
      guide.className = 'assign-guide';
      const assigned = assignedCount(it);
      if (assigned === 0) {
        guide.textContent = '食べた人をタップ（複数人なら山分け）。未選択なら全員で割り勘。';
      } else if (it.qty > 1) {
        guide.textContent = `タップした回数の比で分けます（多く食べた人は重ねてタップ＝${assigned}回ぶん）`;
      } else {
        guide.textContent = 'タップした人で山分けします。';
      }
      row.appendChild(guide);

      const ass = document.createElement('div');
      ass.className = 'assignees';
      state.members.forEach((m) => {
        const count = it.shares[m.id] || 0;
        const tag = document.createElement('span');
        tag.className = 'assignee' + (count > 0 ? ' on' : '');

        const label = document.createElement('span');
        label.className = 'assignee-label';
        label.textContent = count > 1 ? `${m.name} ×${count}` : m.name;
        label.onclick = () => addUnit(it.id, m.id);
        tag.appendChild(label);

        if (count > 0) {
          const minus = document.createElement('button');
          minus.className = 'assignee-minus';
          minus.textContent = '−';
          minus.setAttribute('aria-label', `${m.name} の割り当てを減らす`);
          minus.onclick = (e) => { e.stopPropagation(); removeUnit(it.id, m.id); };
          tag.appendChild(minus);
        }
        ass.appendChild(tag);
      });
      row.appendChild(ass);
    }
    box.appendChild(row);
  });
}

/* ---------- 計算 ---------- */
function computeTotals() {
  const totals = {};
  state.members.forEach((m) => (totals[m.id] = 0));
  if (state.members.length === 0) return { totals, grand: 0 };

  state.items.forEach((it) => {
    const lineTotal = it.unitPrice * it.qty;
    const totalWeight = assignedCount(it);
    if (totalWeight === 0) {
      // 誰も割り当てなければ全員で等分
      const share = lineTotal / state.members.length;
      state.members.forEach((m) => (totals[m.id] += share));
      return;
    }
    // タップ数の比で代金を分ける（1人なら全額、複数人なら山分け、個数差は重ねタップで反映）
    state.members.forEach((m) => {
      const w = it.shares[m.id] || 0;
      if (w > 0) totals[m.id] += lineTotal * (w / totalWeight);
    });
  });

  const factor = 1 + (Number(state.adjustPercent) || 0) / 100;
  let grand = 0;
  Object.keys(totals).forEach((id) => {
    totals[id] *= factor;
    grand += totals[id];
  });
  return { totals, grand };
}

// 各人の表示額(円)の合計が総額と一致するよう、最大剰余法で端数を配分する
function reconcileToYen(totals, grand) {
  const target = Math.round(grand);
  const ids = state.members.map((m) => m.id);
  const floors = {};
  let sumFloor = 0;
  ids.forEach((id) => {
    floors[id] = Math.floor(totals[id] || 0);
    sumFloor += floors[id];
  });
  let remainder = target - sumFloor;
  // 端数は小数部の大きい人から1円ずつ上乗せ(同点は元の金額が大きい順)
  const order = [...ids].sort((a, b) => {
    const fa = (totals[a] || 0) - Math.floor(totals[a] || 0);
    const fb = (totals[b] || 0) - Math.floor(totals[b] || 0);
    return fb - fa || (totals[b] || 0) - (totals[a] || 0);
  });
  for (let i = 0; i < order.length && remainder > 0; i += 1, remainder -= 1) {
    floors[order[i]] += 1;
  }
  return { perMember: floors, grand: target };
}

function renderTotals() {
  const { totals, grand } = computeTotals();
  const box = $('totals');
  box.textContent = '';
  if (state.members.length === 0) {
    const e = document.createElement('p');
    e.className = 'empty';
    e.textContent = 'メンバーを追加すると、一人あたりの金額が出ます。';
    box.appendChild(e);
    $('grandTotal').textContent = yen(0);
    persist();
    return;
  }
  const { perMember, grand: grandYen } = reconcileToYen(totals, grand);
  state.members.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'total-row';
    const name = document.createElement('span');
    name.textContent = m.name;
    const amt = document.createElement('span');
    amt.className = 'amount';
    amt.textContent = yen(perMember[m.id] || 0);
    row.append(name, amt);
    box.appendChild(row);
  });
  $('grandTotal').textContent = yen(grandYen);
  persist();
}

/* ---------- 画像とAI読み取り ---------- */
function resizeImage(file, maxSize = 1500) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const r = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  setStatus('画像を準備中…', 'busy');
  try {
    state.pendingImage = await resizeImage(file);
    $('previewImg').src = state.pendingImage;
    $('preview').classList.remove('hidden');
    setStatus('');
  } catch {
    setStatus('画像を読み込めませんでした。', 'error');
  }
}

async function scanReceipt() {
  if (!state.pendingImage) return;
  setStatus('AIがレシートを読み取っています…', 'busy');
  try {
    const res = await fetch('/api/parse-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: state.pendingImage }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) throw new Error('品目を読み取れませんでした');
    items.forEach((it) => addItem(it.name, it.price, it.qty));
    setStatus(`${items.length}件の品目を読み取りました。金額を確認してください。`);
    $('preview').classList.add('hidden');
    state.pendingImage = null;
  } catch (err) {
    setStatus('AI読み取りは未設定か失敗しました。「サンプルで試す」か手入力をお使いください。', 'error');
  }
}

function loadSample() {
  const sample = [
    { name: '生ビール', price: 600, qty: 3 },
    { name: 'ハイボール', price: 500, qty: 1 },
    { name: '唐揚げ', price: 720, qty: 1 },
    { name: 'シーザーサラダ', price: 680, qty: 1 },
    { name: '枝豆', price: 380, qty: 1 },
    { name: '締めのラーメン', price: 850, qty: 2 },
  ];
  sample.forEach((it) => addItem(it.name, it.price, it.qty));
  setStatus('サンプルの品目を読み込みました。誰が食べたかを割り当ててください。');
}

function setStatus(msg, kind = '') {
  const el = $('scanStatus');
  el.textContent = msg;
  el.className = 'status' + (kind ? ` ${kind}` : '');
}

/* ---------- 永続化（会計中に開き直しても消えない） ---------- */
const STORAGE_KEY = 'receipt_warikan_v1';

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      members: state.members,
      items: state.items,
      adjustPercent: state.adjustPercent,
    }));
  } catch {}
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data) return;
    if (Array.isArray(data.members)) state.members = data.members;
    if (Array.isArray(data.items)) {
      state.items = data.items.map((it) => ({
        id: it.id || newId(),
        name: String(it.name || ''),
        unitPrice: Number(it.unitPrice) || 0,
        qty: Math.max(1, Math.round(Number(it.qty) || 1)),
        shares: it.shares && typeof it.shares === 'object' ? it.shares : {},
      }));
    }
    if (data.adjustPercent != null) state.adjustPercent = data.adjustPercent;
  } catch {}
}

/* ---------- 結果のコピー（LINE等で共有） ---------- */
function copyResult() {
  if (state.members.length === 0) return;
  const { totals, grand } = computeTotals();
  const { perMember, grand: grandYen } = reconcileToYen(totals, grand);
  const lines = state.members.map((m) => `${m.name}: ${yen(perMember[m.id] || 0)}`);
  const text = `【割り勘】\n${lines.join('\n')}\n合計 ${yen(grandYen)}`;
  navigator.clipboard.writeText(text)
    .then(() => setStatus('結果をコピーしました。LINE等に貼り付けできます。'))
    .catch(() => setStatus('コピーできませんでした。手動で選択してください。', 'error'));
}

/* ---------- リセット ---------- */
function resetAll() {
  if (!confirm('入力をすべて消して最初からやり直しますか？')) return;
  state.members = [];
  state.items = [];
  state.adjustPercent = 0;
  state.pendingImage = null;
  $('adjustPercent').value = '0';
  $('preview').classList.add('hidden');
  setStatus('');
  renderMembers();
  renderItems();
  renderTotals();
}

/* ---------- 配線 ---------- */
function init() {
  $('addMemberBtn').onclick = addMember;
  $('memberName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addMember(); }
  });

  $('captureBtn').onclick = () => $('fileInput').click();
  $('fileInput').addEventListener('change', (e) => handleFile(e.target.files[0]));
  $('scanBtn').onclick = scanReceipt;
  $('sampleBtn').onclick = loadSample;

  $('addItemBtn').onclick = () => addItem();
  const onItemEnter = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addItem(); } };
  $('itemName').addEventListener('keydown', onItemEnter);
  $('itemPrice').addEventListener('keydown', onItemEnter);
  $('itemQty').addEventListener('keydown', onItemEnter);

  $('adjustPercent').addEventListener('input', (e) => {
    state.adjustPercent = e.target.value;
    renderTotals();
  });

  $('resetBtn').onclick = resetAll;
  $('copyResultBtn').onclick = copyResult;

  loadState();
  $('adjustPercent').value = state.adjustPercent || 0;
  renderMembers();
  renderItems();
  renderTotals();
}

init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
