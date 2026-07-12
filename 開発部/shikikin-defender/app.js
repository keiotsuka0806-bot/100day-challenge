// 敷金ディフェンダー — ルールベース・端末内完結（AI/サーバー不使用・コストゼロ）
(() => {
  'use strict';

  const STORE_KEY = 'shikikin_defender_v1';
  const SIZE_WARN = 3_800_000; // localStorage先回り警告の閾値（記憶庫: 3層防御パターン）

  const freshState = () => ({
    years: '',
    propertyName: '',
    myList: [],   // { itemId, memo, photos: [{src, date}] }
    album: [],    // { id, src, place, date }
  });

  let state = load();
  let activeCat = 'all';
  let searchQuery = '';

  // ---------- 保存・読込（巻き戻し＋破損退避） ----------
  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad shape');
      const base = freshState();
      return {
        ...base,
        ...parsed,
        myList: Array.isArray(parsed.myList) ? parsed.myList : [],
        album: Array.isArray(parsed.album) ? parsed.album : [],
      };
    } catch (e) {
      // 破損データは捨てずに退避してから初期化（記憶庫: 原子的インポート＋破損退避）
      try { if (raw) localStorage.setItem(STORE_KEY + '_broken', raw); } catch (_) { /* 退避先も溢れたら諦める */ }
      return freshState();
    }
  }

  function save() {
    try {
      const json = JSON.stringify(state);
      if (json.length > SIZE_WARN) {
        toast('⚠️ 保存容量が上限に近づいています。古い写真を削除してください');
      }
      localStorage.setItem(STORE_KEY, json);
      return true;
    } catch (e) {
      toast('❌ 保存できませんでした（容量オーバー）。写真を減らしてください');
      return false;
    }
  }

  // ---------- ユーティリティ ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  const BURDEN = {
    lender: { label: '大家さん負担', cls: 'pill-lender' },
    tenant: { label: '自分の負担になりやすい', cls: 'pill-tenant' },
    depends: { label: '条件次第', cls: 'pill-depends' },
  };

  function itemById(id) { return ITEMS.find((i) => i.id === id); }

  // 経過年数→借主負担割合の目安（耐用年数で直線償却・残存1円）
  function depCalcHTML(item) {
    if (!item.dep) return '';
    const y = parseFloat(state.years);
    const N = item.dep.years;
    let inner;
    if (!state.years || isNaN(y)) {
      inner = `この項目は<strong>${esc(item.dep.label)}＝耐用年数${N}年</strong>。上の「住んだ年数」を入れると負担割合の目安が出ます。`;
    } else if (y >= N) {
      inner = `${esc(item.dep.label)}の耐用年数は${N}年。<strong>${y}年住んだので残存価値はほぼ1円</strong>＝負担するとしてもごくわずか、が目安です。`;
    } else {
      const pct = Math.max(0, Math.round((1 - y / N) * 100));
      inner = `${esc(item.dep.label)}の耐用年数は${N}年。${y}年住んだので、負担するとしても<strong>新品価格の約${pct}%まで</strong>が目安です。`;
    }
    return `<div class="dep-calc">📉 ${inner}</div>`;
  }

  // ---------- しらべる画面 ----------
  function renderChips() {
    const chips = [{ id: 'all', name: 'すべて', emoji: '🗂️' }, ...CATEGORIES];
    $('#catChips').innerHTML = chips
      .map((c) => `<button class="chip ${activeCat === c.id ? 'active' : ''}" data-cat="${c.id}">${c.emoji} ${esc(c.name)}</button>`)
      .join('');
  }

  function renderItems() {
    const q = searchQuery.trim().toLowerCase();
    const list = ITEMS.filter((it) => {
      if (activeCat !== 'all' && it.cat !== activeCat) return false;
      if (!q) return true;
      return (it.title + it.basis + (it.tip || '')).toLowerCase().includes(q);
    });
    if (!list.length) {
      $('#itemList').innerHTML = '<div class="empty-state">見つかりませんでした。言葉を変えて探すか、カテゴリで一覧してみてください。</div>';
      return;
    }
    $('#itemList').innerHTML = list.map((it) => {
      const b = BURDEN[it.burden];
      const inList = state.myList.some((m) => m.itemId === it.id);
      return `
      <div class="item-card" data-id="${it.id}">
        <button class="item-head" aria-expanded="false">
          <span class="pill ${b.cls}">${b.label}</span>
          <span class="title">${esc(it.title)}</span>
        </button>
        <div class="item-body">
          <h4>ガイドラインの考え方</h4>
          <p>${esc(it.basis)}</p>
          ${it.range ? `<h4>負担する場合の範囲</h4><p>${esc(it.range)}</p>` : ''}
          ${depCalcHTML(it)}
          ${it.tip ? `<h4>💡 交渉ワンポイント</h4><p>${esc(it.tip)}</p>` : ''}
          <div class="item-actions">
            <button class="btn ${inList ? '' : 'btn-primary'}" data-add="${it.id}" ${inList ? 'disabled' : ''}>${inList ? '✓ うちのリストに追加済み' : '📋 うちのリストに追加'}</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ---------- うちのリスト画面 ----------
  function renderMyList() {
    $('#listCount').textContent = state.myList.length ? `(${state.myList.length})` : '';
    const box = $('#myListContainer');
    if (!state.myList.length) {
      box.innerHTML = '<div class="empty-state">まだ空です。<br>「🔎 しらべる」で気になる箇所を開いて<br>「うちのリストに追加」を押すとここに集まります。</div>';
      return;
    }
    box.innerHTML = state.myList.map((m, idx) => {
      const it = itemById(m.itemId);
      if (!it) return '';
      const b = BURDEN[it.burden];
      return `
      <div class="mylist-card" data-idx="${idx}">
        <h3><span class="pill ${b.cls}">${b.label}</span>${esc(it.title)}</h3>
        <p class="basis">${esc(it.basis)}</p>
        ${depCalcHTML(it)}
        <textarea data-memo="${idx}" placeholder="状況メモ（例: 6畳間の南側。入居時からあった気もする）">${esc(m.memo)}</textarea>
        <div class="mylist-photos">${m.photos.map((p, pi) => `<img src="${p.src}" alt="証拠写真" data-photo="${idx}:${pi}" title="タップで削除">`).join('')}</div>
        <div class="mylist-foot">
          <label class="btn photo-btn">📷 写真を付ける<input type="file" accept="image/*" data-file="${idx}" hidden></label>
          <button class="btn btn-danger" data-remove="${idx}">リストから外す</button>
        </div>
      </div>`;
    }).join('');
  }

  // ---------- 証拠アルバム画面 ----------
  function renderAlbum() {
    $('#albumCount').textContent = state.album.length ? `(${state.album.length})` : '';
    const grid = $('#albumGrid');
    if (!state.album.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">まだ写真がありません。<br>各部屋を明るくして、壁・床・水回りを撮っておきましょう。<br>掃除した後の状態も1枚あると強い証拠になります。</div>';
      return;
    }
    grid.innerHTML = state.album.map((p) => `
      <div class="album-item">
        <img src="${p.src}" alt="${esc(p.place || '記録写真')}">
        <div class="album-meta">
          <div class="place">${esc(p.place || '（場所未記入）')}</div>
          <div class="date">📅 ${esc(p.date)}</div>
          <button class="btn btn-danger" data-album-del="${p.id}">削除</button>
        </div>
      </div>`).join('');
  }

  // ---------- 交渉メモ画面 ----------
  function memoData() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return { dateStr };
  }

  function renderMemo() {
    const { dateStr } = memoData();
    const yearsTxt = state.years ? ($('#yearsInput').selectedOptions[0]?.textContent || `${state.years}年`) : '未入力';
    const items = state.myList.map((m) => ({ m, it: itemById(m.itemId) })).filter((x) => x.it);
    const itemsHTML = items.length
      ? items.map(({ m, it }) => {
          const b = BURDEN[it.burden];
          return `
          <div class="memo-item">
            <h3><span class="pill ${b.cls}">${b.label}</span>${esc(it.title)}</h3>
            <p><span class="label">根拠:</span> ${esc(it.basis)}</p>
            ${it.range ? `<p><span class="label">負担範囲の原則:</span> ${esc(it.range)}</p>` : ''}
            ${depCalcHTML(it)}
            ${m.memo ? `<p><span class="label">状況メモ:</span> ${esc(m.memo)}</p>` : ''}
            ${m.photos.length ? `<p><span class="label">証拠写真:</span> ${m.photos.length}枚あり（端末に保存）</p>` : ''}
          </div>`;
        }).join('')
      : '<p style="color:#66757f;">（「うちのリスト」がまだ空です。しらべる画面から追加すると、ここに根拠付きで並びます）</p>';

    $('#memoPreview').innerHTML = `
      <h2>🛡️ 退去立会い 交渉メモ</h2>
      <p class="memo-sub">作成日: ${dateStr} ${state.propertyName ? `／ 物件: ${esc(state.propertyName)}` : ''}／ 居住年数: ${esc(yearsTxt)}<br>${esc(GUIDELINE_VERSION)}</p>
      ${itemsHTML}
      <div class="memo-knowledge">
        <h3>📚 立会い前に押さえる4原則</h3>
        <ul>
          <li><strong>経年変化・通常の使い方の汚れは大家さん負担</strong>（家賃に含まれている、が国交省ガイドラインの基本）</li>
          <li>借主負担になる場合も<strong>「最低限の範囲」が原則</strong>（クロスは㎡単位・畳は1枚単位。全面張替は根拠を質問）</li>
          <li>クロス等は<strong>住んだ年数で価値が減る</strong>（多くは6年で残存1円）。新品全額の請求には再計算を求める</li>
          <li>納得できない請求は<strong>精算書（内訳）を書面で</strong>もらい、その場でサインしない。相談先: 消費者ホットライン <strong>188</strong></li>
        </ul>
        <p style="margin-top:8px; font-size:0.75rem; color:#66757f;">証拠アルバム: ${state.album.length}枚を端末に保存済み${state.album.length ? '（提示できます）' : ''}</p>
      </div>`;
  }

  function memoAsText() {
    const { dateStr } = memoData();
    const yearsTxt = state.years ? ($('#yearsInput').selectedOptions[0]?.textContent || `${state.years}年`) : '未入力';
    const lines = [
      '🛡️ 退去立会い 交渉メモ',
      `作成日: ${dateStr}${state.propertyName ? ` ／ 物件: ${state.propertyName}` : ''} ／ 居住年数: ${yearsTxt}`,
      GUIDELINE_VERSION, '',
    ];
    state.myList.forEach((m) => {
      const it = itemById(m.itemId);
      if (!it) return;
      lines.push(`■ ${it.title}【${BURDEN[it.burden].label}】`);
      lines.push(`  根拠: ${it.basis}`);
      if (it.range) lines.push(`  負担範囲の原則: ${it.range}`);
      if (m.memo) lines.push(`  状況メモ: ${m.memo}`);
      if (m.photos.length) lines.push(`  証拠写真: ${m.photos.length}枚あり`);
      lines.push('');
    });
    lines.push('【4原則】通常損耗は貸主負担／負担範囲は最低限の単位／経過年数で減価／内訳は書面で・相談は188');
    return lines.join('\n');
  }

  // ---------- 写真圧縮 ----------
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read error'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('image error'));
        img.onload = () => {
          const MAX = 900;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function nowStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ---------- イベント ----------
  function switchScreen(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.screen === name));
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
    if (name === 'mylist') renderMyList();
    if (name === 'album') renderAlbum();
    if (name === 'memo') renderMemo();
  }

  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) switchScreen(tab.dataset.screen);
  });

  $('#yearsInput').addEventListener('change', (e) => {
    const prev = state.years;
    state.years = e.target.value;
    if (!save()) { state.years = prev; e.target.value = prev; return; }
    $('#yearsNote').textContent = state.years
      ? '負担になる項目に「何%まで減るか」の目安を表示中'
      : '入力すると、負担になる項目でも「何%まで減るか」の目安が出ます';
    renderItems();
  });

  $('#searchInput').addEventListener('input', (e) => { searchQuery = e.target.value; renderItems(); });

  $('#catChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    activeCat = chip.dataset.cat;
    renderChips();
    renderItems();
  });

  $('#itemList').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const id = add.dataset.add;
      if (!state.myList.some((m) => m.itemId === id)) {
        state.myList.push({ itemId: id, memo: '', photos: [] });
        if (!save()) { state.myList.pop(); return; }
        renderItems();
        renderMyList();
        toast('📋 うちのリストに追加しました');
      }
      return;
    }
    const head = e.target.closest('.item-head');
    if (head) {
      const card = head.closest('.item-card');
      card.classList.toggle('open');
      head.setAttribute('aria-expanded', card.classList.contains('open') ? 'true' : 'false');
    }
  });

  const myListBox = $('#myListContainer');
  myListBox.addEventListener('change', async (e) => {
    if (e.target.matches('[data-file]')) {
      const idx = Number(e.target.dataset.file);
      const file = e.target.files[0];
      if (!file || !state.myList[idx]) return;
      try {
        const src = await compressImage(file);
        state.myList[idx].photos.push({ src, date: nowStamp() });
        if (!save()) { state.myList[idx].photos.pop(); return; }
        renderMyList();
        toast('📷 写真を付けました');
      } catch (_) { toast('❌ 写真を読み込めませんでした'); }
    }
  });
  myListBox.addEventListener('input', (e) => {
    if (e.target.matches('[data-memo]')) {
      const idx = Number(e.target.dataset.memo);
      if (!state.myList[idx]) return;
      const prev = state.myList[idx].memo;
      state.myList[idx].memo = e.target.value;
      if (!save()) { state.myList[idx].memo = prev; }
    }
  });
  myListBox.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const idx = Number(rm.dataset.remove);
      const removed = state.myList.splice(idx, 1);
      if (!save()) { state.myList.splice(idx, 0, ...removed); return; }
      renderMyList();
      renderItems();
      return;
    }
    const ph = e.target.closest('[data-photo]');
    if (ph) {
      const [idx, pi] = ph.dataset.photo.split(':').map(Number);
      if (!state.myList[idx]) return;
      if (!confirm('この写真を削除しますか？')) return;
      const removed = state.myList[idx].photos.splice(pi, 1);
      if (!save()) { state.myList[idx].photos.splice(pi, 0, ...removed); return; }
      renderMyList();
    }
  });

  $('#albumFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const src = await compressImage(file);
      const entry = { id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6), src, place: $('#photoPlace').value.trim(), date: nowStamp() };
      state.album.unshift(entry);
      if (!save()) { state.album.shift(); return; }
      $('#photoPlace').value = '';
      e.target.value = '';
      renderAlbum();
      toast('📷 アルバムに記録しました');
    } catch (_) { toast('❌ 写真を読み込めませんでした'); }
  });

  $('#albumGrid').addEventListener('click', (e) => {
    const del = e.target.closest('[data-album-del]');
    if (!del) return;
    if (!confirm('この写真を削除しますか？')) return;
    const idx = state.album.findIndex((p) => p.id === del.dataset.albumDel);
    if (idx < 0) return;
    const removed = state.album.splice(idx, 1);
    if (!save()) { state.album.splice(idx, 0, ...removed); return; }
    renderAlbum();
  });

  $('#propertyName').addEventListener('input', (e) => {
    const prev = state.propertyName;
    state.propertyName = e.target.value;
    if (!save()) { state.propertyName = prev; return; }
    renderMemo();
  });

  $('#printBtn').addEventListener('click', () => { renderMemo(); window.print(); });

  $('#copyBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(memoAsText());
      toast('📋 コピーしました。メールやLINEに貼れます');
    } catch (_) {
      toast('❌ コピーできませんでした');
    }
  });

  // ---------- 初期化 ----------
  $('#sourceNote').textContent = GUIDELINE_VERSION + '。本アプリは一般的な情報提供であり、個別の法律相談は専門家・消費者ホットライン188へ。';
  $('#yearsInput').value = state.years;
  $('#propertyName').value = state.propertyName;
  if (state.years) $('#yearsNote').textContent = '負担になる項目に「何%まで減るか」の目安を表示中';
  renderChips();
  renderItems();
  renderMyList();
  renderAlbum();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
})();
