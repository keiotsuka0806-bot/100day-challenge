// app.js — VinRoute ゲームロジック

// ===== 定数 =====
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

const BUILDINGS = {
  vineyard: {
    name: '畑',
    icon: '🌿',
    cost: { pinot: 1, cabernet: 1 },
    costLabel: 'ピノ×1 + カベルネ×1',
    effect: '通過時にこの産地のリソース+1',
    limit: 1
  },
  winery: {
    name: '醸造所',
    icon: '🍾',
    cost: { cabernet: 1, chardonnay: 1, blend: 1 },
    costLabel: 'カベルネ×1 + シャルドネ×1 + ブレンド×1',
    effect: 'ワインの醸造が可能になる',
    limit: 1
  },
  cellar: {
    name: 'セラー',
    icon: '🏛️',
    cost: { riesling: 2, blend: 2 },
    costLabel: 'リースリング×2 + ブレンド×2',
    effect: '醸造ワインの勝利点+1',
    limit: 1
  }
};

const WINE_RECIPES = [
  { id: 'bordeaux_blend', name: 'ボルドー・ブレンド', cost: { cabernet: 2, blend: 1 }, vp: 3, desc: '力強い赤ワイン' },
  { id: 'bourgogne',      name: 'ブルゴーニュ',      cost: { pinot: 3 },               vp: 4, desc: '気品ある単一品種' },
  { id: 'champagne',      name: 'シャンパーニュ',    cost: { chardonnay: 2, riesling: 1 }, vp: 3, desc: '優雅な泡' },
  { id: 'rose',           name: 'スパークリング・ロゼ', cost: { pinot: 1, chardonnay: 1 }, vp: 2, desc: '軽やかなロゼ' },
  { id: 'grand_cru',      name: 'グランクリュ',      cost: { cabernet: 1, pinot: 1, chardonnay: 1, riesling: 1, blend: 1 }, vp: 6, desc: '究極の1本' },
  { id: 'koshu',          name: '甲州ワイン',         cost: { riesling: 1, blend: 2 },   vp: 2, desc: '和食と合う日本ワイン' }
];

const EVENT_CARDS = [
  { id: 'harvest',     name: '豊作 🌞',         desc: '自分の畑がある全産地からリソース+1取得',             effect: 'harvest' },
  { id: 'frost',       name: '霜害 ❄️',          desc: '任意の相手プレイヤーのリソースを1種類減らす',       effect: 'frost' },
  { id: 'parker',      name: 'パーカー登場 🍷',  desc: '現在最多勝利点のプレイヤーが+1点',                  effect: 'parker' },
  { id: 'scandal',     name: 'スキャンダル 📰',  desc: '全プレイヤーのブレンドが半分に',                   effect: 'scandal' },
  { id: 'climate',     name: '気候変動 🌡️',      desc: 'ランダムな産地のリソース種が変わる',               effect: 'climate' },
  { id: 'bonby',       name: '貧乏神 👹',         desc: '最下位プレイヤーの次ターン移動-1',                 effect: 'bonby' },
  { id: 'trade_winds', name: '貿易風 🌬️',        desc: '任意の産地に無料でテレポート移動できる',           effect: 'trade_winds' },
  { id: 'wine_fair',   name: 'ワイン見本市 🏪',  desc: '全リソースを1種類につき+1取得',                    effect: 'wine_fair' },
  { id: 'quiz_card',   name: 'ソムリエ試験 📋',  desc: 'クイズに正解で+1勝利点',                           effect: 'quiz' }
];

const SEASONS_TOTAL = 5;
const TURNS_PER_SEASON = 4;

// ===== 状態 =====
let gs = null; // gameState
let canvas, ctx;
let animFrameId = null;

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('mapCanvas');
  setupLobby();
  document.getElementById('playAgainBtn').addEventListener('click', () => { stopAnimLoop(); gs = null; showScreen('lobbyScreen'); });
});

function setupLobby() {
  const countBtns = document.querySelectorAll('.count-btn');
  countBtns.forEach(btn => btn.addEventListener('click', () => {
    countBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPlayerSetup(parseInt(btn.dataset.count));
  }));
  renderPlayerSetup(2);
  document.getElementById('startGameBtn').addEventListener('click', startGame);
  document.getElementById('howToPlayBtn').addEventListener('click', () => {
    document.getElementById('howToOverlay').classList.remove('hidden');
  });
}

