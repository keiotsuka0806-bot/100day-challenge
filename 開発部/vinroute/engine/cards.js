/* カード：データ定義（CARD_DEFS）＋効果適用。データ追加だけで拡張できる（目標50種） */
import { weightedPick } from "./rng.js";
import { checkMonopoly, checkSets } from "./collections.js";

export const CARD_DEFS = {
  // 移動系
  express1:  { cat: "移動", icon: "🚃", name: "急行・小", desc: "次のサイコロ+2", eff: { addDice: 2 }, w: 3 },
  express2:  { cat: "移動", icon: "🚄", name: "急行", desc: "次のサイコロ+3", eff: { addDice: 3 }, w: 3 },
  express3:  { cat: "移動", icon: "🚅", name: "特急", desc: "次のサイコロ+5", eff: { addDice: 5 }, w: 1 },
  pinpoint:  { cat: "移動", icon: "🎯", name: "ぴったり", desc: "次に好きな目を出せる", special: "pinpoint", w: 2 },
  warp:      { cat: "移動", icon: "🌀", name: "ワープ", desc: "好きな産地へ移動", special: "warp", w: 2 },
  double:    { cat: "移動", icon: "🎲", name: "倍速", desc: "サイコロを2個振る", eff: { dice2: true }, w: 2 },
  // 資源系
  harvest:   { cat: "資源", icon: "🧺", name: "収穫", desc: "ぶどう+3・樽+1", eff: { grapes: 3, barrels: 1 }, w: 3 },
  grapesBig: { cat: "資源", icon: "🍇", name: "豊作", desc: "ぶどう+5", eff: { grapes: 5 }, w: 2 },
  barrelBuy: { cat: "資源", icon: "🛢", name: "樽仕入れ", desc: "樽+3", eff: { barrels: 3 }, w: 2 },
  fund:      { cat: "資源", icon: "💰", name: "資金調達", desc: "資金+8", eff: { money: 8 }, w: 3 },
  // 建設・ワイン系
  quickBuild:{ cat: "建設", icon: "🏗", name: "即建設", desc: "畑を無料で1つ建てる", special: "quickBuild", w: 2 },
  aging:     { cat: "建設", icon: "⏳", name: "熟成促進", desc: "手持ちワイン全部の価値+5", special: "aging", w: 1 },
  // 防御・妨害系
  defense:   { cat: "防御", icon: "🛡", name: "防御", desc: "評論家を1回無効化", eff: { defend: true }, w: 3 },
  sabotage:  { cat: "妨害", icon: "💢", name: "資金強奪", desc: "他プレイヤーの資金を3奪う", special: "sabotage", w: 2 },
  steal:     { cat: "妨害", icon: "🍇", name: "ぶどう泥棒", desc: "他プレイヤーのぶどうを2奪う", special: "stealGrapes", w: 2 },
  passcritic:{ cat: "妨害", icon: "🧐", name: "評論家なすりつけ", desc: "憑いている評論家を他プレイヤーに押し付ける", special: "passCritic", w: 2 },
  // 特殊系
  foresee:   { cat: "特殊", icon: "🔮", name: "ヴィンテージ予知", desc: "次の当たり年を今見る", special: "foresee", w: 1 },
  quizPass:  { cat: "特殊", icon: "📖", name: "ソムリエの知恵", desc: "次のクイズを自動正解", eff: { quizPass: true }, w: 1 },
};
export const CARD_KEYS = Object.keys(CARD_DEFS);

export function drawCardKey(g) {
  const items = CARD_KEYS.map(k => ({ key: k, w: CARD_DEFS[k].w || 1 }));
  return weightedPick(items, g.rand).key;
}

/* 宣言的効果（eff）を適用。UI選択が要らないぶんだけここで完結 */
export function applyCardEff(g, p, key) {
  const d = CARD_DEFS[key];
  if (!d || !d.eff) return false;
  const e = d.eff;
  if (e.addDice) g.dice.pendingBonus += e.addDice;
  if (e.dice2) g.dice.pendingDice2 = true;
  if (e.grapes) p.grapes += e.grapes;
  if (e.barrels) p.barrels += e.barrels;
  if (e.money) p.money += e.money;
  if (e.defend) p.defended = true;
  if (e.quizPass) p.quizPass = true;
  return true;
}

/* 即建設：今いる産地に畑を無料建設。建てられなければ false（カード温存） */
export function quickBuildVineyard(g, p) {
  const c = g.board.cells[p.posCell];
  if (c.type !== "node") return false;
  const node = g.country.nodes[c.payload];
  if (!node || node.kind !== "region") return false;
  const k = c.payload;
  if (p.assets[k] && p.assets[k].vineyard) return false;
  if (g.owned[k] === undefined || g.owned[k] === null) g.owned[k] = g.cur;
  if (!p.assets[k]) p.assets[k] = {};
  p.assets[k].vineyard = true;
  checkMonopoly(g, p, k);
  checkSets(g, p);
  return true;
}

/* 資源を最も多く持つ他プレイヤーから奪う。奪えなければ false */
export function stealResource(g, p, res, amt) {
  let victim = null, max = -1;
  g.players.forEach((o, i) => {
    if (i !== g.cur && o[res] > max) { max = o[res]; victim = o; }
  });
  if (victim && victim[res] > 0) {
    const take = Math.min(amt, victim[res]);
    victim[res] -= take; p[res] += take;
    return { victim, take };
  }
  return false;
}
