const STORAGE_KEY = 'lexworld-cleared-v2';
const BESTS_KEY = 'lexworld-bests-v1';
const dirs = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const labels = {
  empty: '空白',
  water: '水',
  fire: '火',
  rock: '岩',
  ice: '氷',
  walk: '渡れる',
  gone: '消える',
};

const icons = {
  water: '水',
  fire: '火',
  rock: '岩',
  ice: '氷',
};

const state = {
  levelIndex: 0,
  player: { x: 0, y: 0 },
  rules: [],
  history: [],
  moves: 0,
  cleared: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')),
  bests: JSON.parse(localStorage.getItem(BESTS_KEY) || '{}'),
  activeRuleIds: new Set(),
  tileEffects: new Map(),
};

const els = {
  board: document.querySelector('#board'),
  stageList: document.querySelector('#stageList'),
  clearCount: document.querySelector('#clearCount'),
  levelNumber: document.querySelector('#levelNumber'),
  levelTitle: document.querySelector('#levelTitle'),
  levelHint: document.querySelector('#levelHint'),
  levelMeta: document.querySelector('#levelMeta'),
  moveCount: document.querySelector('#moveCount'),
  rankLine: document.querySelector('#rankLine'),
  proVerdict: document.querySelector('#proVerdict'),
  proAdvice: document.querySelector('#proAdvice'),
  undoButton: document.querySelector('#undoButton'),
  resetButton: document.querySelector('#resetButton'),
  hintButton: document.querySelector('#hintButton'),
  guideButton: document.querySelector('#guideButton'),
  guideDialog: document.querySelector('#guideDialog'),
  activeRules: document.querySelector('#activeRules'),
  clearProgressButton: document.querySelector('#clearProgressButton'),
  toast: document.querySelector('#toast'),
};

function currentLevel() {
  return LEVELS[state.levelIndex];
}

function key(pos) {
  return `${pos.x},${pos.y}`;
}

function cloneRules(rules) {
  return rules.map((rule) => ({ ...rule }));
}

function loadLevel(index) {
  const level = LEVELS[index];
  state.levelIndex = index;
  state.player = { ...level.playerStart };
  state.rules = cloneRules(level.rules);
  state.history = [];
  state.moves = 0;
  recalculateWorld();
  render();
}

function saveSnapshot() {
  state.history.push({
    player: { ...state.player },
    rules: cloneRules(state.rules),
    moves: state.moves,
  });
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return;
  state.player = previous.player;
  state.rules = previous.rules;
  state.moves = previous.moves;
  recalculateWorld();
  render();
}

function resetLevel() {
  loadLevel(state.levelIndex);
  showToast('ステージをリセットしました');
}

function tileMap(level) {
  const map = new Map();
  level.tiles.forEach((tile) => map.set(key(tile), tile.type));
  return map;
}

function baseTileAt(pos) {
  return tileMap(currentLevel()).get(key(pos)) || T.EMPTY;
}

function ruleAt(pos) {
  return state.rules.find((rule) => rule.x === pos.x && rule.y === pos.y);
}

function inBounds(pos) {
  const level = currentLevel();
  return pos.x >= 0 && pos.y >= 0 && pos.x < level.cols && pos.y < level.rows;
}