function renderPlayerSetup(count) {
  const container = document.getElementById('playerSetup');
  const defaultNames = ['アリス', 'ボブ', 'チャーリー', 'ダイアナ'];
  const defaultAI = [false, true, true, true];
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'player-input-row';
    const ai = defaultAI[i];
    row.innerHTML = `
      <div class="player-color-dot" style="background:${PLAYER_COLORS[i]}"></div>
      <input class="player-name-input" type="text" placeholder="プレイヤー${i+1}の名前"
             value="${defaultNames[i]}" data-player="${i}"${ai ? ' disabled' : ''}>
      <button class="ai-toggle${ai ? ' ai-on' : ''}" data-player="${i}">${ai ? '🤖' : '👤'}</button>
    `;
    container.appendChild(row);
  }
  container.querySelectorAll('.ai-toggle').forEach(btn => {
    btn.onclick = () => {
      btn.classList.toggle('ai-on');
      const on = btn.classList.contains('ai-on');
      btn.textContent = on ? '🤖' : '👤';
      const inp = container.querySelector(`input[data-player="${btn.dataset.player}"]`);
      if (inp) inp.disabled = on;
    };
  });
}

function startGame() {
  const inputs = document.querySelectorAll('.player-name-input');
  const names = Array.from(inputs).map(el => el.value.trim() || `P${parseInt(el.dataset.player)+1}`);
  const aiFlags = Array.from(document.querySelectorAll('.ai-toggle')).map(b => b.classList.contains('ai-on'));
  initGame(names, aiFlags);
}

// ===== ゲーム初期化 =====
function initGame(playerNames, aiFlags = []) {
  const regionIds = Object.keys(REGION_DATA);
  const shuffled = shuffleArray([...regionIds]);
  const startPositions = shuffled.slice(0, playerNames.length);

  gs = {
    players: playerNames.map((name, i) => ({
      id: `p${i}`,
      name,
      color: PLAYER_COLORS[i],
      position: startPositions[i],
      resources: { cabernet: 1, pinot: 1, chardonnay: 1, riesling: 1, blend: 1 },
      buildings: [],
      wines: [],
      vp: 0,
      bonbyPenalty: 0,
      isAI: aiFlags[i] || false
    })),
    regions: buildRegionState(),
    currentPlayerIndex: 0,
    phase: 'roll',
    diceResult: null,
    stepsLeft: 0,
    reachableRegions: [],
    destination: pickDestination(null),
    turn: 1,
    season: 1,
    turnInSeason: 1,
    log: []
  };

  setupGameEventListeners();
  showScreen('gameScreen');
  setupCanvas();
  setPhase('roll');
  renderAll();
  startAnimLoop();
  addLog(`ゲーム開始！${SEASONS_TOTAL}シーズン終了時の最多VP勝利です。`, null);
  addLog(`--- シーズン1・ターン1 / ${gs.players[0].name}のターン ---`, null);
  if (currentPlayer().isAI) setTimeout(() => aiTakeTurn(), 1200);
}

function buildRegionState() {
  const state = {};
  for (const [id, r] of Object.entries(REGION_DATA)) {
    state[id] = { ...r, buildings: {} };
  }
  return state;
}

function pickDestination(exclude) {
  const ids = Object.keys(REGION_DATA).filter(id => id !== exclude);
  return ids[Math.floor(Math.random() * ids.length)];
}

// ===== Canvas セットアップ =====
function setupCanvas() {
  // 論理解像度を固定（CSS の position:absolute width/height:100% が表示サイズを決める）
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  canvas.onclick = onCanvasClick;
  canvas.onmousemove = onCanvasHover;
  canvas.onmouseleave = () => {
    document.getElementById('regionTooltip').style.display = 'none';
  };
}

