/* NPC AI：BFSで目的地選択・建設優先度・市場・オークションの自動判断（Step 9） */
import { CONFIG } from "./config.js";
import { bfsDistances } from "./board.js";
import { canAfford, buyResource, marketRates, sellPrice, sellWine, listWine, buyCityWine, npcWantsForCollection } from "./economy.js";
import { buildAsset, reinvest } from "./economy.js";
import { applyCardEff } from "./cards.js";
import { CARD_DEFS } from "./cards.js";

/* 目的地の価値マップを作って、最短で近づく分岐を選ぶ */
export function npcChoosePath(g, choices) {
  const targets = npcTargets(g);
  let best = choices[0], bestScore = Infinity;
  for (const id of choices) {
    const dist = bfsDistances(g.board, id);
    let score = Infinity;
    for (const t of targets) {
      const d = dist[t.cellId];
      if (d !== undefined) score = Math.min(score, d - t.weight);
    }
    if (score < bestScore) { bestScore = score; best = id; }
  }
  return best;
}

/* 目的地候補：未取得産地（価値が高いほど重み）＋注目産地（まだなら強い重み）＋自資産の増強先 */
function npcTargets(g) {
  const targets = [];
  for (const k of g.country.regionKeys) {
    const node = g.country.nodes[k];
    const cellId = g.board.nodeCellId[k];
    if (g.owned[k] === undefined || g.owned[k] === null) {
      targets.push({ cellId, weight: node.value / 20 });
    } else {
      // 自分の資産がある産地は独占を狙って再訪する価値
      const p = g.players[g.cur];
      const a = p.assets[k];
      if (a && !(a.vineyard && a.winery_std && a.winery_prem)) targets.push({ cellId, weight: 1 });
    }
  }
  if (g.spotlight.region && g.spotlight.wonBy === null) {
    targets.push({ cellId: g.board.nodeCellId[g.spotlight.region], weight: 3 });
  }
  if (!targets.length) {
    // 目的が無ければ最寄りの都市（市場）へ
    for (const k of g.country.cityKeys) targets.push({ cellId: g.board.nodeCellId[k], weight: 0 });
  }
  return targets;
}

/* 建設：独占リーチを最優先 → 畑 → 醸造所 → ワイナリー → 再投資 */
export function npcBuild(g, k, p) {
  const order = ["vineyard", "winery_std", "winery_prem"];
  const a = () => p.assets[k] || {};
  const builtCount = () => order.filter(aid => a()[aid]).length;

  // 独占まであと1つなら多少無理してでも建てる
  if (builtCount() === 2) {
    const missing = order.find(aid => !a()[aid]);
    if (missing && canAfford(p, CONFIG.cost[missing])) buildAsset(g, p, k, missing);
  }
  for (const aid of order) {
    if (!a()[aid] && canAfford(p, CONFIG.cost[aid])) {
      // ワイナリーは樽を使い切ると詰むので、樽3以上 or 当たり年産地のときだけ
      if (aid === "winery_prem" && p.barrels < 3 && k !== g.vintage.great) continue;
      buildAsset(g, p, k, aid);
    }
  }
  // 余裕があれば再投資（当たり年産地のワイナリー優先）
  if (a().winery_prem && k === g.vintage.great) reinvest(g, p, k, "winery_prem");
  else if (a().winery_std && p.money > 12) reinvest(g, p, k, "winery_std");
}

/* 都市市場：コレクションが進む出品を優先購入。手持ちが多ければ出品 */
export function npcCityMarket(g, k, p) {
  const pIdx = g.cur;
  const buyable = g.market.listings.filter(m => m.sellerIdx !== pIdx && p.money >= m.price);
  const wanted = buyable.find(m => npcWantsForCollection(g, p, m.w)) || buyable[0];
  if (wanted && (npcWantsForCollection(g, p, wanted.w) || g.rand() < 0.4)) {
    buyCityWine(g, p, wanted);
    return;
  }
  if (p.wines.length > 3) {
    // 重複の量産ワインから出品（コレクションを崩さない）
    const dup = p.wines.find(w => w.type === "std" && p.wines.filter(x => x.region === w.region).length > 1)
      || p.wines[p.wines.length - 1];
    listWine(g, p, pIdx, dup);
  }
}

/* 市場マス：樽が足りなければ買う。ぶどうも安ければ */
export function npcResourceMarket(g, p) {
  const r = marketRates(g);
  if (p.barrels < 2 && p.money >= r.barrels) buyResource(g, p, "barrels");
  if (p.grapes < 2 && p.money >= r.grapes + 6) buyResource(g, p, "grapes");
}

/* 手札：宣言的効果のカードはすぐ使う */
export function npcMaybeUseCard(g, p) {
  for (let i = p.hand.length - 1; i >= 0; i--) {
    const d = CARD_DEFS[p.hand[i]];
    if (!d || !d.eff) continue;
    if (applyCardEff(g, p, p.hand[i])) p.hand.splice(i, 1);
  }
}

/* ぴったりカード：目的地にちょうど届く目があれば選ぶ */
export function npcPinpoint(g) {
  const p = g.players[g.cur];
  const dist = bfsDistances(g.board, p.posCell);
  for (const t of npcTargets(g)) {
    const d = dist[t.cellId];
    if (d !== undefined && d >= 1 && d <= 6) return d;
  }
  return 3 + Math.floor(g.rand() * 4);
}