function areAdjacent(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

function matchingNextRules(rule, rules) {
  return rules.filter((next) => next.id !== rule.id && rule.to === next.from && areAdjacent(rule, next));
}

function recalculateWorld() {
  const activeRuleIds = new Set();
  const effects = new Map();

  state.rules.forEach((rule) => {
    if (matchingNextRules(rule, state.rules).length > 0) {
      activeRuleIds.add(rule.id);
    }
    state.rules.forEach((prev) => {
      if (prev.id !== rule.id && prev.to === rule.from && areAdjacent(prev, rule)) {
        activeRuleIds.add(rule.id);
      }
    });
  });

  const bases = [T.EMPTY, T.WATER, T.FIRE, T.ROCK];
  bases.forEach((base) => {
    const result = resolveEffect(base);
    if (result !== base) effects.set(base, result);
  });

  state.activeRuleIds = activeRuleIds;
  state.tileEffects = effects;
}

function resolveEffect(base) {
  let current = base;
  const visited = new Set();

  for (let i = 0; i < 8; i += 1) {
    const nextRule = state.rules.find((rule) => {
      if (rule.from !== current) return false;
      if (visited.size === 0) return matchingNextRules(rule, state.rules).length > 0;
      return state.activeRuleIds.has(rule.id) || matchingNextRules(rule, state.rules).length > 0;
    });

    if (!nextRule || visited.has(nextRule.id)) break;
    visited.add(nextRule.id);
    current = nextRule.to;
    if (current === 'walk' || current === 'gone') break;
  }

  return current;
}

function effectiveTileAt(pos) {
  const base = baseTileAt(pos);
  if (base === T.GOAL) return T.GOAL;
  const effect = state.tileEffects.get(base);
  if (!effect) return base;
  if (effect === 'walk') return T.EMPTY;
  if (effect === 'gone') return T.EMPTY;
  return effect;
}

function canStand(pos) {
  if (!inBounds(pos)) return false;
  const tile = effectiveTileAt(pos);
  return tile === T.EMPTY || tile === T.GOAL;
}

function canPlaceRule(pos) {
  if (!inBounds(pos) || ruleAt(pos)) return false;
  return canStand(pos);
}

function move(dirName) {
  const dir = dirs[dirName];
  if (!dir) return;

  const next = { x: state.player.x + dir.x, y: state.player.y + dir.y };
  const block = ruleAt(next);
  saveSnapshot();

  if (block) {
    const pushTo = { x: block.x + dir.x, y: block.y + dir.y };
    if (!canPlaceRule(pushTo)) {
      state.history.pop();
      return;
    }
    block.x = pushTo.x;
    block.y = pushTo.y;
    state.player = next;
  } else if (canStand(next)) {
    state.player = next;
  } else {
    state.history.pop();
    return;
  }

  state.moves += 1;
  recalculateWorld();

  if (effectiveTileAt(state.player) === T.FIRE) {
    showToast('火に触れました。1手戻しました');
    undo();
    return;
  }

  if (baseTileAt(state.player) === T.GOAL) {
    markCleared();
  }

  render();
}

function markCleared() {
  const isBest = saveBestIfNeeded();
  if (!state.cleared.has(state.levelIndex)) {
    state.cleared.add(state.levelIndex);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.cleared]));
    showToast(`Level ${state.levelIndex + 1} clear / Rank ${rankForMoves(state.moves, currentLevel().par)}`);
  } else if (isBest) {
    showToast(`自己ベスト更新 / Rank ${rankForMoves(state.moves, currentLevel().par)}`);
  }
}

function render() {
  renderHeader();
  renderStages();
  renderBoard();
  renderRules();
  renderProRead();
  els.undoButton.disabled = state.history.length === 0;
}

function renderHeader() {
  const level = currentLevel();
  const best = state.bests[state.levelIndex];
  els.clearCount.textContent = `${state.cleared.size} / ${LEVELS.length} clear`;
  els.levelNumber.textContent = `Level ${state.levelIndex + 1}`;
  els.levelTitle.textContent = level.title;
  els.levelHint.textContent = level.hint;
  els.levelMeta.textContent = `${level.difficulty} / Par ${level.par}${best ? ` / Best ${best.moves} (${best.rank})` : ''}`;
  els.moveCount.textContent = String(state.moves);
  els.rankLine.textContent = `Rank: ${rankForMoves(state.moves, level.par)}`;
}

function renderStages() {
  els.stageList.replaceChildren();
  LEVELS.forEach((level, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `stage-button${index === state.levelIndex ? ' active' : ''}`;
    button.addEventListener('click', () => loadLevel(index));

    const number = document.createElement('span');
    number.className = 'stage-index';
    number.textContent = String(index + 1);

    const name = document.createElement('span');
    name.className = 'stage-name';
    name.textContent = level.title;

    const clear = document.createElement('span');
    clear.className = 'stage-result';
    clear.textContent = state.bests[index] ? `${state.bests[index].rank} ${state.bests[index].moves}` : (state.cleared.has(index) ? 'OK' : '');

    button.append(number, name, clear);
    els.stageList.append(button);
  });
}

