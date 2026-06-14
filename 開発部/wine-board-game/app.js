// app.js — VinRoute ゲームロジック

// ===== 定数 =====
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

const MARKET_EVENTS = [
  { id: 'cool_climate_boom', name: 'Cool Climate Boom', desc: 'Cool地域の価値+2 / 収益+1', target: { climate: 'Cool' }, valueBonus: 2, incomeBonus: 1 },
  { id: 'pinot_popularity', name: 'Pinot Popularity', desc: 'Pinot地域の収益+3', target: { resource: 'pinot' }, valueBonus: 0, incomeBonus: 3 },
  { id: 'new_world_trend', name: 'New World Trend', desc: 'Americas地域の価値+2', target: { zone: 'americas' }, valueBonus: 2, incomeBonus: 1 },
  { id: 'old_world_prestige', name: 'Old World Prestige', desc: 'Western Europe地域の価値+2', target: { zone: 'western_europe' }, valueBonus: 2, incomeBonus: 1 },
  { id: 'sparkling_festival', name: 'Sparkling Festival', desc: 'Sparkling系地域の収益+3', target: { keyword: 'champagne' }, valueBonus: 1, incomeBonus: 3 }
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
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML = `
      <div class="player-color-dot" style="background:${PLAYER_COLORS[i]}"></div>
      <input class="player-name-input" type="text" placeholder="プレイヤー${i+1}の名前"
             value="${defaultNames[i]}" data-player="${i}">
    `;
    container.appendChild(row);
  }
}

function startGame() {
  const inputs = document.querySelectorAll('.player-name-input');
  const names = Array.from(inputs).map(el => el.value.trim() || `P${parseInt(el.dataset.player)+1}`);
  initGame(names);
}

// ===== ゲーム初期化 =====
function initGame(playerNames) {
  const startPositions = Array.from({ length: playerNames.length }, () => 'paris');

  gs = {
    players: playerNames.map((name, i) => ({
      id: `p${i}`,
      name,
      color: PLAYER_COLORS[i],
      position: startPositions[i],
      lastPosition: null,
      resources: {},
      cards: [],
      completedSets: [],
      visitedRegions: [],
      buildings: [],
      moveBonus: 0,
      vp: 0,
      isAI: false
    })),
    regions: buildRegionState(),
    visibleRegions: [...STARTER_VISIBLE_REGION_IDS],
    unlockedZones: new Set(),
    isAnimatingMove: false,
    currentPlayerIndex: 0,
    phase: 'roll',
    diceResult: null,
    stepsLeft: 0,
    reachableRegions: [],
    destination: pickDestination(null, null),
    marketEvent: null,
    turn: 1,
    season: 1,
    turnInSeason: 1,
    log: []
  };

  gs.marketEvent = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
  gs.destination = pickDestination(null, gs.marketEvent);

  setupGameEventListeners();
  showScreen('gameScreen');
  setupCanvas();
  markBoardDirty(); // 新しい盤面を裏画面に焼き直す
  ensureDiceOverlay(); // サイコロのレイヤーを先に用意し、初回ロールの引っかかりを防ぐ
  setPhase('roll');
  renderAll();
  startAnimLoop();
  addLog(`ゲーム開始！${SEASONS_TOTAL}シーズン終了時の最多コレクション価値勝利です。`, null);
  addLog(`初期市場: ${gs.marketEvent.name} / 注目産地: ${REGION_DATA[gs.destination]?.name || ''}`, null);
  addLog(`--- シーズン1・ターン1 / ${gs.players[0].name}のターン ---`, null);
  if (currentPlayer().isAI) setTimeout(() => aiTakeTurn(), 1200);
}

function buildRegionState() {
  const state = {};
  for (const [id, r] of Object.entries(REGION_DATA)) {
    state[id] = {
      ...r,
      buildings: {},
      claimedBy: null,
      claimedTurn: null,
      firstClaimedBy: null,
      discoveredBy: [],
      unlocked: STARTER_VISIBLE_REGION_IDS.includes(id)
    };
  }
  return state;
}

