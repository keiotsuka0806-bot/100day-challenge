/* 数値バランス（国非依存・設計書§5.7の実装値）。国データには入れない */
export const CONFIG = {
  turnsPerSeason: 7,
  totalSeasons: 5,
  baseYear: 1980, // 表示年 = baseYear + season

  initialResources: { grapes: 2, barrels: 1, money: 10 },

  cost: {
    vineyard:    { money: 5 },
    winery_std:  { grapes: 3, money: 5 },
    winery_prem: { grapes: 1, barrels: 2, money: 8 },
  },
  produce: {
    vineyardGrapes: 2,
    stdWineValue: 10,
    premWineValue: 25,
    tastingFee: 3,
  },
  assetWorth: { vineyard: 5, winery_std: 8, winery_prem: 12 },
  bonus: {
    monopoly: 30,
    geoSet: 40,
    typeSet: 50,
    regionColl: 8,
    regionCompleteBonus: 40,
    vintageColl: 6,
    spotlight: 20,
  },
  reinvest: {
    winery_std:  { grapes: 2, money: 4 },
    winery_prem: { grapes: 1, barrels: 1, money: 6 },
    maxLevel: 3,
  },

  sellRate: 0.7,          // 卸す：価値の70%
  listRate: 0.9,          // 出品・競売開始：価値の90%
  auctionStepRate: 0.1,   // 競り上げ幅 max(2, 価値の10%)
  auctionStepMin: 2,

  fundRoulette: [3, 3, 4, 4, 5, 5, 6, 7, 8, 10, 12, 15, 20],
  slotResources: [
    { k: "grapes",  icon: "🍇", name: "ぶどう", min: 1, max: 5 },
    { k: "barrels", icon: "🛢", name: "樽",     min: 1, max: 3 },
    { k: "money",   icon: "💰", name: "資金",   min: 1, max: 10 },
  ],
  marketBase: { grapes: 3, barrels: 5 }, // 市場マスの基準レート（天候で変動）
  marketCardCost: 8,

  quizReward: 4,          // クイズ正解の資金報酬
  bigCriticChance: 0.2,   // 大物評論家の来訪率/シーズン
  rating: {
    base: 80, great: 8, poor: -6, vineyard: 3, monopoly: 5,
    jitter: 5, bigCriticJitter: 8, min: 60, max: 100,
  },
  vintageMult: { great: 2, poor: 0.5 },

  board: {
    grid: 3.0,            // 格子間隔
    meshBaseProb: 0.32,   // 基本網の接続確率（控えめ）
    minNodeLinks: 2,      // 産地・都市の最低接続数
    maxBranch: 4,         // これ以上の分岐は間引く
  },
};
