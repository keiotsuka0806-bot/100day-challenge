import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCountry } from "../engine/country.js";
import { createGame, runHeadless, curP, totalAssets, rollDice } from "../engine/state.js";
import { CONFIG } from "../engine/config.js";
import { buildAsset, reinvest, produceSeason, sellWine, sellPrice, listWine, buyCityWine, runAuction, marketRates, payTastingFee, assetBreakdown, canAfford } from "../engine/economy.js";
import { checkSets, checkMonopoly, addBonus } from "../engine/collections.js";
import { rollVintage, computeRating, ratingToMult, seasonYear } from "../engine/vintage.js";
import { applyCriticEffect, maybePassCritic, CRITIC_EFFECTS } from "../engine/critic.js";
import { CARD_DEFS, drawCardKey } from "../engine/cards.js";
import { makeRng } from "../engine/rng.js";

const franceJson = JSON.parse(readFileSync(new URL("../data/france.json", import.meta.url)));
const quizJson = JSON.parse(readFileSync(new URL("../data/quiz_france.json", import.meta.url)));
const country = loadCountry(franceJson);

function newGame(opts = {}) {
  return createGame(country, {
    seed: opts.seed ?? 7,
    players: opts.players ?? [
      { name: "NPC A", isNpc: true },
      { name: "NPC B", isNpc: true },
      { name: "NPC C", isNpc: true },
    ],
    quizzes: quizJson.quiz,
    ...opts,
  });
}

/* ===== Step 3: 経済 ===== */
test("建設：コスト支払い・二重建設不可・独占ボーナス", () => {
  const g = newGame();
  const p = curP(g);
  p.grapes = 10; p.barrels = 5; p.money = 50;
  const k = "bordeaux";
  assert.equal(buildAsset(g, p, k, "vineyard").ok, true);
  assert.equal(p.money, 45);
  assert.equal(buildAsset(g, p, k, "vineyard").ok, false, "二重建設は不可");
  assert.equal(buildAsset(g, p, k, "winery_std").ok, true);
  const r = buildAsset(g, p, k, "winery_prem");
  assert.equal(r.ok, true);
  assert.equal(r.monopoly, true, "3資産で独占");
  assert.equal(p.bonusLog.monopoly, CONFIG.bonus.monopoly);
});

test("再投資：Lv3まで・コスト消費", () => {
  const g = newGame();
  const p = curP(g);
  p.grapes = 20; p.barrels = 10; p.money = 100;
  buildAsset(g, p, "rhone", "winery_std");
  assert.equal(reinvest(g, p, "rhone", "winery_std").level, 2);
  assert.equal(reinvest(g, p, "rhone", "winery_std").level, 3);
  assert.equal(reinvest(g, p, "rhone", "winery_std").ok, false, "最大Lv超は不可");
});

test("生産：畑=ぶどう・醸造所=量産・ワイナリー=プレミアム(評価×天候)", () => {
  const g = newGame();
  const p = curP(g);
  p.grapes = 10; p.barrels = 5; p.money = 100;
  buildAsset(g, p, "bordeaux", "vineyard");
  buildAsset(g, p, "bordeaux", "winery_std");
  buildAsset(g, p, "bordeaux", "winery_prem");
  const grapesBefore = p.grapes;
  const newWines = produceSeason(g);
  assert.ok(newWines[0].length >= 2, "量産＋プレミアムが生産される");
  const std = newWines[0].find(w => w.type === "std");
  const prem = newWines[0].find(w => w.type === "prem");
  assert.equal(std.value, CONFIG.produce.stdWineValue);
  assert.ok(prem.rating >= 60 && prem.rating <= 100);
  assert.ok(prem.vintage === seasonYear(g));
  // 畑+2、量産で-1
  assert.equal(p.grapes, grapesBefore + 2 - 1);
});

test("総資産 = value + money + 資産価値(5/8/12)", () => {
  const g = newGame();
  const p = curP(g);
  p.grapes = 10; p.barrels = 5; p.money = 100;
  buildAsset(g, p, "bordeaux", "vineyard");   // -5💰 → 95
  buildAsset(g, p, "bordeaux", "winery_std"); // -5💰 → 90
  assert.equal(totalAssets(g, p), p.value + p.money + 5 + 8);
});

test("売る/持つ：卸すと70%現金化・保有から消える", () => {
  const g = newGame();
  const p = curP(g);
  const w = { type: "std", region: "bordeaux", value: 10 };
  p.wines.push(w); p.value += 10;
  const before = p.money;
  const price = sellWine(g, p, w);
  assert.equal(price, 7);
  assert.equal(p.money, before + 7);
  assert.equal(p.wines.length, 0);
  assert.equal(p.value, 0);
});