function getCanvasXY(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function onCanvasHover(e) {
  const pos = getCanvasXY(e);
  const regionId = getRegionAtPoint(pos.x, pos.y);
  const tooltip = document.getElementById('regionTooltip');
  if (regionId) {
    const r = REGION_DATA[regionId];
    const buildings = gs ? (gs.regions[regionId].buildings || {}) : {};
    const bList = Object.keys(buildings).map(k => BUILDINGS[k]?.icon + BUILDINGS[k]?.name).join(' ');
    tooltip.innerHTML = `
      <div class="tt-name">${r.name}</div>
      <div class="tt-country">${r.country}</div>
      <div>${RESOURCE_ICONS[r.resource]} ${RESOURCE_NAMES[r.resource]}</div>
      ${bList ? `<div>${bList}</div>` : ''}
    `;
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top = (e.clientY - 10) + 'px';
  } else {
    tooltip.style.display = 'none';
  }
}

function onCanvasClick(e) {
  if (!gs || gs.phase !== 'move' || currentPlayer().isAI) return;
  const pos = getCanvasXY(e);
  const regionId = getRegionAtPoint(pos.x, pos.y);
  if (regionId && gs.reachableRegions.includes(regionId)) {
    movePlayerTo(regionId);
  }
}

// ===== イベントリスナー =====
function setupGameEventListeners() {
  const guard = fn => () => { if (gs && !currentPlayer().isAI) fn(); };
  document.getElementById('rollBtn').onclick = guard(rollDice);
  document.getElementById('skipMoveBtn').onclick = guard(skipMovement);
  document.getElementById('buildBtn').onclick = guard(openBuildModal);
  document.getElementById('brewBtn').onclick = guard(openBrewModal);
  document.getElementById('quizBtn').onclick = guard(() => openQuizModal('action'));
  document.getElementById('endTurnBtn').onclick = guard(endTurn);
  document.getElementById('closeEventBtn').onclick = closeEvent;
  document.getElementById('helpBtn').onclick = () => {
    document.getElementById('howToOverlay').classList.remove('hidden');
  };

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = () => {
      document.getElementById(btn.dataset.modal).classList.add('hidden');
    };
  });
}

// ===== ターンフロー =====
function rollDice() {
  const p = currentPlayer();
  const penalty = p.bonbyPenalty || 0;

  const d1 = Math.ceil(Math.random() * 6);
  const d2 = Math.ceil(Math.random() * 6);
  const total = Math.max(1, d1 + d2 - penalty);

  if (penalty > 0) {
    p.bonbyPenalty = 0;
    addLog(`${p.name}に貧乏神のペナルティ！移動-${penalty}`, p);
  }

  // サイコロアニメーション
  const die1El = document.getElementById('die1');
  const die2El = document.getElementById('die2');
  die1El.classList.add('rolling');
  die2El.classList.add('rolling');
  setTimeout(() => {
    die1El.textContent = d1;
    die2El.textContent = d2;
    die1El.classList.remove('rolling');
    die2El.classList.remove('rolling');
  }, 400);

  gs.diceResult = { d1, d2, total };
  gs.stepsLeft = total;
  gs.phase = 'move';
  gs.reachableRegions = getReachable(p.position, 1);

  addLog(`${p.name}がサイコロを振った: ${d1}+${d2}=${total}`, p);

  setTimeout(() => {
    setPhase('move');
    renderAll();
  }, 450);
}

function getReachable(posId, steps) {
  const region = REGION_DATA[posId];
  if (!region) return [];
  return region.adjacent.filter(id => REGION_DATA[id]);
}

function movePlayerTo(regionId) {
  const p = currentPlayer();
  const prevPos = p.position;
  p.position = regionId;
  gs.stepsLeft--;

  // 通過した産地に畑があればリソースを取得
  for (const [pid, region] of Object.entries(gs.regions)) {
    if (pid === regionId && region.buildings.vineyard) {
      const owner = region.buildings.vineyard;
      const ownerPlayer = gs.players.find(pl => pl.id === owner);
      if (ownerPlayer) {
        ownerPlayer.resources[region.resource]++;
        addLog(`${ownerPlayer.name}の畑から${RESOURCE_NAMES[region.resource]}+1`, ownerPlayer);
      }
    }
  }

  addLog(`${p.name}が${REGION_DATA[regionId].name}へ移動`, p);

  if (gs.stepsLeft > 0) {
    gs.reachableRegions = getReachable(regionId, 1);
    document.getElementById('stepsLeft').textContent = gs.stepsLeft;
  } else {
    // 移動終了 → アクションフェーズへ
    gs.reachableRegions = [];
    enterActionPhase();
  }
  renderAll();
}

