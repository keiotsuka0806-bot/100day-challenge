/* ゲーム状態とターン進行のオーケストレータ（国非依存・DOM非依存）
   UIとの境界は io インターフェース（全メソッド任意）。モーダル類は
   「完了コールバックでターン再開」に統一（設計書§14の学び1。デッドロック厳禁）。
   NPCの手番は io なしでも完走する＝Nodeでの自動テストが可能 */
import { CONFIG } from "./config.js";
import { buildBoard, bfsDistances, validateBoard } from "./board.js";
import { makeRng } from "./rng.js";
import { rollVintage, maybeBigCritic, seasonYear } from "./vintage.js";
import {
  produceSeason, sellWine, totalAssets, payTastingFee, marketRates,
  buyResource, listWine, buyCityWine, runAuction, assetBreakdown, canAfford,
} from "./economy.js";
import { addBonus, checkSets } from "./collections.js";
import {
  pickCriticEffect, pickCriticLine, applyCriticEffect,
  attachCriticToLeader, maybePassCritic,
} from "./critic.js";
import { CARD_DEFS, drawCardKey, applyCardEff, quickBuildVineyard, stealResource } from "./cards.js";
import { npcChoosePath, npcBuild, npcCityMarket, npcResourceMarket, npcMaybeUseCard, npcPinpoint } from "./npc.js";

/* io呼び出しヘルパー：未定義なら即 done（ヘッドレスで完走する） */
function call(io, name, args, done) {
  if (io && typeof io[name] === "function") io[name](...args, done || (() => {}));
  else if (done) done();
}

export function createGame(country, opts = {}) {
  const seed = opts.seed ?? 7;
  const board = buildBoard(country, { seed: opts.boardSeed ?? seed });
  const v = validateBoard(board, country);
  if (!v.ok) throw new Error("盤面検証エラー: " + v.errors.join(" / "));

  const g = {
    country, board,
    config: CONFIG,
    io: opts.io || {},
    rand: opts.rand || makeRng(seed * 7919 + 17), // ゲーム進行の乱数（seed制御可）
    players: [], cur: 0,
    owned: {},               // 産地key -> 最初に確保したプレイヤーidx
    season: 1, turnInSeason: 0,
    movesLeft: 0, phase: "idle", // idle|rolling|moving|awaitingPick|modal|ended
    dice: { forced: 0, pendingBonus: 0, pendingDice2: false, pinpointNext: false },
    vintage: { great: null, poor: null, nextGreat: null },
    spotlight: { region: null, wonBy: null },
    critic: { on: null, passedThisTurn: false, big: false, pendingAnnounce: null },
    market: { listings: [], cardOfDay: null, cardSeason: -1 },
    quizzes: opts.quizzes || [],
    loreShown: {},            // 産地key -> 旅ノートカードを表示済み（このゲーム内）
    ended: false,
    boardValidation: v,
  };

  (opts.players || []).forEach(sp => {
    g.players.push(makePlayer(g, sp));
  });
  return g;
}

function makePlayer(g, spec) {
  return {
    pname: spec.name, isNpc: !!spec.isNpc, avatar: spec.avatar ?? null,
    value: 0, posCell: g.board.startCellId, cameFrom: null,
    grapes: CONFIG.initialResources.grapes,
    barrels: CONFIG.initialResources.barrels,
    money: CONFIG.initialResources.money,
    assets: {}, wines: [], hand: [],
    bonusLog: { monopoly: 0, geoSet: 0, typeColl: 0, regionColl: 0, vintageColl: 0, spotlight: 0 },
    parkerDelta: 0,
    skipNext: false, skipTwice: false, defended: false, quizPass: false,
    warpedThisTurn: false,
    visitedNodes: [],         // 旅の足あと（到着順・重複なし）
  };
}

export function curP(g) { return g.players[g.cur]; }

/* ===== ゲーム開始 ===== */
export function startGame(g) {
  rollVintage(g);
  call(g.io, "hud", [g]);
  call(g.io, "vintageAnnounce", [g], () => beginTurn(g));
}

/* ===== ターン開始 ===== */
export function beginTurn(g) {
  if (g.ended) return;
  g.critic.passedThisTurn = false;
  const p = curP(g);
  // 評論家が憑いている人のターン開始時ダメージ（演出を見せてから手番へ）
  if (g.critic.on === g.cur) {
    const effect = pickCriticEffect(g);
    applyCriticEffect(g, effect);
    call(g.io, "hud", [g]);
    call(g.io, "criticDamage", [g, p, effect], () => continueTurn(g));
    return;
  }
  continueTurn(g);
}