function pickDestination(exclude, marketEvent) {
  const visible = gs ? getVisibleRegionIds(gs) : STARTER_VISIBLE_REGION_IDS;
  const candidates = visible.filter(id => id !== exclude);
  if (!candidates.length) return exclude;

  if (marketEvent) {
    const targeted = candidates.filter(id => matchesMarketTarget(id, marketEvent));
    if (targeted.length) return targeted[Math.floor(Math.random() * targeted.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
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
  const regionId = getRegionAtPoint(pos.x, pos.y, gs);
  const tooltip = document.getElementById('regionTooltip');
  if (regionId) {
    const r = REGION_DATA[regionId];
    const meta = getRegionStrategy(regionId);
    const buildings = gs ? (gs.regions[regionId].buildings || {}) : {};
    const bList = Object.keys(buildings).length ? '施設あり' : '';
    const resourceTags = (meta.resources || []).map(r => `${RESOURCE_ICONS[r] || '◻'} ${RESOURCE_NAMES[r] || r}`).join(' ');
    const owner = gs?.regions[regionId]?.claimedBy ? getPlayerById(gs.regions[regionId].claimedBy) : null;
    tooltip.innerHTML = `
      <div class="tt-name">${r.name}</div>
      <div class="tt-country">${r.country}</div>
      <div class="tt-meta">${meta.setLabel} / ${meta.climate} / 価値 ${meta.value}</div>
      <div class="tt-meta">${owner ? `保有: ${owner.name}` : '未取得'}</div>
      <div>${resourceTags || `${RESOURCE_ICONS[r.resource]} ${RESOURCE_NAMES[r.resource]}`}</div>
      <div class="tt-effect">${meta.specialEffect}</div>
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
  if (!gs || gs.phase !== 'move' || currentPlayer().isAI || gs.isAnimatingMove) return;
  const pos = getCanvasXY(e);
  const regionId = getRegionAtPoint(pos.x, pos.y, gs);
  if (regionId && gs.reachableRegions.includes(regionId)) {
    movePlayerTo(regionId);
  }
}

// ===== イベントリスナー =====
function setupGameEventListeners() {
  const guard = fn => () => { if (gs && !currentPlayer().isAI) fn(); };
  document.getElementById('rollBtn').onclick = guard(rollDice);
  document.getElementById('skipMoveBtn').onclick = guard(skipMovement);
  const quizBtn = document.getElementById('quizBtn');
  const dexBtn = document.getElementById('dexBtn');
  if (quizBtn) quizBtn.onclick = guard(() => openQuizModal('action'));
  if (dexBtn) dexBtn.onclick = guard(openRegionDexModal);
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
  const values = Array.from({ length: DICE_COUNT }, () => Math.ceil(Math.random() * 6));
  const total = values.reduce((a, b) => a + b, 0);

  // 横パネルのサイコロ(2マス分)にも数字を反映
  document.getElementById('die1').textContent = values[0];
  document.getElementById('die2').textContent = values[1];

  gs.diceResult = { values, total };
  gs.stepsLeft = total;
  gs.phase = 'move';
  p.lastPosition = null; // 振り直すたびに分岐制限をリセット(最初の一歩はどこへでも行ける)
  gs.reachableRegions = getReachable(p.position, 1);

  addLog(`${p.name}がサイコロを振った: ${values.join('+')}=${total}`, p);

  // 盤面の自分の脇に3Dサイコロが落ちて弾む → 着地+ワンテンポ後に移動フェーズ(右上にあと○マス)
  showDiceRoll(values).then(() => {
    if (!gs) return;
    setPhase('move');
    renderAll();
  });
}

function getReachable(posId, steps) {
  const region = REGION_DATA[posId];
  if (!region) return [];
  let options = region.adjacent.filter(id => REGION_DATA[id] && isRegionVisible(id, gs));
  // 桃鉄ルール: 来た道には戻れない。ただし行き止まりで他に道が無いときだけ引き返しを許可する。
  const last = currentPlayer()?.lastPosition;
  if (last) {
    const noBacktrack = options.filter(id => id !== last);
    if (noBacktrack.length > 0) options = noBacktrack;
  }
  return options;
}

async function movePlayerTo(regionId) {
  if (!gs || gs.isAnimatingMove) return;
  const p = currentPlayer();
  const fromId = p.position;
  const fromRegion = REGION_DATA[fromId];
  const toRegion = REGION_DATA[regionId];
  if (!fromRegion || !toRegion) return;

  gs.isAnimatingMove = true;
  gs.phase = 'move';
  setPhase('move');
  playStepSound();
  await animateTokenMove(p, fromRegion, toRegion, 260);

  p.lastPosition = fromId; // 次の一歩で来た道(fromId)へは戻れないようにする
  p.position = regionId;
  gs.stepsLeft = Math.max(0, gs.stepsLeft - 1);
  claimRegion(p, regionId);
  addLog(`${p.name}が${toRegion.name}へ移動`, p);

  if (gs.stepsLeft > 0) {
    gs.reachableRegions = getReachable(regionId, 1);
    document.getElementById('stepsLeft').textContent = gs.stepsLeft;
    gs.isAnimatingMove = false;
    renderAll();
    return;
  }

  gs.reachableRegions = [];
  gs.isAnimatingMove = false;
  enterActionPhase();
  renderAll();
}

function skipMovement() {
  gs.stepsLeft = 0;
  gs.reachableRegions = [];
  enterActionPhase();
  renderAll();
}

function enterActionPhase() {
  clearDice(); // 移動が終わったら盤面のサイコロを片付ける
  const p = currentPlayer();
  const region = REGION_DATA[p.position];
  const meta = getRegionStrategy(p.position);
  gs.phase = 'action';

  const setId = meta.setId;
  document.getElementById('landedRegionName').textContent = `📍 ${region?.name || ''}`;
  document.getElementById('collectedRes').innerHTML = `
    <span>${meta?.setLabel || ''}</span>
    <span>・</span>
    <span>価値 ${meta?.value || 0}</span>
    <span>・</span>
    <span>${region?.claimedBy ? '既取得' : '未取得'}</span>
  `;

  if (p.position === gs.destination) {
    p.moveBonus = (p.moveBonus || 0) + 1;
    addLog(`🎯 注目産地到達！次の収集が少し有利になる`, p);
    gs.destination = pickDestination(p.position, gs.marketEvent);
    if (gs.destination) addLog(`新しい注目産地: ${REGION_DATA[gs.destination].name}`, null);
  }

  if (setId && !p.completedSets.includes(setId)) {
    const progress = getSetProgress(p, setId);
    if (progress.count >= progress.total) {
      const bonus = getSetBonus(setId);
      p.completedSets.push(setId);
      p.vp += bonus;
      addLog(`${p.name}が${meta.setLabel}を完成！+${bonus}価値`, p);
    }
  }

  setPhase('action');
}

function endTurn() {
  gs.phase = 'event';
  drawEventCard();
}

function drawEventCard() {
  const card = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
  gs.currentEvent = card;
  gs.marketEvent = card;
  gs.destination = pickDestination(currentPlayer()?.position, card);
  setPhase('event');

  const el = document.getElementById('eventCard');
  el.innerHTML = `<div class="event-name">${card.name}</div><div>${card.desc}</div>`;
  addLog(`イベント: ${card.name}`, null);
  if (currentPlayer()?.isAI) {
    setTimeout(() => {
      if (gs && gs.currentEvent === card) closeEvent();
    }, 650);
  }
}

function closeEvent() {
  if (gs.currentEvent) applyEvent(gs.currentEvent);
  gs.currentEvent = null;
  nextPlayer();
}

function applyEvent(card) {
  addLog(`市場ニュース: ${card.name} — ${card.desc}`, null);
}

function nextPlayer() {
  gs.currentPlayerIndex = (gs.currentPlayerIndex + 1) % gs.players.length;
  if (gs.currentPlayerIndex === 0) {
    gs.turn++;
    gs.turnInSeason++;
    if (gs.turnInSeason > TURNS_PER_SEASON) {
      gs.turnInSeason = 1;
      if (gs.season >= SEASONS_TOTAL) {
        const winner = [...gs.players].sort((a, b) => getAssetValue(b) - getAssetValue(a))[0];
        showVictory(winner);
        return;
      }
      gs.season++;
      addLog(`🍂 シーズン${gs.season - 1}終了 — 収穫祭！全畑から追加収穫`, null);
      harvestFestival();
      gs.destination = pickDestination(gs.destination, gs.marketEvent);
      addLog(`🎯 新しい目的地: ${REGION_DATA[gs.destination].name}`, null);
    }
  }
  gs.phase = 'roll';
  gs.diceResult = null;
  gs.stepsLeft = 0;
  gs.reachableRegions = [];
  currentPlayer().lastPosition = null;
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
        grantKnowledgeReward(p, q, source);
        resultEl.textContent = `正解！${q.explanation}`;
        resultEl.className = 'quiz-result correct';
        addLog(`${p.name}が知識チャレンジ成功`, p);
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
  const sorted = [...gs.players].sort((a, b) => getAssetValue(b) - getAssetValue(a));
  const medals = ['🥇', '🥈', '🥉', '4️⃣'];
  document.getElementById('finalScores').innerHTML = sorted.map((p, i) => `
    <div class="score-row">
      <div class="score-rank">${medals[i]}</div>
      <div class="player-dot" style="background:${p.color};width:10px;height:10px;border-radius:50%;flex-shrink:0"></div>
      <div class="score-name">${p.name}</div>
      <div class="score-vp">${getAssetValue(p)}価値</div>
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
    const meta = getRegionStrategy(p.position);
    const cardTags = p.cards.slice(-4).map(id => {
      const strat = getRegionStrategy(id);
      return `<span class="card-tag">${strat?.name || id}</span>`;
    }).join('');
    const setProgress = getSetIds().map(setId => {
      const progress = getSetProgress(p, setId);
      const done = p.completedSets.includes(setId);
      return `<span class="set-chip${done ? ' done' : ''}">${getSetLabel(setId)} ${progress.count}/${progress.total}</span>`;
    }).join('');
    panel.innerHTML = `
      <div class="player-header">
        <div class="player-dot" style="background:${p.color}"></div>
        <div class="player-name">${p.isAI ? '🤖 ' : ''}${p.name}</div>
        <div style="text-align:right"><div class="player-vp">${getAssetValue(p)}</div><div class="player-vp-label">価値</div></div>
      </div>
      <div class="player-location">📍 ${region?.name || ''} / ${meta?.setLabel || ''}</div>
      <div class="player-stats">カード ${p.cards.length} / セット ${p.completedSets.length}</div>
      ${cardTags ? `<div class="player-cards">${cardTags}</div>` : ''}
      ${setProgress ? `<div class="player-sets">${setProgress}</div>` : ''}
    `;
    container.appendChild(panel);
  });
}

function renderTurnInfo() {
  const p = currentPlayer();
  const el = document.getElementById('turnInfo');
  const market = gs.marketEvent;
  el.innerHTML = `
    <div class="current-player" style="color:${p.color}">${p.isAI ? '🤖 ' : ''}${p.name}</div>
    <div class="turn-num">S${gs.season}/${SEASONS_TOTAL} — T${gs.turnInSeason}/${TURNS_PER_SEASON}</div>
    ${p.isAI ? '<div class="ai-thinking">考え中…</div>' : ''}
    ${market ? `<div class="market-chip">${market.name}</div>` : ''}
  `;
}

function renderActionPhase() {
  const p = currentPlayer();
  const region = REGION_DATA[p.position];
  const meta = getRegionStrategy(p.position);
  const owner = region?.claimedBy ? getPlayerById(region.claimedBy) : null;
  document.getElementById('landedRegionName').textContent = `📍 ${region?.name || ''}`;
  document.getElementById('collectedRes').innerHTML = `
    <span>${meta?.setLabel || ''}</span>
    <span>・</span>
    <span>価値 ${meta?.value || 0}</span>
    <span>・</span>
    <span>${owner ? `保有: ${owner.name}` : '未取得'}</span>
  `;
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

function getPlayerById(playerId) {
  return gs?.players.find(p => p.id === playerId) || null;
}

function getSetIds() {
  return [...new Set(Object.values(REGION_SET_MAP))];
}

function getSetProgress(player, setId) {
  const regionIds = Object.keys(REGION_DATA).filter(id => getSetId(id) === setId && isRegionVisible(id, gs));
  const owned = regionIds.filter(id => gs.regions[id]?.claimedBy === player.id).length;
  return { count: owned, total: regionIds.length };
}

function claimRegion(player, regionId) {
  const region = gs.regions[regionId];
  const meta = getRegionStrategy(regionId);
  if (!region || !meta) return;

  if (!player.visitedRegions.includes(regionId)) {
    player.visitedRegions.push(regionId);
    if (!region.discoveredBy.includes(player.id)) {
      region.discoveredBy.push(player.id);
    }
    if (!player.cards.includes(regionId)) {
      player.cards.push(regionId);
    }
    player.vp += 1;
    addLog(`${player.name}が${meta.name}を初訪問 +1価値`, player);
  }

  if (!region.claimedBy) {
    region.claimedBy = player.id;
    region.claimedTurn = gs.turn;
    markBoardDirty(); // 取得で枠色が変わるので盤面キャッシュを更新
    let gain = meta.value;
    if (gs.marketEvent && matchesMarketTarget(regionId, gs.marketEvent)) {
      gain += gs.marketEvent.valueBonus || 0;
    }
    if (player.moveBonus > 0) {
      gain += player.moveBonus;
      player.moveBonus = 0;
    }
    player.vp += gain;
    addLog(`${player.name}が${meta.name}を獲得 +${gain}価値`, player);
    completeSetsForPlayer(player);
    playClaimSound();
    return;
  }

  if (region.claimedBy === player.id) {
    addLog(`${player.name}は${meta.name}をすでに保有`, player);
    return;
  }

  const owner = getPlayerById(region.claimedBy);
  addLog(`${meta.name}は${owner?.name || '他プレイヤー'}が先取り済み`, player);
}

function completeSetsForPlayer(player) {
  for (const setId of getSetIds()) {
    if (player.completedSets.includes(setId)) continue;
    const regionIds = Object.keys(REGION_DATA).filter(id => getSetId(id) === setId && isRegionVisible(id, gs));
    if (!regionIds.length) continue;
    const ownedCount = regionIds.filter(id => gs.regions[id]?.claimedBy === player.id).length;
    if (ownedCount >= regionIds.length) {
      const bonus = getSetBonus(setId);
      player.completedSets.push(setId);
      player.vp += bonus;
      addLog(`${player.name}が${getSetLabel(setId)}を完成！+${bonus}価値`, player);
    }
  }
}

// ===== 中央サイコロ演出(桃鉄風 3D ロール)=====
const DIE_PIP_CELLS = {
  1: [5], 2: [1, 9], 3: [1, 5, 9],
  4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9]
};
// 各面の数字(向かい合う面の和は7): front1 / back6 / right3 / left4 / top2 / bottom5
const DIE_FACE_TRANSFORMS = {
  1: 'translateZ(32px)',
  6: 'rotateY(180deg) translateZ(32px)',
  3: 'rotateY(90deg) translateZ(32px)',
  4: 'rotateY(-90deg) translateZ(32px)',
  2: 'rotateX(90deg) translateZ(32px)',
  5: 'rotateX(-90deg) translateZ(32px)'
};
// その数字を正面に向ける静止回転
const DIE_REST = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

function buildDieFace(n) {
  const face = document.createElement('div');
  face.className = 'die-face';
  face.style.transform = DIE_FACE_TRANSFORMS[n];
  for (let cell = 1; cell <= 9; cell++) {
    const slot = document.createElement('span');
    slot.className = 'die-slot';
    if (DIE_PIP_CELLS[n].includes(cell)) {
      const pip = document.createElement('span');
      pip.className = 'die-pip';
      slot.appendChild(pip);
    }
    slot.style.gridColumn = ((cell - 1) % 3) + 1;
    slot.style.gridRow = Math.ceil(cell / 3);
    face.appendChild(slot);
  }
  return face;
}

function buildDieCube() {
  const cube = document.createElement('div');
  cube.className = 'die-cube';
  for (let n = 1; n <= 6; n++) cube.appendChild(buildDieFace(n));
  return cube;
}

const DICE_COUNT = 3;
// 自分(画面中央)から左上にずらした塊。自分のコマと被らない位置に置く。
const DICE_CLUSTER = { x: -178, y: -36 };
// サイコロ同士が重ならず、かつ離れすぎない緩い山(目安: 中心間 ~105px)
const DICE_SCATTER = [
  { x: -62, y: 14 },
  { x: 18, y: -50 },
  { x: 50, y: 46 }
];

function ensureDiceOverlay() {
  let overlay = document.getElementById('diceOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'diceOverlay';
  overlay.className = 'dice-overlay hidden';
  for (let i = 0; i < DICE_COUNT; i++) overlay.appendChild(buildDieCube());
  document.body.appendChild(overlay);
  return overlay;
}

// 転がり終えたサイコロを盤面から消す。
function clearDice() {
  const overlay = document.getElementById('diceOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
  if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
  t -= 2.625 / d1; return n1 * t * t + 0.984375;
}

// 上空から落下→バウンドしつつ多軸を速く長く回転→斜めアングルで出目の面を上に着地。
const DIE_DUR = 1700; // 落下〜静止までの時間(ms)
function animateDieThrow(cube, value, delayMs) {
  const [rx, ry] = DIE_REST[value];
  const DROP = 300;   // 落下開始の高さ(px)
  const startAt = performance.now() + delayMs;

  const buildTransform = (ty, spinFactor) =>
    `translateY(${ty.toFixed(1)}px) rotateX(-25deg) rotateY(-35deg) ` +
    `rotateX(${(rx + spinFactor * 2880).toFixed(1)}deg) ` +  // 回転数を増やして速く
    `rotateY(${(ry + spinFactor * 2160).toFixed(1)}deg) ` +
    `rotateZ(${(spinFactor * 1080).toFixed(1)}deg)`;

  function frame(now) {
    let p = (now - startAt) / DIE_DUR;
    if (p <= 0) { cube.style.transform = buildTransform(-DROP, 1); requestAnimationFrame(frame); return; }
    if (p > 1) p = 1;
    const ty = -DROP * (1 - easeOutBounce(p)); // 0でバウンド着地
    const spin = 1 - easeOutCubic(p);          // 回転は減速して静止
    cube.style.transform = buildTransform(ty, spin);
    if (p < 1) requestAnimationFrame(frame);
  }
  cube.style.transition = 'none';
  cube.style.transform = buildTransform(-DROP, 1);
  requestAnimationFrame(frame);
}

// サイコロは盤面上(自分の左上)に落として残す。転がり終えてワンテンポ置いてから resolve。
function showDiceRoll(values) {
  return new Promise(resolve => {
    const overlay = ensureDiceOverlay();
    const cubes = overlay.querySelectorAll('.die-cube');
    overlay.classList.remove('hidden');

    // 自分(=盤面中央)を基準に配置。盤面は常に自分が中央に来るようスクロールされる。
    const wrap = document.querySelector('.map-wrapper');
    const wr = wrap.getBoundingClientRect();
    const cx = wr.left + wr.width / 2;
    const cy = wr.top + wr.height / 2;

    const lastDelay = (DICE_COUNT - 1) * 150;
    cubes.forEach((cube, i) => {
      const base = DICE_SCATTER[i] || { x: (i - 1) * 60, y: 0 };
      const jx = DICE_CLUSTER.x + base.x + (Math.random() * 20 - 10);
      const jy = DICE_CLUSTER.y + base.y + (Math.random() * 20 - 10);
      cube.style.left = (cx + jx).toFixed(0) + 'px';
      cube.style.top = (cy + jy).toFixed(0) + 'px';
      animateDieThrow(cube, values[i], i * 150); // 少しずつ時間差で落とす
    });
    playDiceSound();

    // 全部着地 + ワンテンポ(450ms)置いてから移動フェーズへ(=右上のあと○マス表示)
    setTimeout(resolve, lastDelay + DIE_DUR + 450);
  });
}

function playDiceSound() {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = playDiceSound.ctx || (playDiceSound.ctx = new AudioContextClass());
  // カラカラ転がる音: 短いクリックを連続で
  for (let i = 0; i < 7; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 180 + Math.random() * 220;
    g.gain.value = 0.015;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.11;
    o.start(t);
    g.gain.setValueAtTime(0.015, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.stop(t + 0.07);
  }
}

function playStepSound() {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = playStepSound.ctx || (playStepSound.ctx = new AudioContextClass());
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = 440;
  g.gain.value = 0.02;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
  o.stop(ctx.currentTime + 0.09);
}

function playClaimSound() {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = playClaimSound.ctx || (playClaimSound.ctx = new AudioContextClass());
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = 660;
  g.gain.value = 0.03;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
  o.stop(ctx.currentTime + 0.13);
}

function animateTokenMove(player, fromRegion, toRegion, duration = 250) {
  return new Promise(resolve => {
    const start = performance.now();
    player.moveAnim = { from: fromRegion, to: toRegion, start, duration };

    const tick = (now) => {
      if (!player.moveAnim) return resolve();
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        player.moveAnim = null;
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function unlockZoneForRegion(regionId) {
  if (!gs) return;
  const meta = getRegionStrategy(regionId);
  if (!meta) return;
  if (!gs.unlockedZones.has(meta.zone)) {
    gs.unlockedZones.add(meta.zone);
    const zoneMembers = Object.keys(REGION_DATA).filter(id => getRegionStrategy(id)?.zone === meta.zone);
    zoneMembers.forEach(id => {
      if (!gs.visibleRegions.includes(id)) gs.visibleRegions.push(id);
    });
    markBoardDirty(); // 産地が増えたので盤面キャッシュを更新
    addLog(`🗺 ${getZoneLabel(meta.zone)} が解放された`, null);
  }
}

function matchesMarketTarget(regionId, marketEvent) {
  if (!marketEvent) return false;
  const meta = getRegionStrategy(regionId);
  if (!meta) return false;
  const target = marketEvent.target || {};
  if (target.climate && meta.climate !== target.climate) return false;
  if (target.resource && meta.resource !== target.resource) return false;
  if (target.zone && meta.zone !== target.zone) return false;
  if (target.keyword && !meta.id.includes(target.keyword) && !meta.name.includes(target.keyword) && !(meta.specialEffect || '').includes(target.keyword)) return false;
  return true;
}

function getAssetValue(player) {
  return player.vp || 0;
}

function grantKnowledgeReward(player, q, source) {
  const rewards = ['marketIntel', 'moveBonus'];
  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  if (reward === 'marketIntel') {
    player.moveBonus = (player.moveBonus || 0) + 1;
    addLog(`${player.name}が市場のヒントを得た`, player);
  } else {
    player.moveBonus = (player.moveBonus || 0) + 1;
    addLog(`${player.name}が次の収集を少し有利にする`, player);
  }
  if (source === 'event' && player.isAI) {
    // AI の場合は即時継続
  }
}

async function aiTakeTurn() {
  if (!gs) return;
  addLog('AIはMVP外のため自動操作は行いません', null);
  endTurn();
}

function openRegionDexModal() {
  const modal = document.getElementById('dexModal');
  const grid = document.getElementById('dexGrid');
  grid.innerHTML = '';
  const visibleIds = getVisibleRegionIds(gs).slice().sort((a, b) => getRegionStrategy(b).value - getRegionStrategy(a).value);

  for (const id of visibleIds) {
    const meta = getRegionStrategy(id);
    const card = document.createElement('div');
    card.className = 'dex-card';
    const discoveredBy = (gs.regions[id]?.discoveredBy || []).length;
    const resourceTags = (meta.resources || []).map(r => RESOURCE_NAMES[r] || r).join(' / ');
    card.innerHTML = `
      <div class="dex-title">${meta.name}</div>
      <div class="dex-sub">${meta.country} / ${meta.zone}</div>
      <div class="dex-value">価値 ${meta.value}</div>
      <div class="dex-meta">${meta.climate} / ${resourceTags}</div>
      <div class="dex-effect">${meta.specialEffect}</div>
      <div class="dex-foot">発見 ${discoveredBy}</div>
    `;
    grid.appendChild(card);
  }
  modal.classList.remove('hidden');
}