function skipMovement() {
  gs.stepsLeft = 0;
  gs.reachableRegions = [];
  enterActionPhase();
  renderAll();
}

function enterActionPhase() {
  const p = currentPlayer();
  const region = REGION_DATA[p.position];
  gs.phase = 'action';

  // 着地リソースを取得
  const res = region.resource;
  p.resources[res]++;
  addLog(`${p.name}が${region.name}で${RESOURCE_NAMES[res]}を取得！`, p);

  // 目的地ボーナス
  if (p.position === gs.destination) {
    p.vp += 2;
    addLog(`${p.name}が今月の銘醸地に到達！+2点！`, p);
    gs.destination = pickDestination(p.position);
    checkVictory();
  }

  // 畑ボーナス（3つ所有で+2VP、一度だけ）
  const ownedVineyards = gs.players.filter((_, idx) => idx === gs.currentPlayerIndex)[0].buildings
    .filter(b => b.type === 'vineyard').length;
  if (ownedVineyards >= 3 && !p._vineyard3bonus) {
    p._vineyard3bonus = true;
    p.vp += 2;
    addLog(`${p.name}が畑3つ達成ボーナス！+2点！`, p);
    checkVictory();
  }

  setPhase('action');
}

function endTurn() {
  gs.phase = 'event';
  drawEventCard();
}

function drawEventCard() {
  const card = EVENT_CARDS[Math.floor(Math.random() * EVENT_CARDS.length)];
  gs.currentEvent = card;
  setPhase('event');

  const el = document.getElementById('eventCard');
  el.innerHTML = `<div class="event-name">${card.name}</div><div>${card.desc}</div>`;
  addLog(`イベント: ${card.name}`, null);
}

function closeEvent() {
  const card = gs.currentEvent;
  const quizPending = card?.effect === 'quiz';
  if (card) applyEvent(card);
  gs.currentEvent = null;
  if (!quizPending) nextPlayer();
}

function applyEvent(card) {
  const p = currentPlayer();
  switch (card.effect) {
    case 'harvest':
      p.buildings.filter(b => b.type === 'vineyard').forEach(b => {
        const res = REGION_DATA[b.regionId]?.resource;
        if (res) { p.resources[res]++; addLog(`豊作: ${p.name}が${RESOURCE_NAMES[res]}+1`, p); }
      });
      break;
    case 'frost':
      // 相手が1人以上いれば対象選択（簡易: ランダム相手）
      const opponents = gs.players.filter((_, i) => i !== gs.currentPlayerIndex);
      if (opponents.length > 0) {
        const target = opponents[Math.floor(Math.random() * opponents.length)];
        const resKeys = Object.keys(target.resources).filter(k => target.resources[k] > 0);
        if (resKeys.length > 0) {
          const rk = resKeys[Math.floor(Math.random() * resKeys.length)];
          target.resources[rk] = Math.max(0, target.resources[rk] - 1);
          addLog(`霜害: ${target.name}の${RESOURCE_NAMES[rk]}-1`, null);
        }
      }
      break;
    case 'parker':
      const maxVp = Math.max(...gs.players.map(pl => pl.vp));
      const leaders = gs.players.filter(pl => pl.vp === maxVp);
      leaders.forEach(pl => { pl.vp++; addLog(`パーカー: ${pl.name}に+1点`, pl); });
      checkVictory();
      break;
    case 'scandal':
      gs.players.forEach(pl => { pl.resources.blend = Math.floor(pl.resources.blend / 2); });
      addLog('スキャンダル: 全員のブレンドが半分に', null);
      break;
    case 'climate': {
      const rIds = Object.keys(gs.regions);
      const rId = rIds[Math.floor(Math.random() * rIds.length)];
      const resOptions = ['cabernet', 'pinot', 'chardonnay', 'riesling', 'blend'];
      const newRes = resOptions[Math.floor(Math.random() * resOptions.length)];
      gs.regions[rId].resource = newRes;
      REGION_DATA[rId].resource = newRes;
      addLog(`気候変動: ${REGION_DATA[rId].name}のリソースが${RESOURCE_NAMES[newRes]}に変化`, null);
      break;
    }
    case 'bonby':
      const lowestVp = Math.min(...gs.players.map(pl => pl.vp));
      const losers = gs.players.filter(pl => pl.vp === lowestVp);
      losers.forEach(pl => { pl.bonbyPenalty = (pl.bonbyPenalty || 0) + 1; addLog(`貧乏神: ${pl.name}の次ターン移動-1`, null); });
      break;
    case 'trade_winds':
      // 現在プレイヤーをランダムな産地に移動
      const destIds = Object.keys(REGION_DATA).filter(id => id !== p.position);
      const newPos = destIds[Math.floor(Math.random() * destIds.length)];
      p.position = newPos;
      addLog(`貿易風: ${p.name}が${REGION_DATA[newPos].name}へ移動`, p);
      break;
    case 'wine_fair':
      Object.keys(p.resources).forEach(k => p.resources[k]++);
      addLog(`ワイン見本市: ${p.name}が全リソース+1`, p);
      break;
    case 'quiz':
      if (p.isAI) { aiAutoQuiz(); } else { openQuizModal('event'); }
      return;
  }
  renderAll();
}