function continueTurn(g) {
  const p = curP(g);
  if (p.skipNext) {
    p.skipNext = false;
    if (p.skipTwice) { p.skipTwice = false; p.skipNext = true; }
    call(g.io, "hud", [g]);
    call(g.io, "skipped", [g, p], () => nextTurn(g));
    return;
  }
  p.warpedThisTurn = false;
  g.phase = "idle";
  call(g.io, "hud", [g]);
  call(g.io, "turnBegin", [g, p], () => {
    if (p.isNpc) rollDice(g);
    // 人間はUIが rollDice(g) を呼ぶまで待つ
  });
}

/* ===== サイコロ：出目を先に確定してから表示（表示と実移動数を一致させる） ===== */
export function rollDice(g) {
  if (g.phase !== "idle" || g.ended) return;
  const p = curP(g);

  if (g.dice.pinpointNext) {
    g.dice.pinpointNext = false;
    if (p.isNpc) { startMoveWith(g, npcPinpoint(g)); return; }
    g.phase = "modal";
    call(g.io, "pinpointPick", [g, p], undefined); // UIが pickPinpoint(g,n) を呼ぶ
    return;
  }

  g.phase = "rolling";
  let v = 1 + Math.floor(g.rand() * 6);
  if (g.dice.pendingDice2) { v += 1 + Math.floor(g.rand() * 6); g.dice.pendingDice2 = false; }
  if (g.dice.forced) { v = g.dice.forced; g.dice.forced = 0; }
  const boost = g.dice.pendingBonus;
  g.dice.pendingBonus = 0;
  const total = v + boost;
  call(g.io, "diceRolled", [g, { playerIdx: g.cur, face: v, boost, total }], () => {
    g.movesLeft = total;
    g.phase = "moving";
    stepOnce(g);
  });
}

/* ぴったりカードの目選択（UIから） */
export function pickPinpoint(g, n) {
  if (g.phase !== "modal") return;
  g.phase = "idle";
  startMoveWith(g, n);
}

function startMoveWith(g, v) {
  const boost = g.dice.pendingBonus;
  g.dice.pendingBonus = 0;
  const total = v + boost;
  call(g.io, "diceRolled", [g, { playerIdx: g.cur, face: v, boost, total, pinpoint: true }], () => {
    g.movesLeft = total;
    g.phase = "moving";
    stepOnce(g);
  });
}

/* ===== 移動 ===== */
function stepOnce(g) {
  if (g.ended) return;
  if (g.movesLeft <= 0) { landAction(g); return; }
  const p = curP(g);
  const opts = g.board.cells[p.posCell].next.filter(id => id !== p.cameFrom);
  const choices = opts.length ? opts : g.board.cells[p.posCell].next;
  if (choices.length === 1) { advanceTo(g, choices[0]); return; }
  if (p.isNpc) { advanceTo(g, npcChoosePath(g, choices)); return; }
  g.phase = "awaitingPick";
  call(g.io, "choosePath", [g, choices], undefined); // UIが pickPath(g,id) を呼ぶ
}

export function pickPath(g, id) {
  if (g.phase !== "awaitingPick") return;
  g.phase = "moving";
  advanceTo(g, id);
}

function advanceTo(g, id) {
  const p = curP(g);
  p.cameFrom = p.posCell;
  p.posCell = id;
  g.movesLeft--;
  const passed = maybePassCritic(g); // 移動の各マスで接触判定（すれ違い含む）
  if (passed !== null) call(g.io, "criticPassed", [g, passed]);
  call(g.io, "moved", [g, g.cur, id], () => {
    if (g.movesLeft > 0) stepOnce(g);
    else landAction(g);
  });
}

/* 分岐時：注目産地に最も近づく選択肢（近道矢印用）。UIから参照 */
export function bestPickToward(g, choices) {
  if (!g.spotlight.region || g.spotlight.wonBy !== null || !choices || !choices.length) return null;
  const goal = g.board.nodeCellId[g.spotlight.region];
  let best = null, bd = Infinity;
  choices.forEach(id => {
    const dist = bfsDistances(g.board, id);
    const d = dist[goal] ?? Infinity;
    if (d < bd) { bd = d; best = id; }
  });
  return best;
}

/* 現在地から注目産地までの残り距離（HUD用） */
export function distanceToSpotlight(g) {
  if (!g.spotlight.region) return null;
  const goal = g.board.nodeCellId[g.spotlight.region];
  const dist = bfsDistances(g.board, curP(g).posCell);
  return dist[goal] ?? null;
}

