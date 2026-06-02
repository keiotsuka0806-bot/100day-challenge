const RAKUTEN_API_BASE = 'https://openapi.rakuten.co.jp/recipems/api/Recipe';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6時間
const CACHE_KEY = 'nani_taberu_recipes_v11';

// カテゴリIDとroleの対応（和洋中バランス）
const CATEGORY_ROLE_MAP = [
  { id: '17',  role: 'soup' },  // 汁物・スープ全般（和洋中ミックス）
  { id: '31',  role: 'main' },  // 定番の肉料理（全ジャンル）
  { id: '41',  role: 'main' },  // 中華料理
  { id: '18',  role: 'side' },  // サラダ全般
  { id: '35',  role: 'side' },  // 大豆・豆腐
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    console.error('[NaniTaberu] API error:', res.status, body);
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

async function fetchCategoryRanking(categoryId) {
  const url = `${RAKUTEN_API_BASE}/CategoryRanking/20170426?format=json&applicationId=${CONFIG.rakutenAppId}&accessKey=${CONFIG.rakutenAccessKey}&categoryId=${categoryId}`;
  const data = await fetchJson(url);
  return (data.result || []).map(r => ({
    id: r.recipeId,
    title: r.recipeTitle,
    image: r.foodImageUrl,
    url: r.recipeUrl,
    materials: r.recipeMaterial || [],
    indication: r.recipeIndication || '',
    description: r.recipeDescription || '',
  }));
}

async function loadRecipes() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) return data;
    } catch (e) {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  const recipes = { soup: [], main: [], side: [] };
  const seen = new Set();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (const { id, role } of CATEGORY_ROLE_MAP) {
    try {
      const items = await fetchCategoryRanking(id);
      for (const r of items) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        recipes[role].push({ ...r, pfc: estimatePfc(r.materials, role), role });
      }
    } catch (e) {
      console.warn(`[NaniTaberu] カテゴリ${id} スキップ`);
    }
    await sleep(1100);
  }
  console.log(`[NaniTaberu] API完了: soup=${recipes.soup.length}, main=${recipes.main.length}, side=${recipes.side.length}`);

  // フォールバックで常に補完（重複IDは除く）
  const addFallback = (pool, fallback) => {
    const ids = new Set(pool.map(r => String(r.id)));
    fallback.forEach(r => { if (!ids.has(String(r.id))) pool.push(r); });
  };
  addFallback(recipes.soup, FALLBACK_RECIPES.soup);
  addFallback(recipes.main, FALLBACK_RECIPES.main);
  addFallback(recipes.main, FALLBACK_RECIPES.extra_main || []);
  addFallback(recipes.side, FALLBACK_RECIPES.side);

  // 全滅の場合はフォールバックのみ
  if (recipes.soup.length === 0 && recipes.main.length === 0 && recipes.side.length === 0) {
    return FALLBACK_RECIPES;
  }

  console.log(`[NaniTaberu] 完了: soup=${recipes.soup.length}, main=${recipes.main.length}, side=${recipes.side.length}`);
  localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: recipes }));
  return recipes;
}

function clearRecipeCache() {
  localStorage.removeItem(CACHE_KEY);
}