function nextPlayer() {
  gs.currentPlayerIndex = (gs.currentPlayerIndex + 1) % gs.players.length;
  if (gs.currentPlayerIndex === 0) {
    gs.turn++;
    gs.turnInSeason++;
    if (gs.turnInSeason > TURNS_PER_SEASON) {
      gs.turnInSeason = 1;
      if (gs.season >= SEASONS_TOTAL) {
        const winner = [...gs.players].sort((a, b) => b.vp - a.vp)[0];
        showVictory(winner);
        return;
      }
      gs.season++;
      addLog(`🍂 シーズン${gs.season - 1}終了 — 収穫祭！全畑から追加収穫`, null);
      harvestFestival();
      gs.destination = pickDestination(gs.destination);
      addLog(`🎯 新しい目的地: ${REGION_DATA[gs.destination].name}`, null);
    }
  }
  gs.phase = 'roll';
  gs.diceResult = null;
  gs.stepsLeft = 0;
  gs.reachableRegions = [];
  document.getElementById('die1').textContent = '🎲';
  document.getElementById('die2').textContent = '🎲';
  setPhase('roll');
  renderAll();
  addLog(`--- S${gs.season}・T${gs.turnInSeason} / ${currentPlayer().name}のターン ---`, null);
  if (currentPlayer().isAI) setTimeout(() => aiTakeTurn(), 800);
}

function harvestFestival() {
  for (const p of gs.players) {
    let gained = 0;
    for (const b of p.buildings) {
      if (b.type === 'vineyard') {
        const res = gs.regions[b.regionId]?.resource || REGION_DATA[b.regionId]?.resource;
        if (res) { p.resources[res] = (p.resources[res] || 0) + 1; gained++; }
      }
    }
    if (gained > 0) addLog(`収穫祭: ${p.name}が${gained}リソース収穫`, p);
  }
}

// ===== 建設 =====
function openBuildModal() {
  const p = currentPlayer();
  const regionId = p.position;
  const region = gs.regions[regionId];
  const container = document.getElementById('buildOptions');
  container.innerHTML = '';
  document.getElementById('buildRegionName').textContent = REGION_DATA[regionId].name + 'に建設';

  for (const [type, def] of Object.entries(BUILDINGS)) {
    const alreadyBuilt = region.buildings[type];
    const canAfford = canPay(p.resources, def.cost);
    const card = document.createElement('button');
    card.className = 'option-card';
    card.disabled = alreadyBuilt || !canAfford;

    let statusText = '';
    if (alreadyBuilt) statusText = '（建設済み）';
    else if (!canAfford) statusText = '（リソース不足）';

    card.innerHTML = `
      <div class="opt-name">${def.icon} ${def.name} ${statusText}</div>
      <div class="opt-cost">コスト: ${def.costLabel}</div>
      <div class="opt-effect">${def.effect}</div>
    `;
    if (!alreadyBuilt && canAfford) {
      card.onclick = () => { buildAt(type, regionId); document.getElementById('buildModal').classList.add('hidden'); };
    }
    container.appendChild(card);
  }

  document.getElementById('buildModal').classList.remove('hidden');
}

function buildAt(type, regionId) {
  const p = currentPlayer();
  const def = BUILDINGS[type];
  payResources(p.resources, def.cost);
  gs.regions[regionId].buildings[type] = p.id;
  p.buildings.push({ type, regionId });
  addLog(`${p.name}が${REGION_DATA[regionId].name}に${def.icon}${def.name}を建設`, p);
  renderAll();
}