/* ===== 着地アクション ===== */
function landAction(g) {
  const p = curP(g);
  const c = g.board.cells[p.posCell];
  const passed = maybePassCritic(g);
  if (passed !== null) call(g.io, "criticPassed", [g, passed]);

  if (c.type === "node") {
    const k = c.payload;
    const node = g.country.nodes[k];
    // 旅の足あと＋到着演出（ご当地のひとこと等。ターン進行は待たない）
    const firstVisit = !p.visitedNodes.includes(k);
    if (firstVisit) p.visitedNodes.push(k);
    call(g.io, "nodeArrived", [g, k, p, firstVisit]);
    if (node.kind === "city") { landCity(g, k, p); return; }
    landRegion(g, k, p, node);
    return;
  }
  landEventCell(g, c.type, p);
}

function landRegion(g, k, p, node) {
  // 産地に到着：初回確保
  if (g.owned[k] === undefined || g.owned[k] === null) {
    g.owned[k] = g.cur;
    p.value += node.value;
    call(g.io, "regionClaimed", [g, k, p, node.value]);
  }
  // 注目産地の一番乗り（評論家の発動トリガー）
  if (k === g.spotlight.region && g.spotlight.wonBy === null) {
    g.spotlight.wonBy = g.cur;
    addBonus(g, p, "spotlight", CONFIG.bonus.spotlight);
    call(g.io, "spotlightWon", [g, k, p]);
    const leader = attachCriticToLeader(g, g.cur);
    if (leader !== null) {
      if (p.isNpc) call(g.io, "criticAttach", [g, leader]);
      else g.critic.pendingAnnounce = leader; // 建設メニューを閉じた後に演出
    }
  }
  // 他人のワイナリーの試飲料（最高評価のみ徴収）
  const fee = payTastingFee(g, k, p);
  if (fee) call(g.io, "tastingFee", [g, k, p, fee]);
  call(g.io, "hud", [g]);

  if (p.isNpc) {
    npcBuild(g, k, p);
    call(g.io, "hud", [g]);
    finishTurn(g);
    return;
  }
  g.phase = "modal";
  // 初到着なら旅ノートカード（その土地の知識）→ 建設メニュー
  if (!g.loreShown[k]) {
    g.loreShown[k] = true;
    call(g.io, "loreCard", [g, k], () => call(g.io, "buildMenu", [g, k], () => afterBuildMenu(g)));
    return;
  }
  call(g.io, "buildMenu", [g, k], () => afterBuildMenu(g));
}

function afterBuildMenu(g) {
  if (g.critic.pendingAnnounce !== null) {
    const idx = g.critic.pendingAnnounce;
    g.critic.pendingAnnounce = null;
    call(g.io, "criticAttach", [g, idx], () => finishTurn(g));
    return;
  }
  finishTurn(g);
}

function landCity(g, k, p) {
  if (p.isNpc) {
    npcCityMarket(g, k, p);
    call(g.io, "hud", [g]);
    finishTurn(g);
    return;
  }
  g.phase = "modal";
  if (!g.loreShown[k]) {
    g.loreShown[k] = true;
    call(g.io, "loreCard", [g, k], () => call(g.io, "cityMarket", [g, k], () => finishTurn(g)));
    return;
  }
  call(g.io, "cityMarket", [g, k], () => finishTurn(g));
}

