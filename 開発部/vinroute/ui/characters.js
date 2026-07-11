/* プレイヤーキャラクター台帳（AI生成のシリコンフィギュア・assets/game/char/）
   color はHUDチップ・所有マーカー・凡例で使うテーマ色 */
export const CHARACTERS = [
  { id: "chardonnay", name: "シャルドネ", desc: "陽気なソムリエ", color: "#c9a13a" },
  { id: "merlot",     name: "メルロ",     desc: "無口な醸造家",   color: "#3c466e" },
  { id: "pinot",      name: "ピノ",       desc: "若手バイヤー",   color: "#2f5d46" },
  { id: "nebbiolo",   name: "ネッビオロ", desc: "放浪の評論家",   color: "#5c3a4e" },
  { id: "verde",      name: "ヴェルデ",   desc: "畑の管理人",     color: "#7a8a3f" },
  { id: "barrique",   name: "バリック",   desc: "樽職人見習い",   color: "#8a5a2e" },
];
export const charSprite = id => `assets/game/char/${id}.png`;