// ===== 醸造 =====
function openBrewModal() {
  const p = currentPlayer();
  const regionId = p.position;
  const hasWinery = hasWineryNear(p, regionId);
  const container = document.getElementById('brewOptions');
  container.innerHTML = '';

  if (!hasWinery) {
    container.innerHTML = '<p style="color:#9a7a5a;font-size:13px;">この産地またはその周辺に醸造所が必要です。</p>';
    document.getElementById('brewModal').classList.remove('hidden');
    return;
  }

  const hasCellar = p.buildings.some(b => b.type === 'cellar');

  for (const recipe of WINE_RECIPES) {
    const canAfford = canPay(p.resources, recipe.cost);
    const card = document.createElement('button');
    card.className = 'option-card';
    card.disabled = !canAfford;
    const bonus = hasCellar ? 1 : 0;
    const totalVp = recipe.vp + bonus;
    const costStr = Object.entries(recipe.cost).map(([k,v]) => `${RESOURCE_NAMES[k]}×${v}`).join(' + ');
    card.innerHTML = `
      <div class="opt-name">🍷 ${recipe.name}</div>
      <div class="opt-cost">コスト: ${costStr}</div>
      <div class="opt-effect">${recipe.desc}</div>
      <div class="opt-vp">+${totalVp}点${bonus ? `（セラーボーナス+${bonus}）` : ''}</div>
    `;
    if (canAfford) {
      card.onclick = () => { brew(recipe, hasCellar); document.getElementById('brewModal').classList.add('hidden'); };
    }
    container.appendChild(card);
  }

  document.getElementById('brewModal').classList.remove('hidden');
}

function hasWineryNear(player, regionId) {
  if (gs.regions[regionId].buildings.winery === player.id) return true;
  return REGION_DATA[regionId].adjacent.some(adjId => gs.regions[adjId]?.buildings.winery === player.id);
}

function brew(recipe, hasCellar) {
  const p = currentPlayer();
  payResources(p.resources, recipe.cost);
  const vp = recipe.vp + (hasCellar ? 1 : 0);
  p.vp += vp;
  p.wines.push(recipe.id);
  addLog(`${p.name}が${recipe.name}を醸造！+${vp}点`, p);
  checkVictory();
  renderAll();
}

// ===== クイズ =====
function openQuizModal(source) {
  const q = QUIZ_DATA[Math.floor(Math.random() * QUIZ_DATA.length)];
  const modal = document.getElementById('quizModal');
  const questionEl = document.getElementById('quizQuestion');
  const choicesEl = document.getElementById('quizChoices');
  const resultEl = document.getElementById('quizResult');
  const closeBtn = document.getElementById('closeQuizBtn');

  questionEl.textContent = q.question;
  choicesEl.innerHTML = '';
  resultEl.classList.add('hidden');
  resultEl.className = 'quiz-result hidden';
  closeBtn.classList.add('hidden');

  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-choice';
    btn.textContent = choice;
    btn.onclick = () => {
      // 全ボタンを無効化
      choicesEl.querySelectorAll('.quiz-choice').forEach(b => b.disabled = true);
      const correct = i === q.answer;
      btn.classList.add(correct ? 'correct' : 'wrong');
      if (!correct) choicesEl.querySelectorAll('.quiz-choice')[q.answer].classList.add('correct');

      const p = currentPlayer();
      if (correct) {
        p.vp++;
        resultEl.textContent = `正解！+1点 — ${q.explanation}`;
        resultEl.className = 'quiz-result correct';
        addLog(`${p.name}がクイズ正解！+1点`, p);
        checkVictory();
      } else {
        resultEl.textContent = `不正解… ${q.explanation}`;
        resultEl.className = 'quiz-result wrong';
      }
      resultEl.classList.remove('hidden');
      closeBtn.classList.remove('hidden');

      closeBtn.onclick = () => {
        modal.classList.add('hidden');
        if (source === 'event') nextPlayer();
        renderAll();
      };
    };
    choicesEl.appendChild(btn);
  });

  modal.classList.remove('hidden');
}

// ===== 勝利判定（シーズン終了時のみ nextPlayer から呼ぶ）=====
function checkVictory() {
  // シーズン制のため途中VP判定は行わない
}

