const MOOD_TAG_KEYWORDS = {
  '和食':     ['みそ', '醤油', '和風', '煮', 'だし', '照り焼き', '唐揚げ', '豚汁'],
  '洋食':     ['トマト', 'チーズ', 'バター', 'クリーム', 'グラタン', 'ハンバーグ', 'オムレツ'],
  '中華':     ['中華', '炒飯', '餃子', 'チンジャオ', '麻婆', '八宝'],
  'イタリアン': ['パスタ', 'ピザ', 'リゾット', 'バジル', 'オリーブ'],
  '肉':       ['鶏', '豚', '牛', 'ひき肉', 'ベーコン', 'ハム', 'ソーセージ'],
  '魚':       ['魚', 'サーモン', 'マグロ', 'アジ', 'サバ', 'タラ', 'エビ', 'イカ', 'タコ'],
  '野菜':     ['野菜', 'キャベツ', 'ほうれん草', 'ブロッコリー', 'トマト', 'にんじん'],
  '卵・豆腐':  ['卵', '豆腐', '厚揚げ', '油揚げ', '納豆'],
  'さっぱり':  ['ポン酢', '塩', 'レモン', 'さっぱり', '酢', 'マリネ'],
  'がっつり':  ['揚げ', 'カツ', 'バター', 'カレー', '濃厚', 'こってり'],
  '温かい':   ['鍋', '汁', 'スープ', 'シチュー', '煮込み', 'おでん'],
  '冷たい':   ['冷製', 'サラダ', '冷奴', 'ゼリー'],
};

function scoreRecipe(recipe, moodTags, recentlyEaten, pfcDeficit) {
  let score = 1.0;

  // 気分バイアス: マッチしたら3倍
  for (const tag of moodTags) {
    const keywords = MOOD_TAG_KEYWORDS[tag] || [];
    const text = recipe.title + recipe.materials.join('');
    if (keywords.some(k => text.includes(k))) {
      score *= 3;
      break;
    }
  }

  // 直近7日に食べたものは確率を下げる
  if (recentlyEaten.has(recipe.id)) score *= 0.1;

  // PFC不足への対応: 最も不足している栄養素を含む料理を優先
  if (pfcDeficit) {
    const { p, f, c } = recipe.pfc;
    const deficit = pfcDeficit;
    if (deficit.p > deficit.f && deficit.p > deficit.c && p > 15) score *= 2;
    else if (deficit.f > deficit.p && deficit.f > deficit.c && f > 10) score *= 2;
    else if (deficit.c > deficit.p && deficit.c > deficit.f && c > 20) score *= 2;
  }

  return score;
}

function weightedRandom(items, scores) {
  const total = scores.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= scores[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickOne(pool, moodTags, recentlyEaten, pfcDeficit) {
  if (!pool || pool.length === 0) return null;
  const scores = pool.map(r => scoreRecipe(r, moodTags, recentlyEaten, pfcDeficit));
  return weightedRandom(pool, scores);
}

function buildMealSet(recipes, moodTags, recentlyEaten, pfcDeficit) {
  return {
    soup:  pickOne(recipes.soup,  moodTags, recentlyEaten, pfcDeficit),
    main:  pickOne(recipes.main,  moodTags, recentlyEaten, pfcDeficit),
    side1: pickOne(recipes.side,  moodTags, recentlyEaten, pfcDeficit),
    side2: pickOne(recipes.side.filter(r =>
      !recipes.side.indexOf || true // 重複を避けるため別途処理
    ), moodTags, recentlyEaten, pfcDeficit),
  };
}

function buildMealSetNoDuplicate(recipes, moodTags, recentlyEaten, pfcDeficit) {
  const soup  = pickOne(recipes.soup, moodTags, recentlyEaten, pfcDeficit);
  const main  = pickOne(recipes.main, moodTags, recentlyEaten, pfcDeficit);
  const side1 = pickOne(recipes.side, moodTags, recentlyEaten, pfcDeficit);
  const sidePool2 = recipes.side.filter(r => r.id !== side1?.id);
  const side2 = pickOne(sidePool2.length > 0 ? sidePool2 : recipes.side, moodTags, recentlyEaten, pfcDeficit);
  return { soup, main, side1, side2 };
}

function calcTotalPfc(mealSet, staple) {
  const total = { p: 0, f: 0, c: 0 };
  if (staple) { total.p += staple.p; total.f += staple.f; total.c += staple.c; }
  for (const dish of [mealSet.soup, mealSet.main, mealSet.side1, mealSet.side2]) {
    if (!dish) continue;
    total.p += dish.pfc.p;
    total.f += dish.pfc.f;
    total.c += dish.pfc.c;
  }
  return total;
}
