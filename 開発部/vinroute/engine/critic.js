/* 評論家（ボンビー枠）：憑依・ティア制ダメージテーブル・なすりつけ
   効果はデータ定義（設計書§6.1）。全員一律ペナルティは不採用（順位が変わらないため） */
import { weightedPick } from "./rng.js";
import { totalAssets } from "./economy.js";

export const CRITIC_EFFECTS = [
  // 軽い（高頻度）
  { tier: "light", w: 5, msg: "小言を言われた 価値-2", eff: { value: -2 } },
  { tier: "light", w: 4, msg: "ぶどうにケチ ぶどう-1", eff: { grapes: -1 } },
  { tier: "light", w: 4, msg: "樽に難癖 樽-1", eff: { barrels: -1 } },
  { tier: "light", w: 3, msg: "「今日は…まあいい」無害", eff: {} },
  // 中くらい（中頻度）
  { tier: "mid", w: 2, msg: "酷評された 価値-5", eff: { value: -5 } },
  { tier: "mid", w: 2, msg: "「買い取れない」資金-4", eff: { money: -4 } },
  { tier: "mid", w: 2, msg: "動揺で次のサイコロが1に…", special: "forceOne" },
  { tier: "mid", w: 1, msg: "呆れられて1回休み", special: "skip" },
  // 大惨事（レア）：首位狙い
  { tier: "chaos", w: 2, msg: "🔥世紀の酷評！価値-15", eff: { value: -15 } },
  { tier: "chaos", w: 2, msg: "🔥全銘柄に酷評！ワイン価値まとめて下落", special: "slashWines" },
  { tier: "chaos", w: 1, msg: "🔥スキャンダル！資金-10・2回休み", special: "scandal" },
  // 大惨事（レア）：全員巻き込み（持ち物が多い人ほど痛い＝相対順位にも効く）
  { tier: "chaos", w: 1, msg: "🔥市場大暴落！全員のワイン価値が2割下落", special: "allWinesSlash" },
  { tier: "chaos", w: 1, msg: "🔥病害が蔓延！全員ぶどう半減", special: "allGrapesHalf" },
  { tier: "chaos", w: 1, msg: "🔥増税！全員 資金の3割を徴収", special: "allMoneyTax" },
];

/* 道中の評論家ダメージマス（単発スロット）用の軽い効果 */
export const CRITIC_LINES = [
  { t: "「この畑のぶどうは凡庸だ」", eff: { money: -2 }, msg: "資金-2" },
  { t: "「熟成が足りん、話にならん」", eff: { grapes: -1 }, msg: "ぶどう-1" },
  { t: "「樽の香りが強すぎる」", eff: { barrels: -1 }, msg: "樽-1" },
  { t: "「まあ…悪くはない、が」", eff: { money: -1 }, msg: "資金-1" },
  { t: "「この価格設定は許せん」", eff: { money: -3 }, msg: "資金-3" },
  { t: "「収穫が雑だな」", eff: { grapes: -2 }, msg: "ぶどう-2" },
  { t: "「今日は…見逃してやろう」", eff: {}, msg: "無害！セーフ" },
  { t: "「テロワールが泣いている」", eff: { value: -3 }, msg: "価値-3" },
];

export function pickCriticEffect(g) { return weightedPick(CRITIC_EFFECTS, g.rand); }
export function pickCriticLine(g) { return CRITIC_LINES[Math.floor(g.rand() * CRITIC_LINES.length)]; }

/* 憑依：exemptIdx（注目産地一番乗り者）を除いた総資産首位に憑く */
export function attachCriticToLeader(g, exemptIdx) {
  let leader = -1, max = -Infinity;
  g.players.forEach((p, i) => {
    if (i === exemptIdx) return;
    const t = totalAssets(g, p);
    if (t > max) { max = t; leader = i; }
  });
  if (leader < 0) return null;
  g.critic.on = leader;
  return leader;
}

/* 毎ターンダメージの効果適用（演出はUI側）。戻り値＝適用した効果 */
export function applyCriticEffect(g, effect) {
  const p = g.players[g.critic.on];
  if (effect.eff) {
    for (const k in effect.eff) p[k] = Math.max(0, (p[k] || 0) + effect.eff[k]);
  }
  switch (effect.special) {
    case "forceOne": g.dice.forced = 1; break;
    case "skip": p.skipNext = true; break;
    case "slashWines": slashWines(p); break;
    case "scandal": p.money = Math.max(0, p.money - 10); p.skipNext = true; p.skipTwice = true; break;
    case "allWinesSlash": g.players.forEach(slashWines); break;
    case "allGrapesHalf": g.players.forEach(o => { o.grapes = Math.floor(o.grapes / 2); }); break;
    case "allMoneyTax": g.players.forEach(o => { o.money = Math.max(0, o.money - Math.round(o.money * 0.3)); }); break;
  }
  return effect;
}

function slashWines(p) {
  let lost = 0;
  p.wines.forEach(w => {
    const cut = Math.max(1, Math.round(w.value * 0.2));
    w.value -= cut; lost += cut;
  });
  p.value = Math.max(0, p.value - lost);
}

/* なすりつけ：同マス接触 or すれ違いで移る（1手番1回） */
export function maybePassCritic(g) {
  if (g.critic.on === null || g.critic.passedThisTurn) return null;
  const moverIdx = g.cur;
  const mover = g.players[moverIdx];
  const moverCells = [mover.posCell, mover.cameFrom].filter(Boolean);
  if (g.critic.on === moverIdx) {
    // 憑かれた本人が移動 → 同じマスにいる相手に押し付け
    for (let i = 0; i < g.players.length; i++) {
      if (i !== moverIdx && g.players[i].posCell === mover.posCell) return passCriticTo(g, i);
    }
    return null;
  }
  // 別人が、憑かれた人のマスを通過/交差
  const holder = g.players[g.critic.on];
  if (moverCells.includes(holder.posCell)) return passCriticTo(g, moverIdx);
  return null;
}

export function passCriticTo(g, i) {
  g.critic.on = i;
  g.critic.passedThisTurn = true;
  return i;
}