function showVictory(winner) {
  document.getElementById('winnerTitle').textContent = `${winner.name} の勝利！`;
  const sorted = [...gs.players].sort((a, b) => b.vp - a.vp);
  const medals = ['🥇', '🥈', '🥉', '4️⃣'];
  document.getElementById('finalScores').innerHTML = sorted.map((p, i) => `
    <div class="score-row">
      <div class="score-rank">${medals[i]}</div>
      <div class="player-dot" style="background:${p.color};width:10px;height:10px;border-radius:50%;flex-shrink:0"></div>
      <div class="score-name">${p.name}</div>
      <div class="score-vp">${p.vp}点</div>
    </div>
  `).join('');
  showScreen('victoryScreen');
}

// ===== アニメーションループ =====
function startAnimLoop() {
  stopAnimLoop();
  function loop(time) {
    if (!gs) return;
    renderMap(canvas, gs, time);
    animFrameId = requestAnimationFrame(loop);
  }
  animFrameId = requestAnimationFrame(loop);
}

function stopAnimLoop() {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
}

// ===== UI 更新 =====
function renderAll() {
  renderPlayerPanels();
  renderTurnInfo();
  renderActionPhase();
}

function renderPlayerPanels() {
  const container = document.getElementById('playerPanels');
  container.innerHTML = '';
  gs.players.forEach((p, i) => {
    const panel = document.createElement('div');
    panel.className = 'player-panel' + (i === gs.currentPlayerIndex ? ' active-player' : '');
    const region = REGION_DATA[p.position];
    const resHtml = Object.entries(p.resources)
      .filter(([,v]) => v > 0)
      .map(([k,v]) => `<span class="res-chip"><span class="res-dot" style="background:${RESOURCE_COLORS[k]}"></span>${RESOURCE_NAMES[k].slice(0,3)} ×${v}</span>`)
      .join('');
    const buildHtml = p.buildings.map(b => `<span class="building-tag">${BUILDINGS[b.type]?.icon}${REGION_DATA[b.regionId]?.name?.slice(0,3)}</span>`).join('');
    panel.innerHTML = `
      <div class="player-header">
        <div class="player-dot" style="background:${p.color}"></div>
        <div class="player-name">${p.isAI ? '🤖 ' : ''}${p.name}</div>
        <div style="text-align:right"><div class="player-vp">${p.vp}</div><div class="player-vp-label">pts</div></div>
      </div>
      <div class="player-location">📍 ${region?.name || ''}</div>
      <div class="resource-list">${resHtml || '<span style="font-size:10px;color:#555">なし</span>'}</div>
      ${buildHtml ? `<div class="player-buildings">${buildHtml}</div>` : ''}
    `;
    container.appendChild(panel);
  });
}

function renderTurnInfo() {
  const p = currentPlayer();
  const el = document.getElementById('turnInfo');
  el.innerHTML = `
    <div class="current-player" style="color:${p.color}">${p.isAI ? '🤖 ' : ''}${p.name}</div>
    <div class="turn-num">S${gs.season}/${SEASONS_TOTAL} — T${gs.turnInSeason}/${TURNS_PER_SEASON}</div>
    ${p.isAI ? '<div class="ai-thinking">考え中…</div>' : ''}
  `;
}

function renderActionPhase() {
  const p = currentPlayer();
  const region = REGION_DATA[p.position];
  document.getElementById('landedRegionName').textContent = `📍 ${region?.name || ''}`;
  document.getElementById('collectedRes').textContent = '';
}