function renderBoard() {
  const level = currentLevel();
  els.board.style.setProperty('--cols', level.cols);
  els.board.style.setProperty('--rows', level.rows);
  els.board.replaceChildren();

  for (let y = 0; y < level.rows; y += 1) {
    for (let x = 0; x < level.cols; x += 1) {
      const pos = { x, y };
      const cell = document.createElement('div');
      const tile = effectiveTileAt(pos);
      cell.className = `cell tile-${tile}`;

      if (baseTileAt(pos) === T.GOAL) {
        const flag = document.createElement('span');
        flag.className = 'goal-flag';
        flag.textContent = '⚑';
        cell.append(flag);
      } else if (icons[tile]) {
        const icon = document.createElement('span');
        icon.className = 'goal-flag';
        icon.textContent = icons[tile];
        cell.append(icon);
      }

      const rule = ruleAt(pos);
      if (rule) cell.append(renderRuleBlock(rule));

      if (state.player.x === x && state.player.y === y) {
        const player = document.createElement('div');
        player.className = 'player';
        player.textContent = 'P';
        cell.append(player);
      }

      els.board.append(cell);
    }
  }
}

function renderRuleBlock(rule) {
  const block = document.createElement('div');
  block.className = `rule-block${state.activeRuleIds.has(rule.id) ? ' active' : ''}`;
  block.textContent = `${labels[rule.from]}→${labels[rule.to]}`;
  return block;
}

function renderRules() {
  els.activeRules.replaceChildren();
  state.rules.forEach((rule) => {
    const chip = document.createElement('span');
    chip.className = `rule-chip${state.activeRuleIds.has(rule.id) ? ' on' : ''}`;
    chip.textContent = `${labels[rule.from]} -> ${labels[rule.to]}`;
    els.activeRules.append(chip);
  });
}

function renderProRead() {
  const activeCount = state.activeRuleIds.size;
  const level = currentLevel();
  const rank = rankForMoves(state.moves, level.par);

  if (activeCount === 0) {
    els.proVerdict.textContent = 'まだ世界が変わっていない';
    els.proAdvice.textContent = '有効ルールが0本。まずは「A→B」と「B→渡れる」を隣接させて、盤面を変化させよう。';
    return;
  }

  if (rank === 'S') {
    els.proVerdict.textContent = 'テンポは良い';
    els.proAdvice.textContent = 'このペースならS圏内。余計な押し戻しを避けて、そのままゴールへ向かう。';
    return;
  }

  if (rank === 'A') {
    els.proVerdict.textContent = 'クリア狙いは十分';
    els.proAdvice.textContent = 'ルールは作れている。次はブロックを壁際に押し込まないことだけ意識する。';
    return;
  }

  els.proVerdict.textContent = '手数が重い';
  els.proAdvice.textContent = 'プロ視点では押し直しが多い。Undoで戻って、ブロックを直線で寄せるルートを探す。';
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function rankForMoves(moves, par) {
  if (moves <= par) return 'S';
  if (moves <= Math.ceil(par * 1.35)) return 'A';
  if (moves <= Math.ceil(par * 1.8)) return 'B';
  return 'C';
}

function saveBestIfNeeded() {
  const current = state.bests[state.levelIndex];
  const rank = rankForMoves(state.moves, currentLevel().par);
  if (!current || state.moves < current.moves) {
    state.bests[state.levelIndex] = { moves: state.moves, rank };
    localStorage.setItem(BESTS_KEY, JSON.stringify(state.bests));
    return true;
  }
  return false;
}

function clearProgress() {
  state.cleared.clear();
  state.bests = {};
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BESTS_KEY);
  showToast('クリア記録を消しました');
  render();
}

function bindEvents() {
  window.addEventListener('keydown', (event) => {
    const map = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    };
    const dir = map[event.key];
    if (!dir) return;
    event.preventDefault();
    move(dir);
  });

  document.querySelectorAll('[data-dir]').forEach((button) => {
    button.addEventListener('click', () => move(button.dataset.dir));
  });

  els.undoButton.addEventListener('click', undo);
  els.resetButton.addEventListener('click', resetLevel);
  els.hintButton.addEventListener('click', () => showToast(currentLevel().hint));
  els.guideButton.addEventListener('click', () => els.guideDialog.showModal());
  els.clearProgressButton.addEventListener('click', clearProgress);

  let touchStart = null;
  els.board.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  els.board.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });
}

bindEvents();
loadLevel(0);