test("試飲料：同一産地に複数ワイナリーなら最高評価だけ徴収", () => {
  const g = newGame();
  const [a, b, c] = g.players;
  g.cur = 0;
  b.assets.rhone = { winery_prem: true, rating: 80 };
  c.assets.rhone = { winery_prem: true, rating: 95 };
  const bBefore = b.money, cBefore = c.money;
  const fee = payTastingFee(g, "rhone", a);
  assert.equal(fee.owner, c, "最高評価(95)の所有者が徴収");
  assert.equal(fee.fee, Math.round(CONFIG.produce.tastingFee * 1.5));
  assert.equal(b.money, bBefore, "低評価側は徴収できない");
  assert.equal(c.money, cBefore + fee.fee);
});

/* ===== Step 5: コレクション（保有ベース） ===== */
test("タイプコレクション：赤白泡ロゼの保有で+50（売ると外れる）", () => {
  const g = newGame();
  const p = curP(g);
  p.wines.push({ type: "std", region: "bordeaux", value: 10 }); // 赤
  p.wines.push({ type: "std", region: "alsace", value: 10 });   // 白
  p.wines.push({ type: "std", region: "tavel", value: 10 });    // ロゼ
  checkSets(g, p);
  assert.equal(p.bonusLog.typeColl, 0, "3タイプでは未完成");
  p.wines.push({ type: "std", region: "champ", value: 10 });    // 泡
  const events = checkSets(g, p);
  assert.ok(events.some(e => e.kind === "typeColl"));
  assert.equal(p.bonusLog.typeColl, CONFIG.bonus.typeSet);
  checkSets(g, p);
  assert.equal(p.bonusLog.typeColl, CONFIG.bonus.typeSet, "二重取得しない");
});

test("産地コレクション：5種で+8・全20種で+40", () => {
  const g = newGame();
  const p = curP(g);
  const ks = country.regionKeys;
  ks.slice(0, 5).forEach(k => p.wines.push({ type: "std", region: k, value: 10 }));
  checkSets(g, p);
  assert.equal(p.bonusLog.regionColl, CONFIG.bonus.regionColl);
  ks.slice(5).forEach(k => p.wines.push({ type: "std", region: k, value: 10 }));
  checkSets(g, p);
  assert.equal(p.bonusLog.regionColl,
    CONFIG.bonus.regionColl * 2 + CONFIG.bonus.regionCompleteBonus, "10種+コンプ");
});

test("地理セット：セット内全産地に畑で+40（畑ベース）", () => {
  const g = newGame();
  const p = curP(g);
  p.assets.champ = { vineyard: true };
  checkSets(g, p);
  assert.equal(p.bonusLog.geoSet, 0);
  p.assets.alsace = { vineyard: true };
  checkSets(g, p);
  assert.equal(p.bonusLog.geoSet, CONFIG.bonus.geoSet, "北東セット完成");
});

test("ヴィンテージコレクション：異なる年3種で+6", () => {
  const g = newGame();
  const p = curP(g);
  [1981, 1982, 1983].forEach(y => p.wines.push({ type: "prem", region: "bordeaux", vintage: y, value: 25 }));
  checkSets(g, p);
  assert.equal(p.bonusLog.vintageColl, CONFIG.bonus.vintageColl);
});

/* ===== Step 6: 市場・オークション ===== */
test("出品と購入：90%価格・出品者に代金・購入者にコレクション判定", () => {
  const g = newGame();
  const [a, b] = g.players;
  const w = { type: "std", region: "bordeaux", value: 20 };
  a.wines.push(w); a.value += 20;
  const m = listWine(g, a, 0, w);
  assert.equal(m.price, 18);
  assert.equal(a.wines.length, 0);
  b.money = 30;
  const aBefore = a.money;
  const r = buyCityWine(g, b, m);
  assert.equal(r.ok, true);
  assert.equal(b.money, 12);
  assert.equal(a.money, aBefore + 18);
  assert.equal(b.wines[0], w);
  assert.equal(g.market.listings.length, 0);
});

test("オークション：開始90%・NPC自動入札・落札で移転", () => {
  const g = newGame({ seed: 3 });
  const [seller, b, c] = g.players;
  const w = { type: "prem", region: "bordeaux", vintage: 1981, value: 50, rating: 95 };
  seller.wines.push(w); seller.value += 50;
  b.money = 200; c.money = 200;
  let result = null;
  runAuction(g, 0, w, (p, info, cb) => cb(false), r => { result = r; });
  assert.ok(result, "同期的に完了する");
  if (result.sold) {
    assert.ok(result.price >= Math.round(50 * 0.9), "開始価格の90%以上");
    const buyer = g.players[result.buyerIdx];
    assert.ok(buyer.wines.includes(w));
    assert.equal(seller.wines.length, 0);
  }
});

test("市場レート：不作年はぶどう高騰・当たり年は値下がり", () => {
  const g = newGame();
  g.vintage.great = "bordeaux"; g.vintage.poor = "rhone";
  const r = marketRates(g);
  assert.equal(r.grapes, CONFIG.marketBase.grapes); // +1-1
  g.vintage.great = null;
  assert.equal(marketRates(g).grapes, CONFIG.marketBase.grapes + 1);
});

