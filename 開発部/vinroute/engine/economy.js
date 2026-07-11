/* 経済：資源・資産・建設・再投資・生産・売買・市場・オークション・試飲料 */
import { CONFIG } from "./config.js";
import { checkSets, checkMonopoly, addBonus, regionType } from "./collections.js";
import { computeRating, ratingToMult, ratingFeeMult, vintageMultiplier, seasonYear } from "./vintage.js";

/* ===== コスト ===== */
export function canAfford(p, cost) {
  return (!cost.grapes || p.grapes >= cost.grapes)
    && (!cost.barrels || p.barrels >= cost.barrels)
    && (!cost.money || p.money >= cost.money);
}
export function payCost(p, cost) {
  if (cost.grapes) p.grapes -= cost.grapes;
  if (cost.barrels) p.barrels -= cost.barrels;
  if (cost.money) p.money -= cost.money;
}

/* ===== 総資産（勝利条件） ===== */
export function assetWorth(p) {
  let w = 0;
  for (const k in p.assets) {
    const a = p.assets[k];
    if (a.vineyard) w += CONFIG.assetWorth.vineyard;
    if (a.winery_std) w += CONFIG.assetWorth.winery_std;
    if (a.winery_prem) w += CONFIG.assetWorth.winery_prem;
  }
  return w;
}
export function totalAssets(g, p) { return p.value + p.money + assetWorth(p); }

/* ===== 建設・再投資 ===== */
export function buildAsset(g, p, k, aid) {
  const cost = CONFIG.cost[aid];
  if (!canAfford(p, cost)) return { ok: false, reason: "資源不足" };
  const node = g.country.nodes[k];
  if (!node || node.kind !== "region") return { ok: false, reason: "産地でない" };
  if (p.assets[k] && p.assets[k][aid]) return { ok: false, reason: "建設済み" };
  payCost(p, cost);
  if (!p.assets[k]) p.assets[k] = {};
  p.assets[k][aid] = true;
  const monopoly = checkMonopoly(g, p, k);
  const setEvents = checkSets(g, p);
  return { ok: true, monopoly, setEvents };
}

export function reinvest(g, p, k, aid) {
  const rc = CONFIG.reinvest[aid];
  const a = p.assets[k];
  if (!a || !a[aid]) return { ok: false, reason: "未建設" };
  const lv = a[aid + "_lv"] || 1;
  if (lv >= CONFIG.reinvest.maxLevel) return { ok: false, reason: "最大レベル" };
  if (!canAfford(p, rc)) return { ok: false, reason: "資源不足" };
  payCost(p, rc);
  a[aid + "_lv"] = lv + 1;
  return { ok: true, level: lv + 1 };
}

/* ===== シーズン生産：資産が資源とワインを産出（プレイヤーごとの新ワインを返す） ===== */
export function produceSeason(g) {
  const newWinesByPlayer = [];
  g.players.forEach((p, pi) => {
    const newWines = [];
    for (const k in p.assets) {
      const a = p.assets[k];
      if (a.vineyard) p.grapes += CONFIG.produce.vineyardGrapes;
      if (a.winery_std) {
        const lv = a.winery_std_lv || 1;
        for (let n = 0; n < lv; n++) {
          if (p.grapes >= 1) {
            p.grapes -= 1;
            const w = { type: "std", region: k, value: CONFIG.produce.stdWineValue };
            p.wines.push(w); p.value += w.value; newWines.push(w);
          }
        }
      }
      if (a.winery_prem) {
        a.rating = computeRating(g, p, k, a);
        const mult = vintageMultiplier(g, k);
        const ratingMult = ratingToMult(a.rating);
        const baseV = Math.round(CONFIG.produce.premWineValue * mult); // 評価等倍の基準値
        const v = Math.round(CONFIG.produce.premWineValue * mult * ratingMult);
        const lv = a.winery_prem_lv || 1;
        for (let n = 0; n < lv; n++) {
          const w = { type: "prem", region: k, vintage: seasonYear(g), value: v, rating: a.rating };
          p.wines.push(w); p.value += w.value; newWines.push(w);
          p.parkerDelta += (v - baseV); // パーカーポイント寄与の累計
        }
      }
    }
    checkSets(g, p); // 生産後に判定
    newWinesByPlayer[pi] = newWines;
  });
  return newWinesByPlayer;
}

/* ===== 売る/持つ・市場 ===== */
export function sellPrice(w) { return Math.round(w.value * CONFIG.sellRate); }

/* 卸す：保有から外し70%で即現金 */
export function sellWine(g, p, w) {
  const idx = p.wines.indexOf(w);
  if (idx < 0) return 0;
  p.wines.splice(idx, 1);
  p.value -= w.value;
  const price = sellPrice(w);
  p.money += price;
  return price;
}

/* 都市市場に出品（90%価格・売れると出品者に代金） */
export function listWine(g, p, pIdx, w) {
  const idx = p.wines.indexOf(w);
  if (idx < 0) return null;
  p.wines.splice(idx, 1);
  p.value -= w.value;
  const price = Math.round(w.value * CONFIG.listRate);
  const m = { w, sellerIdx: pIdx, price };
  g.market.listings.push(m);
  return m;
}

/* 出品を買う（購入時にコレクション判定） */
export function buyCityWine(g, p, m) {
  const gi = g.market.listings.indexOf(m);
  if (gi < 0 || p.money < m.price) return { ok: false };
  p.money -= m.price;
  p.wines.push(m.w); p.value += m.w.value;
  g.players[m.sellerIdx].money += m.price;
  g.market.listings.splice(gi, 1);
  const setEvents = checkSets(g, p);
  return { ok: true, setEvents };
}

