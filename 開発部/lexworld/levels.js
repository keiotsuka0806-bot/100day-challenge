// Tile types
const T = { EMPTY: 'empty', WATER: 'water', FIRE: 'fire', ROCK: 'rock', GOAL: 'goal', WALL: 'wall' };

// Rule block format: { id, from, to, x, y }
// Rule effects: 'ice' (water→walkable ice), 'water', 'fire', 'gone' (rock→gone), 'safe' (fire→water)

const LEVELS = [
  // --- LEVEL 1: 低 / 2-chain / straight ---
  {
    title: 'はじめの一歩',
    difficulty: 'Intro',
    par: 18,
    hint: '水→氷 と 氷→渡れる を隣に置くと、水の壁を越えられる',
    rows: 5, cols: 7,
    playerStart: { x: 0, y: 2 },
    tiles: [
      { x: 4, y: 0, type: T.WATER },
      { x: 4, y: 1, type: T.WATER },
      { x: 4, y: 2, type: T.WATER },
      { x: 4, y: 3, type: T.WATER },
      { x: 4, y: 4, type: T.WATER },
      { x: 6, y: 2, type: T.GOAL },
    ],
    rules: [
      { id: 'r1', from: 'water', to: 'ice', x: 1, y: 1 },
      { id: 'r2', from: 'ice', to: 'walk', x: 2, y: 3 },
    ],
  },

  // --- LEVEL 2: 低 / 2-chain / red herring ---
  {
    title: 'まぎらわしい',
    difficulty: 'Easy+',
    par: 26,
    hint: '水を火にする罠をつなぐと、道が危険になる',
    rows: 6, cols: 8,
    playerStart: { x: 0, y: 2 },
    tiles: [
      { x: 5, y: 0, type: T.WATER },
      { x: 5, y: 1, type: T.WATER },
      { x: 5, y: 2, type: T.WATER },
      { x: 5, y: 3, type: T.WATER },
      { x: 5, y: 4, type: T.WATER },
      { x: 5, y: 5, type: T.WATER },
      { x: 7, y: 2, type: T.GOAL },
    ],
    rules: [
      { id: 'r1', from: 'water', to: 'ice', x: 1, y: 1 },
      { id: 'r2', from: 'ice', to: 'walk', x: 3, y: 4 },
      { id: 'r3', from: 'water', to: 'fire', x: 2, y: 2 },
      { id: 'r4', from: 'rock', to: 'gone', x: 4, y: 1 },
    ],
  },

  // --- LEVEL 3: 中 / 3-chain / create world ---
  {
    title: '世界を作る',
    difficulty: 'Medium',
    par: 38,
    hint: '3つのブロックを 水→氷→渡れる の順につなげよう。空白→水は罠寄り',
    rows: 6, cols: 9,
    playerStart: { x: 0, y: 2 },
    tiles: [
      { x: 8, y: 2, type: T.GOAL },
      { x: 6, y: 0, type: T.WATER },
      { x: 6, y: 1, type: T.WATER },
      { x: 6, y: 2, type: T.WATER },
      { x: 6, y: 3, type: T.WATER },
      { x: 6, y: 4, type: T.WATER },
      { x: 6, y: 5, type: T.WATER },
    ],
    rules: [
      { id: 'r1', from: 'water', to: 'ice', x: 1, y: 1 },
      { id: 'r2', from: 'ice', to: 'walk', x: 4, y: 4 },
      { id: 'r3', from: 'empty', to: 'water', x: 3, y: 2 },
      { id: 'r4', from: 'water', to: 'fire', x: 1, y: 4 },
      { id: 'r5', from: 'rock', to: 'gone', x: 5, y: 1 },
    ],
  },

  // --- LEVEL 4: 中 / 3-chain / trap ---
  {
    title: 'わなに気をつけて',
    difficulty: 'Hard',
    par: 46,
    hint: '火→水→氷→渡れる の4連鎖を作る。水→火は混ぜない',
    rows: 6, cols: 9,
    playerStart: { x: 0, y: 2 },
    tiles: [
      { x: 6, y: 0, type: T.FIRE },
      { x: 6, y: 1, type: T.FIRE },
      { x: 6, y: 2, type: T.FIRE },
      { x: 6, y: 3, type: T.FIRE },
      { x: 6, y: 4, type: T.FIRE },
      { x: 6, y: 5, type: T.FIRE },
      { x: 8, y: 2, type: T.GOAL },
    ],
    rules: [
      { id: 'r1', from: 'fire', to: 'water', x: 1, y: 1 },
      { id: 'r2', from: 'water', to: 'ice', x: 3, y: 4 },
      { id: 'r3', from: 'ice', to: 'walk', x: 5, y: 1 },
      { id: 'r4', from: 'water', to: 'fire', x: 2, y: 2 },
      { id: 'r5', from: 'empty', to: 'fire', x: 4, y: 3 },
    ],
  },

  // --- LEVEL 5: 高 / 4-chain / fire path ---
  {
    title: '炎の道',
    difficulty: 'Expert',
    par: 64,
    hint: '火の壁と岩の壁がある。先に火を道へ、次に岩を消す連鎖を作る',
    rows: 7, cols: 10,
    playerStart: { x: 0, y: 3 },
    tiles: [
      { x: 5, y: 0, type: T.FIRE },
      { x: 5, y: 1, type: T.FIRE },
      { x: 5, y: 2, type: T.FIRE },
      { x: 5, y: 3, type: T.FIRE },
      { x: 5, y: 4, type: T.FIRE },
      { x: 5, y: 5, type: T.FIRE },
      { x: 5, y: 6, type: T.FIRE },
      { x: 7, y: 0, type: T.ROCK },
      { x: 7, y: 1, type: T.ROCK },
      { x: 7, y: 2, type: T.ROCK },
      { x: 7, y: 3, type: T.ROCK },
      { x: 7, y: 4, type: T.ROCK },
      { x: 7, y: 5, type: T.ROCK },
      { x: 7, y: 6, type: T.ROCK },
      { x: 9, y: 3, type: T.GOAL },
    ],
    rules: [
      { id: 'r1', from: 'fire', to: 'water', x: 1, y: 1 },
      { id: 'r2', from: 'water', to: 'ice', x: 3, y: 1 },
      { id: 'r3', from: 'ice', to: 'walk', x: 4, y: 5 },
      { id: 'r4', from: 'rock', to: 'gone', x: 2, y: 4 },
      { id: 'r5', from: 'gone', to: 'walk', x: 6, y: 1 },
      { id: 'r6', from: 'empty', to: 'fire', x: 8, y: 5 },
    ],
  },

  // --- LEVEL 6: 高 / 4-chain / create + destroy ---
  {
    title: '創造と破壊',
    difficulty: 'Master',
    par: 78,
    hint: '2つの壁を越える。火の連鎖と岩の連鎖を両方作る',
    rows: 7, cols: 10,
    playerStart: { x: 0, y: 3 },
    tiles: [
      { x: 4, y: 0, type: T.FIRE },
      { x: 4, y: 1, type: T.FIRE },
      { x: 4, y: 2, type: T.FIRE },
      { x: 4, y: 3, type: T.FIRE },
      { x: 4, y: 4, type: T.FIRE },
      { x: 4, y: 5, type: T.FIRE },
      { x: 4, y: 6, type: T.FIRE },
      { x: 7, y: 0, type: T.ROCK },
      { x: 7, y: 1, type: T.ROCK },
      { x: 7, y: 2, type: T.ROCK },
      { x: 7, y: 3, type: T.ROCK },
      { x: 7, y: 4, type: T.ROCK },
      { x: 7, y: 5, type: T.ROCK },
      { x: 7, y: 6, type: T.ROCK },
      { x: 9, y: 3, type: T.GOAL },
    ],
    rules: [
      { id: 'r1', from: 'fire', to: 'water', x: 1, y: 1 },
      { id: 'r2', from: 'water', to: 'ice', x: 3, y: 5 },
      { id: 'r3', from: 'ice', to: 'walk', x: 5, y: 1 },
      { id: 'r4', from: 'rock', to: 'gone', x: 2, y: 3 },
      { id: 'r5', from: 'gone', to: 'walk', x: 6, y: 5 },
      { id: 'r6', from: 'water', to: 'fire', x: 1, y: 5 },
      { id: 'r7', from: 'empty', to: 'fire', x: 8, y: 1 },
    ],
  },
];
