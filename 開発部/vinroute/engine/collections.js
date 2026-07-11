/* コレクション判定（保有ベース）＋ボーナス記録
   - 地理セット＝畑の制覇（建設ベース）
   - タイプ/産地/ヴィンテージ＝手元の wines のみで判定（造る/買うを区別しない）
   ボーナスは必ず addBonus 経由で bonusLog に記録（エンディング内訳用） */
import { CONFIG } from "./config.js";

export function addBonus(g, p, cat, amt) {
  p.value += amt;
  if (p.bonusLog && cat in p.bonusLog) p.bonusLog[cat] += amt;
}

/* 産地キー→タイプ表示名 */
export function regionType(g, k) {
  const n = g.country.nodes[k];
  return n && n.kind === "region" ? n.type : null;
}

/* 判定タイミング：建設後・生産後・購入後・落札後に必ず呼ぶ */
export function checkSets(g, p) {
  const events = [];
  p._geoDone = p._geoDone || {};
  p._regionTiers = p._regionTiers || {};
  p._vintTiers = p._vintTiers || {};

  // 地理セット（畑の制覇）
  for (const s in g.country.geoSets) {
    if (!p._geoDone[s] && g.country.geoSets[s].every(k => p.assets[k] && p.assets[k].vineyard)) {
      p._geoDone[s] = true;
      addBonus(g, p, "geoSet", CONFIG.bonus.geoSet);
      events.push({ kind: "geoSet", set: s, bonus: CONFIG.bonus.geoSet });
    }
  }

  // 手元のワインからタイプ・産地・当たり年を集計
  const heldTypes = new Set(), heldRegions = new Set(), heldVintages = new Set();
  p.wines.forEach(w => {
    const t = regionType(g, w.region);
    if (t) heldTypes.add(t);
    (g.country.nodes[w.region]?.altTypes || []).forEach(at => { if (w.type === "prem") heldTypes.add(at); });
    heldRegions.add(w.region);
    if (w.vintage) heldVintages.add(w.vintage);
  });

  // タイプコレクション：typeLabels 全種を保有
  if (!p._typeCollDone && g.country.typeLabels.every(t => heldTypes.has(t))) {
    p._typeCollDone = true;
    addBonus(g, p, "typeColl", CONFIG.bonus.typeSet);
    events.push({ kind: "typeColl", bonus: CONFIG.bonus.typeSet });
  }

  // 産地コレクション：5/10種 ＋ 全産地コンプ
  const totalRegions = g.country.regionKeys.length;
  [5, 10].forEach(tier => {
    if (!p._regionTiers[tier] && heldRegions.size >= tier) {
      p._regionTiers[tier] = true;
      addBonus(g, p, "regionColl", CONFIG.bonus.regionColl);
      events.push({ kind: "regionColl", tier, bonus: CONFIG.bonus.regionColl });
    }
  });
  if (!p._regionTiers.full && heldRegions.size >= totalRegions) {
    p._regionTiers.full = true;
    addBonus(g, p, "regionColl", CONFIG.bonus.regionCompleteBonus);
    events.push({ kind: "regionComplete", bonus: CONFIG.bonus.regionCompleteBonus });
  }

  // ヴィンテージコレクション：異なる年 3/5種
  [3, 5].forEach(tier => {
    if (!p._vintTiers[tier] && heldVintages.size >= tier) {
      p._vintTiers[tier] = true;
      addBonus(g, p, "vintageColl", CONFIG.bonus.vintageColl);
      events.push({ kind: "vintageColl", tier, bonus: CONFIG.bonus.vintageColl });
    }
  });

  return events;
}

/* 独占：1産地に自分の3資産 */
export function checkMonopoly(g, p, k) {
  const a = p.assets[k];
  if (a && a.vineyard && a.winery_std && a.winery_prem && !a._monopoly) {
    a._monopoly = true;
    addBonus(g, p, "monopoly", CONFIG.bonus.monopoly);
    return true;
  }
  return false;
}