/* ===== 市場マス（資源購入・シーズン変動レート：天候連動） ===== */
export function marketRates(g) {
  let grapes = CONFIG.marketBase.grapes, barrels = CONFIG.marketBase.barrels;
  if (g.vintage.poor) grapes += 1;
  if (g.vintage.great) grapes = Math.max(2, grapes - 1);
  return { grapes, barrels };
}
export function buyResource(g, p, res) {
  const r = marketRates(g);
  if (p.money < r[res]) return false;
  p.money -= r[res];
  p[res]++;
  return true;
}

/* ===== 試飲料：他人のワイナリー産地に止まると、最高評価の1軒だけが徴収 ===== */
export function payTastingFee(g, k, p) {
  let best = null; // {owner, rating}
  g.players.forEach((o, i) => {
    if (i === g.cur) return;
    const a = o.assets[k];
    if (a && a.winery_prem) {
      const rating = a.rating || 85;
      if (!best || rating > best.rating) best = { owner: o, rating };
    }
  });
  if (!best) return null;
  const fee = Math.round(CONFIG.produce.tastingFee * ratingFeeMult(best.rating));
  p.money = Math.max(0, p.money - fee);
  best.owner.money += fee;
  return { owner: best.owner, rating: best.rating, fee };
}

/* ===== オークション（同期的な進行ロジック。入札プロンプトはコールバックで） =====
   開始90%。全員が順に入札/パス。NPCは価値×0.8〜1.3と資金から上限を自動判断。
   promptHuman(p, info, cb(bool)) … 人間の入札判断。完了で onDone(result) */
export function runAuction(g, sellerIdx, w, promptHuman, onDone, notify = () => {}) {
  const seller = g.players[sellerIdx];
  const startPrice = Math.round(w.value * CONFIG.listRate);
  const order = g.players.map((p, i) => ({ p, i })).filter(e => e.i !== sellerIdx);
  let highBid = startPrice - 1, highBidder = -1, firstBid = true;
  let idx = 0, passesInARow = 0;

  const npcCap = (pl) => {
    let base = w.value * (0.8 + g.rand() * 0.5);
    if (w.type === "prem") base *= 1.1;
    // コレクションが進む1本なら強気に（Step9: AI強化）
    if (npcWantsForCollection(g, pl, w)) base *= 1.25;
    return Math.min(pl.money, Math.round(base));
  };

  function finish() {
    let result;
    if (highBidder >= 0) {
      const buyer = g.players[highBidder];
      buyer.money -= highBid;
      buyer.wines.push(w); buyer.value += w.value;
      const si = seller.wines.indexOf(w);
      if (si >= 0) { seller.wines.splice(si, 1); seller.value -= w.value; }
      seller.money += highBid;
      checkSets(g, buyer);
      result = { sold: true, buyerIdx: highBidder, price: highBid };
    } else {
      result = { sold: false };
    }
    onDone(result);
  }
  function step() {
    if (passesInARow >= order.length) { finish(); return; }
    const { p, i } = order[idx % order.length]; idx++;
    if (i === highBidder) { passesInARow++; step(); return; }
    const nextBid = firstBid ? startPrice
      : highBid + Math.max(CONFIG.auctionStepMin, Math.round(w.value * CONFIG.auctionStepRate));
    if (p.isNpc) {
      const cap = npcCap(p);
      if (cap >= nextBid && p.money >= nextBid) {
        highBid = nextBid; highBidder = i; firstBid = false; passesInARow = 0;
        notify({ kind: "bid", playerIdx: i, bid: nextBid });
      } else passesInARow++;
      step();
    } else {
      promptHuman(p, { w, nextBid, highBid, highBidder, startPrice }, (bid) => {
        if (bid && p.money >= nextBid) {
          highBid = nextBid; highBidder = i; firstBid = false; passesInARow = 0;
        } else passesInARow++;
        step();
      });
    }
  }
  step();
  return { startPrice };
}

/* NPCがコレクション目的で欲しがる1本か（保有に無い産地/タイプ/当たり年） */
export function npcWantsForCollection(g, p, w) {
  const heldRegions = new Set(p.wines.map(x => x.region));
  if (!heldRegions.has(w.region)) return true;
  const t = regionType(g, w.region);
  const heldTypes = new Set(p.wines.map(x => regionType(g, x.region)).filter(Boolean));
  if (t && !heldTypes.has(t)) return true;
  if (w.vintage) {
    const heldVint = new Set(p.wines.map(x => x.vintage).filter(Boolean));
    if (!heldVint.has(w.vintage)) return true;
  }
  return false;
}

/* エンディング用：資産の内訳 */
export function assetBreakdown(g, p) {
  let premV = 0, stdV = 0, premN = 0, stdN = 0;
  p.wines.forEach(w => {
    if (w.type === "prem") { premV += w.value; premN++; }
    else { stdV += w.value; stdN++; }
  });
  const bl = p.bonusLog || {};
  const bonusTotal = (bl.monopoly || 0) + (bl.geoSet || 0) + (bl.typeColl || 0)
    + (bl.regionColl || 0) + (bl.vintageColl || 0) + (bl.spotlight || 0);
  return {
    premV, stdV, premN, stdN,
    money: p.money, assetWorth: assetWorth(p), bl, bonusTotal,
    parker: Math.round(p.parkerDelta || 0), total: totalAssets(g, p),
  };
}
