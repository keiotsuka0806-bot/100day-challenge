// 食材キーワード → PFC概算 (per serving, g単位)
// 出典: 文部科学省食品成分データベースをもとに概算
const PFC_TABLE = {
  // タンパク質多め
  '鶏': { p: 25, f: 8, c: 0 },
  '豚': { p: 20, f: 15, c: 0 },
  '牛': { p: 22, f: 18, c: 0 },
  '魚': { p: 22, f: 6, c: 0 },
  'サーモン': { p: 20, f: 12, c: 0 },
  'マグロ': { p: 26, f: 2, c: 0 },
  'エビ': { p: 18, f: 1, c: 0 },
  'イカ': { p: 16, f: 1, c: 0 },
  '卵': { p: 6, f: 5, c: 0 },
  '豆腐': { p: 8, f: 4, c: 2 },
  '納豆': { p: 8, f: 5, c: 6 },
  // 炭水化物多め
  'ご飯': { p: 3, f: 0, c: 55 },
  'パスタ': { p: 7, f: 1, c: 42 },
  'パン': { p: 6, f: 4, c: 45 },
  'じゃがいも': { p: 2, f: 0, c: 17 },
  'さつまいも': { p: 1, f: 0, c: 30 },
  // 脂質
  'チーズ': { p: 8, f: 15, c: 1 },
  'バター': { p: 0, f: 12, c: 0 },
  'オリーブ': { p: 0, f: 8, c: 0 },
  // 野菜（低PFC）
  'キャベツ': { p: 1, f: 0, c: 3 },
  'ほうれん草': { p: 2, f: 0, c: 2 },
  'ブロッコリー': { p: 4, f: 0, c: 5 },
  'トマト': { p: 1, f: 0, c: 4 },
  'にんじん': { p: 1, f: 0, c: 9 },
  'ごぼう': { p: 2, f: 0, c: 18 },
  // 汁物
  '味噌': { p: 3, f: 2, c: 8 },
  'だし': { p: 1, f: 0, c: 0 },
};

// カテゴリ別デフォルトPFC（API取得レシピに対するフォールバック）
const CATEGORY_DEFAULT_PFC = {
  soup:  { p: 6,  f: 4,  c: 8  },
  main:  { p: 25, f: 12, c: 5  },
  side:  { p: 4,  f: 3,  c: 10 },
  rice:  { p: 4,  f: 1,  c: 55 },
};

function estimatePfc(materials, category) {
  if (!materials || materials.length === 0) return CATEGORY_DEFAULT_PFC[category] || CATEGORY_DEFAULT_PFC.side;

  let total = { p: 0, f: 0, c: 0 };
  let matched = 0;

  for (const mat of materials) {
    for (const [key, pfc] of Object.entries(PFC_TABLE)) {
      if (mat.includes(key)) {
        total.p += pfc.p;
        total.f += pfc.f;
        total.c += pfc.c;
        matched++;
        break;
      }
    }
  }

  if (matched === 0) return CATEGORY_DEFAULT_PFC[category] || CATEGORY_DEFAULT_PFC.side;

  // 複数マッチは平均を取ってカテゴリ係数で補正
  const scale = category === 'main' ? 1.2 : 0.7;
  return {
    p: Math.round((total.p / matched) * scale),
    f: Math.round((total.f / matched) * scale),
    c: Math.round((total.c / matched) * scale),
  };
}