/* 道中マスのイベント（各演出は完了コールバックで必ず finishTurn に戻る） */
function landEventCell(g, type, p) {
  g.phase = "modal";
  switch (type) {
    case "slot": {
      // 出目先確定：資源種と量をエンジンが決め、UIはそれを見せる
      const res = CONFIG.slotResources[Math.floor(g.rand() * CONFIG.slotResources.length)];
      const amt = res.min + Math.floor(g.rand() * (res.max - res.min + 1));
      p[res.k] += amt;
      call(g.io, "hud", [g]);
      call(g.io, "slotResult", [g, p, res, amt], () => finishTurn(g));
      return;
    }
    case "fund": {
      const amounts = CONFIG.fundRoulette;
      const amt = amounts[Math.floor(g.rand() * amounts.length)];
      p.money += amt;
      call(g.io, "hud", [g]);
      call(g.io, "fundResult", [g, p, amt], () => finishTurn(g));
      return;
    }
    case "quiz": {
      if (p.quizPass) {
        p.quizPass = false;
        p.money += CONFIG.quizReward;
        call(g.io, "quizAutoPass", [g, p], () => finishTurn(g));
        return;
      }
      const item = g.quizzes.length ? g.quizzes[Math.floor(g.rand() * g.quizzes.length)] : null;
      if (!item) { finishTurn(g); return; }
      if (p.isNpc) {
        const ok = g.rand() < 0.6;
        if (ok) p.money += CONFIG.quizReward;
        call(g.io, "quizNpc", [g, p, ok], () => finishTurn(g));
        return;
      }
      call(g.io, "quiz", [g, p, item], (choiceIdx) => {
        const correct = choiceIdx === item.answer;
        if (correct) p.money += CONFIG.quizReward;
        call(g.io, "hud", [g]);
        call(g.io, "quizResult", [g, p, { item, choiceIdx, correct, reward: correct ? CONFIG.quizReward : 0 }],
          () => finishTurn(g));
      });
      return;
    }
    case "market": {
      if (g.market.cardOfDay === null || g.market.cardSeason !== g.season) {
        g.market.cardOfDay = drawCardKey(g);
        g.market.cardSeason = g.season;
      }
      if (p.isNpc) {
        npcResourceMarket(g, p);
        call(g.io, "hud", [g]);
        finishTurn(g);
        return;
      }
      call(g.io, "resourceMarket", [g, p], () => finishTurn(g));
      return;
    }
    case "card": {
      const key = drawCardKey(g);
      p.hand.push(key);
      call(g.io, "hud", [g]);
      call(g.io, "cardDrawn", [g, p, key], () => {
        if (p.isNpc) npcMaybeUseCard(g, p);
        finishTurn(g);
      });
      return;
    }
    case "criticHit": {
      if (p.defended) {
        p.defended = false;
        call(g.io, "defended", [g, p], () => finishTurn(g));
        return;
      }
      const line = pickCriticLine(g);
      for (const k in line.eff) p[k] = Math.max(0, (p[k] || 0) + line.eff[k]);
      call(g.io, "hud", [g]);
      call(g.io, "criticHitShow", [g, p, line], () => finishTurn(g));
      return;
    }
    default:
      finishTurn(g);
  }
}

/* ===== ターン終了・シーズン進行 ===== */
export function finishTurn(g) {
  if (g.ended) return;
  const p = curP(g);
  p.cameFrom = null;
  g.phase = "idle";
  call(g.io, "hud", [g]);
  call(g.io, "turnEnd", [g, p], () => nextTurn(g));
}

function nextTurn(g) {
  if (g.ended) return;
  g.cur = (g.cur + 1) % g.players.length;
  if (g.cur === 0) {
    g.turnInSeason++;
    if (g.turnInSeason >= CONFIG.turnsPerSeason) {
      endSeason(g);
      return;
    }
  }
  // ターン境界で微タスクに逃がす（長い同期再帰でのスタック溢れ防止）
  Promise.resolve().then(() => beginTurn(g));
}

function endSeason(g) {
  const newWinesByPlayer = produceSeason(g);
  g.season++;
  g.turnInSeason = 0;
  const seasonContinues = g.season <= CONFIG.totalSeasons;
  if (seasonContinues) {
    rollVintage(g);
    maybeBigCritic(g);
  }
  call(g.io, "hud", [g]);
  handleWineSales(g, newWinesByPlayer, () => {
    if (!seasonContinues) { endGame(g); return; }
    const announceNext = () => call(g.io, "vintageAnnounce", [g], () => {
      Promise.resolve().then(() => beginTurn(g));
    });
    if (g.critic.big) call(g.io, "bigCriticAnnounce", [g], announceNext);
    else announceNext();
  });
}

/* 売る/持つ：NPCは自動（量産→6割売る／プレミアム→持つ）、人間は順にモーダル */
function handleWineSales(g, newWinesByPlayer, done) {
  g.players.forEach((p, pi) => {
    if (!p.isNpc) return;
    (newWinesByPlayer[pi] || []).forEach(w => {
      if (w.type === "std" && g.rand() < 0.6) sellWine(g, p, w);
    });
  });
  const humans = g.players.map((p, i) => ({ p, i }))
    .filter(e => !e.p.isNpc && (newWinesByPlayer[e.i] || []).length > 0);
  let hi = 0;
  const nextHuman = () => {
    if (hi >= humans.length) { done(); return; }
    const { p, i } = humans[hi++];
    call(g.io, "wineSale", [g, p, newWinesByPlayer[i]], nextHuman);
  };
  nextHuman();
}