function setPhase(phase) {
  ['rollPhase', 'movePhase', 'actionPhase', 'eventPhase'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  const map = { roll: 'rollPhase', move: 'movePhase', action: 'actionPhase', event: 'eventPhase' };
  if (map[phase]) document.getElementById(map[phase]).classList.remove('hidden');

  if (phase === 'move' && gs) {
    document.getElementById('stepsLeft').textContent = gs.stepsLeft;
  }
}

// ===== ユーティリティ =====
function currentPlayer() { return gs.players[gs.currentPlayerIndex]; }

function canPay(resources, cost) {
  return Object.entries(cost).every(([k, v]) => (resources[k] || 0) >= v);
}

function payResources(resources, cost) {
  Object.entries(cost).forEach(([k, v]) => resources[k] = (resources[k] || 0) - v);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const target = document.getElementById(id);
  target.classList.add('active');
  target.style.display = 'flex';
}

function addLog(message, player) {
  if (!gs) return;
  gs.log.unshift({ message, playerColor: player?.color });
  const list = document.getElementById('logList');
  if (!list) return;
  list.innerHTML = gs.log.slice(0, 30).map(entry => `
    <div class="log-entry">
      ${entry.playerColor ? `<span class="log-player" style="color:${entry.playerColor}">●</span> ` : ''}
      ${entry.message}
    </div>
  `).join('');
}

// ===== AI プレイヤー =====
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function aiTakeTurn() {
  if (!gs || !currentPlayer()?.isAI || gs.phase !== 'roll') return;

  await sleep(900);
  if (!gs || !currentPlayer()?.isAI) return;

  // サイコロ（アニメーションなし）
  const p = currentPlayer();
  const penalty = p.bonbyPenalty || 0;
  const d1 = Math.ceil(Math.random() * 6);
  const d2 = Math.ceil(Math.random() * 6);
  const total = Math.max(1, d1 + d2 - penalty);
  if (penalty > 0) { p.bonbyPenalty = 0; addLog(`${p.name}に貧乏神ペナルティ！移動-${penalty}`, p); }
  document.getElementById('die1').textContent = d1;
  document.getElementById('die2').textContent = d2;
  gs.diceResult = { d1, d2, total };
  gs.stepsLeft = total;
  gs.phase = 'move';
  gs.reachableRegions = getReachable(p.position, 1);
  addLog(`${p.name}がサイコロを振った: ${d1}+${d2}=${total}`, p);
  setPhase('move');
  renderAll();

  await sleep(700);

  // 移動（ステップごと）
  while (gs && gs.stepsLeft > 0 && gs.reachableRegions.length > 0) {
    if (!currentPlayer()?.isAI) return;
    movePlayerTo(chooseBestRegion(gs.reachableRegions));
    await sleep(520);
  }

  await sleep(400);
  if (!gs || gs.phase !== 'action' || !currentPlayer()?.isAI) return;

  await aiPerformActions();

  await sleep(500);
  if (!gs || gs.phase !== 'action' || !currentPlayer()?.isAI) return;

  // ターン終了
  endTurn();

  await sleep(1600);
  if (!gs || gs.phase !== 'event') return;

  closeEvent();
}

function chooseBestRegion(regionIds) {
  const p = currentPlayer();
  let bestId = regionIds[0];
  let bestScore = -Infinity;
  for (const id of regionIds) {
    let score = Math.random() * 0.5;
    if (id === gs.destination) score += 10;
    if (gs.regions[id]?.buildings.vineyard === p.id) score += 4;
    const res = REGION_DATA[id]?.resource;
    if (res) score += Math.max(0, 4 - (p.resources[res] || 0));
    if (REGION_DATA[id]?.adjacent.some(a => gs.regions[a]?.buildings.winery === p.id)) score += 2;
    if (score > bestScore) { bestScore = score; bestId = id; }
  }
  return bestId;
}

async function aiPerformActions() {
  const p = currentPlayer();
  const regionId = p.position;
  const region = gs.regions[regionId];
  const hasCellar = p.buildings.some(b => b.type === 'cellar');

  // 醸造（高VP優先）
  if (hasWineryNear(p, regionId)) {
    const best = WINE_RECIPES.filter(r => canPay(p.resources, r.cost)).sort((a, b) => b.vp - a.vp)[0];
    if (best) { brew(best, hasCellar); await sleep(300); }
  }

  // 建設（畑 > 醸造所 > セラー）
  for (const type of ['vineyard', 'winery', 'cellar']) {
    if (!region.buildings[type] && canPay(p.resources, BUILDINGS[type].cost)) {
      buildAt(type, regionId);
      await sleep(300);
      break;
    }
  }
}

async function aiAutoQuiz() {
  await sleep(900);
  if (!gs) return;
  const p = currentPlayer();
  if (Math.random() < 0.35) {
    p.vp++;
    addLog(`${p.name}がクイズ正解！+1点`, p);
    checkVictory();
  } else {
    addLog(`${p.name}がクイズに挑戦（不正解）`, p);
  }
  renderAll();
  nextPlayer();
}