/* ===== Step 4: 評論家・ヴィンテージ ===== */
test("ヴィンテージ：当たり年と不作は別産地・次季を先読み", () => {
  const g = newGame();
  rollVintage(g);
  assert.notEqual(g.vintage.great, g.vintage.poor);
  assert.ok(g.vintage.nextGreat);
  assert.equal(g.spotlight.region, g.vintage.great);
});

test("評価：60-100にクランプ・倍率式(90→1.0, 100→1.2)", () => {
  const g = newGame();
  for (let i = 0; i < 50; i++) {
    const r = computeRating(g, curP(g), "bordeaux", { vineyard: true });
    assert.ok(r >= 60 && r <= 100);
  }
  assert.equal(ratingToMult(90), 1);
  assert.ok(Math.abs(ratingToMult(100) - 1.2) < 1e-9);
  assert.ok(Math.abs(ratingToMult(60) - 0.4) < 1e-9);
});

test("評論家：全員巻き込み効果は持ち物が多いほど痛い", () => {
  const g = newGame();
  g.critic.on = 0;
  const [a, b] = g.players;
  a.wines = [{ type: "std", region: "bordeaux", value: 100 }]; a.value = 100;
  b.wines = []; b.value = 0;
  const slash = CRITIC_EFFECTS.find(e => e.special === "allWinesSlash");
  applyCriticEffect(g, slash);
  assert.equal(a.wines[0].value, 80, "2割下落");
  assert.equal(a.value, 80);
  assert.equal(b.value, 0, "持たない人は無傷");
});

test("なすりつけ：同マス接触で移る・1手番1回", () => {
  const g = newGame();
  const [a, b] = g.players;
  g.critic.on = 1; g.cur = 0;
  a.posCell = b.posCell; a.cameFrom = null;
  const to = maybePassCritic(g);
  assert.equal(to, 0, "通過した本人に移る");
  assert.equal(g.critic.passedThisTurn, true);
  assert.equal(maybePassCritic(g), null, "同一手番では再発動しない");
});

/* ===== Step 7: カード ===== */
test("カード定義：19種・重み付き抽選が定義内のキーを返す", () => {
  assert.ok(Object.keys(CARD_DEFS).length >= 18);
  const g = newGame();
  for (let i = 0; i < 30; i++) assert.ok(CARD_DEFS[drawCardKey(g)]);
});

/* ===== Step 2+9: ヘッドレス通しプレイ（NPCのみで5シーズン完走） ===== */
test("スモーク：NPC3人で最後まで完走し勝者が決まる", async () => {
  const g = newGame({ seed: 11 });
  const ranked = await runHeadless(g);
  assert.equal(ranked.length, 3);
  assert.ok(ranked[0].total >= ranked[1].total && ranked[1].total >= ranked[2].total);
  assert.equal(g.season, CONFIG.totalSeasons + 1);
  assert.equal(g.ended, true);
  // 内訳の整合：total = ワイン価値+ボーナス(=value) + money + 資産
  ranked.forEach(e => {
    const b = e.breakdown;
    assert.equal(e.total, b.total);
    assert.ok(b.total >= 0);
  });
});

test("スモーク：異なるseedでも完走する（頑健性）", async () => {
  for (const seed of [1, 5, 23]) {
    const g = newGame({ seed });
    const ranked = await runHeadless(g);
    assert.equal(ranked.length, 3, `seed=${seed}`);
  }
});

test("スモーク：2人・4人でも完走する", async () => {
  const g2 = newGame({ players: [{ name: "A", isNpc: true }, { name: "B", isNpc: true }] });
  assert.equal((await runHeadless(g2)).length, 2);
  const g4 = newGame({
    players: ["A", "B", "C", "D"].map(n => ({ name: n, isNpc: true })), seed: 4,
  });
  assert.equal((await runHeadless(g4)).length, 4);
});

test("サイコロ：出目が先に確定し、表示値と移動数が一致する", async () => {
  const faces = [];
  let moves = 0;
  const g = newGame({
    seed: 9,
    players: [{ name: "A", isNpc: true }, { name: "B", isNpc: true }],
  });
  g.io.diceRolled = (game, info, done) => { faces.push(info); moves = 0; done(); };
  g.io.moved = (game, idx, cellId, done) => { moves++; done(); };
  g.io.turnEnd = (game, p, done) => {
    // 移動歩数 ＝ 確定した total（ワープ以外）
    const last = faces[faces.length - 1];
    if (last && moves > 0) assert.equal(moves, last.total);
    done();
  };
  await runHeadless(g);
  assert.ok(faces.length > 50, "多数のロールが記録された");
  faces.forEach(f => assert.equal(f.total, f.face + f.boost));
});