/* ===== カード使用（人間のみUIから呼ぶ）。UI選択が必要な special は io で解決 ===== */
export function useCard(g, idx, done = () => {}) {
  const p = curP(g);
  if (p.isNpc) { done(false); return; }
  if (g.phase !== "idle") { done(false); return; }
  const key = p.hand[idx];
  const d = CARD_DEFS[key];
  if (!d) { done(false); return; }
  const consume = (used) => {
    if (used) { p.hand.splice(idx, 1); call(g.io, "hud", [g]); }
    done(used);
  };
  if (!d.special) { consume(applyCardEff(g, p, key)); return; }
  switch (d.special) {
    case "pinpoint": g.dice.pinpointNext = true; consume(true); return;
    case "aging": p.wines.forEach(w => { w.value += 5; p.value += 5; }); consume(true); return;
    case "foresee": {
      const last = g.season >= CONFIG.totalSeasons;
      call(g.io, "foreseeShown", [g, last ? null : g.vintage.nextGreat]);
      consume(true); return;
    }
    case "quickBuild": consume(quickBuildVineyard(g, curP(g))); return;
    case "stealGrapes": {
      const r = stealResource(g, p, "grapes", 2);
      if (r) call(g.io, "stole", [g, p, r]);
      consume(!!r); return;
    }
    case "warp":
      call(g.io, "chooseWarp", [g, p], (k) => {
        if (!k) { consume(false); return; }
        const id = g.board.nodeCellId[k];
        p.cameFrom = null; p.posCell = id;
        p.hand.splice(idx, 1);
        call(g.io, "hud", [g]);
        call(g.io, "moved", [g, g.cur, id], () => {
          g.phase = "moving"; g.movesLeft = 0;
          landAction(g);
        });
        done(true);
      });
      return;
    case "sabotage":
      call(g.io, "chooseSabotage", [g, p], (ti) => {
        if (ti === null || ti === undefined) { consume(false); return; }
        const steal = Math.min(3, g.players[ti].money);
        g.players[ti].money -= steal; p.money += steal;
        call(g.io, "stole", [g, p, { victim: g.players[ti], take: steal, res: "money" }]);
        consume(true);
      });
      return;
    case "passCritic": {
      if (g.critic.on !== g.cur) { consume(false); return; }
      call(g.io, "choosePassCritic", [g, p], (ti) => {
        if (ti === null || ti === undefined) { consume(false); return; }
        g.critic.on = ti;
        call(g.io, "criticPassed", [g, ti]);
        consume(true);
      });
      return;
    }
    default: consume(false);
  }
}

/* ===== ワイナリーワープ（建設メニューから・1ターン1回） ===== */
export function wineryRegionsOf(p) {
  const r = [];
  for (const k in p.assets) if (p.assets[k].winery_prem) r.push(k);
  return r;
}
export function wineryWarp(g, p, toK) {
  if (p.warpedThisTurn) return false;
  if (!p.assets[toK] || !p.assets[toK].winery_prem) return false;
  p.warpedThisTurn = true;
  p.posCell = g.board.nodeCellId[toK];
  p.cameFrom = null;
  return true;
}

/* ===== 都市市場のオークション（UIから） ===== */
export function startCityAuction(g, sellerIdx, w, onDone) {
  const promptHuman = (p, info, cb) => call(g.io, "auctionBidPrompt", [g, p, info], cb);
  call(g.io, "auctionStart", [g, w]);
  runAuction(g, sellerIdx, w, promptHuman, (result) => {
    call(g.io, "auctionEnd", [g, w, result]);
    call(g.io, "hud", [g]);
    onDone(result);
  }, (ev) => call(g.io, "auctionEvent", [g, ev]));
}

/* 市場マスの「本日のカード」購入（UIから） */
export function buyMarketCard(g, p) {
  if (g.market.cardOfDay === null || p.money < CONFIG.marketCardCost) return false;
  p.money -= CONFIG.marketCardCost;
  p.hand.push(g.market.cardOfDay);
  const key = g.market.cardOfDay;
  g.market.cardOfDay = null;
  return key;
}

/* ===== ゲーム終了 ===== */
function endGame(g) {
  g.ended = true;
  g.phase = "ended";
  const ranked = g.players.map((p, i) => ({ p, i, total: totalAssets(g, p), breakdown: assetBreakdown(g, p) }))
    .sort((a, b) => b.total - a.total);
  call(g.io, "gameEnd", [g, ranked]);
}

/* テスト・検証用：ヘッドレスで最後まで回す */
export function runHeadless(g) {
  return new Promise(resolve => {
    const prev = g.io.gameEnd;
    g.io.gameEnd = (game, ranked, done) => {
      if (prev) prev(game, ranked, () => {});
      resolve(ranked);
      if (done) done();
    };
    startGame(g);
  });
}

export { seasonYear, marketRates, buyResource, listWine, buyCityWine, sellWine, totalAssets, assetBreakdown };
