// map.js — 260産地 世界ワインマップ（ソムリエ教本準拠）

const CANVAS_W = 1800;
const CANVAS_H = 1000;
const HEX_RADIUS = 16;

const RESOURCE_COLORS = {
  cabernet:   '#8B1A1A',
  pinot:      '#C0392B',
  chardonnay: '#C9A84C',
  riesling:   '#7AAE60',
  blend:      '#7D3C98',
  gold:       '#D4AF37',
  knowledge:  '#3A7BD5'
};
const RESOURCE_NAMES = {
  cabernet:   'カベルネ',
  pinot:      'ピノ・ノワール',
  chardonnay: 'シャルドネ',
  riesling:   'リースリング',
  blend:      'ブレンド',
  gold:       'ゴールド',
  knowledge:  '知識'
};
const RESOURCE_ICONS = {
  cabernet: '🍇', pinot: '🍷', chardonnay: '🌕', riesling: '🌿', blend: '🔮', gold: '🪙', knowledge: '🧭'
};

const STARTER_VISIBLE_REGION_IDS = [
  'paris', 'champagne', 'chablis', 'alsace', 'burgundy',
  'loire', 'touraine', 'anjou', 'muscadet', 'sancerre',
  'bordeaux', 'medoc', 'sauternes', 'cognac', 'bergerac',
  'rhone', 'beaujolais', 'macon', 'jura', 'pouillyfume'
];

const COUNTRY_ZONE_MAP = {
  'フランス': 'france_core',
  'スペイン': 'western_europe',
  'ポルトガル': 'western_europe',
  'モロッコ': 'western_europe',
  'アルジェリア': 'western_europe',
  'イタリア': 'mediterranean_arc',
  'ギリシャ': 'mediterranean_arc',
  'クロアチア': 'mediterranean_arc',
  'スロヴェニア': 'mediterranean_arc',
  'ボスニア': 'mediterranean_arc',
  'トルコ': 'mediterranean_arc',
  'キプロス': 'mediterranean_arc',
  'イスラエル': 'mediterranean_arc',
  'レバノン': 'mediterranean_arc',
  'ジョージア': 'eastern_frontier',
  'アルメニア': 'eastern_frontier',
  'モルドバ': 'eastern_frontier',
  'ルーマニア': 'eastern_frontier',
  'ブルガリア': 'eastern_frontier',
  'ハンガリー': 'central_europe',
  'チェコ': 'central_europe',
  'ドイツ': 'central_europe',
  'オーストリア': 'central_europe',
  'スイス': 'central_europe',
  'カナダ': 'americas',
  'アメリカ': 'americas',
  'アルゼンチン': 'americas',
  'チリ': 'americas',
  '南アフリカ': 'southern_hemisphere',
  'オーストラリア': 'southern_hemisphere',
  'ニュージーランド': 'southern_hemisphere',
  'ケニア': 'southern_hemisphere',
  'エチオピア': 'southern_hemisphere',
  '中国': 'asia_frontier',
  '日本': 'asia_frontier'
};

const ZONE_LABELS = {
  france_core: 'フランス',
  western_europe: '西ヨーロッパ',
  mediterranean_arc: '地中海圏',
  central_europe: '中欧',
  eastern_frontier: '東方圏',
  americas: 'アメリカ大陸',
  southern_hemisphere: '南半球',
  asia_frontier: 'アジア圏',
  frontier: 'フロンティア'
};

const REGION_SET_MAP = {
  paris: 'paris_ring',
  champagne: 'paris_ring',
  chablis: 'paris_ring',
  alsace: 'paris_ring',
  burgundy: 'paris_ring',
  loire: 'loire_loop',
  touraine: 'loire_loop',
  anjou: 'loire_loop',
  muscadet: 'loire_loop',
  sancerre: 'loire_loop',
  bordeaux: 'atlantic',
  medoc: 'atlantic',
  sauternes: 'atlantic',
  cognac: 'atlantic',
  bergerac: 'atlantic',
  rhone: 'rhone_arc',
  beaujolais: 'rhone_arc',
  macon: 'rhone_arc',
  jura: 'rhone_arc',
  pouillyfume: 'rhone_arc'
};

const SET_LABELS = {
  paris_ring: 'パリ環状',
  loire_loop: 'ロワール回廊',
  atlantic: '大西洋回廊',
  rhone_arc: 'ローヌ弧'
};

const SET_BONUSES = {
  paris_ring: 9,
  loire_loop: 9,
  atlantic: 9,
  rhone_arc: 9
};

const REGION_STRATEGY_OVERRIDES = {
  paris: {
    value: 8,
    climate: 'Cool',
    resources: ['knowledge', 'gold'],
    specialEffect: '最初の分岐点。どのルートにもつながる'
  },
  burgundy: {
    value: 9,
    climate: 'Cool',
    resources: ['pinot', 'knowledge'],
    specialEffect: 'Pinot系市場イベント時に収益+2'
  },
  napa: {
    value: 8,
    climate: 'Warm',
    resources: ['cabernet', 'gold'],
    specialEffect: '工房建設コスト-1'
  },
  mosel: {
    value: 7,
    climate: 'Cool',
    resources: ['riesling', 'knowledge'],
    specialEffect: '知識チャレンジ成功時に追加カード+1'
  },
  champagne: {
    value: 8,
    climate: 'Cool',
    resources: ['chardonnay', 'knowledge'],
    specialEffect: 'Sparkling系市場イベント時に収益+3'
  },
  rioja: {
    value: 7,
    climate: 'Warm',
    resources: ['blend', 'knowledge'],
    specialEffect: '市場情報カードの効果+1'
  },
  douro: {
    value: 7,
    climate: 'Warm',
    resources: ['blend', 'gold'],
    specialEffect: '市場イベント時の収益+1'
  },
  tuscany: {
    value: 8,
    climate: 'Warm',
    resources: ['blend', 'knowledge'],
    specialEffect: '畑建設時に追加資源+1'
  },
  piedmont: {
    value: 8,
    climate: 'Cool',
    resources: ['blend', 'knowledge'],
    specialEffect: '高価値カードを先に取ると資産+1'
  },
  willamette: {
    value: 7,
    climate: 'Cool',
    resources: ['pinot', 'knowledge'],
    specialEffect: 'ピノ系の収益+1'
  },
  mendoza: {
    value: 7,
    climate: 'Dry',
    resources: ['cabernet', 'gold'],
    specialEffect: '市場イベントの影響を受けやすい'
  },
  maipo: {
    value: 6,
    climate: 'Warm',
    resources: ['cabernet', 'knowledge'],
    specialEffect: '建設コスト-1'
  },
  barossa: {
    value: 8,
    climate: 'Hot',
    resources: ['cabernet', 'gold'],
    specialEffect: '熱量系イベント時に収益+2'
  },
  marlborough: {
    value: 8,
    climate: 'Cool',
    resources: ['riesling', 'knowledge'],
    specialEffect: '市場情報カードを引きやすい'
  },
  capetown: {
    value: 7,
    climate: 'Warm',
    resources: ['blend', 'knowledge'],
    specialEffect: '貿易系イベント時に収益+2'
  },
  swartland: {
    value: 6,
    climate: 'Hot',
    resources: ['blend', 'gold'],
    specialEffect: '畑建設コスト-1'
  },
  tokaj: {
    value: 7,
    climate: 'Cool',
    resources: ['riesling', 'knowledge'],
    specialEffect: '知識報酬を市場情報に変換しやすい'
  },
  wachau: {
    value: 7,
    climate: 'Cool',
    resources: ['riesling', 'knowledge'],
    specialEffect: '隣接地域の価値+1'
  },
  jerez: {
    value: 7,
    climate: 'Warm',
    resources: ['blend', 'gold'],
    specialEffect: '交易収益+1'
  },
  priorat: {
    value: 7,
    climate: 'Warm',
    resources: ['blend', 'knowledge'],
    specialEffect: '高価値イベントの追い風を受けやすい'
  }
};

function getRegionZone(region) {
  return COUNTRY_ZONE_MAP[region.country] || 'frontier';
}

function getZoneLabel(zone) {
  return ZONE_LABELS[zone] || zone;
}

function getSetId(regionId) {
  return REGION_SET_MAP[regionId] || null;
}

function getSetLabel(setId) {
  return SET_LABELS[setId] || setId || '';
}

function getSetBonus(setId) {
  return SET_BONUSES[setId] || 0;
}

function inferClimate(region) {
  const y = region.y;
  if (region.country === 'オーストラリア' || region.country === '南アフリカ') return y > 650 ? 'Hot' : 'Warm';
  if (region.country === 'ニュージーランド' || region.country === 'カナダ' || region.country === 'ドイツ' || region.country === 'スイス') return 'Cool';
  if (y < 220) return 'Cool';
  if (y < 420) return 'Temperate';
  if (y < 620) return 'Warm';
  return 'Hot';
}

function getDefaultRegionValue(region) {
  const base = { cabernet: 6, pinot: 7, chardonnay: 5, riesling: 5, blend: 6 };
  return base[region.resource] || 5;
}

function getRegionStrategy(regionId) {
  const region = REGION_DATA[regionId];
  if (!region) return null;
  const override = REGION_STRATEGY_OVERRIDES[regionId] || {};
  const zone = getRegionZone(region);
  const setId = getSetId(regionId);
  return {
    id: regionId,
    name: region.name,
    country: region.country,
    zone,
    setId,
    setLabel: getSetLabel(setId),
    climate: override.climate || inferClimate(region),
    resource: region.resource,
    value: override.value ?? getDefaultRegionValue(region),
    resources: override.resources || [region.resource],
    specialEffect: override.specialEffect || '市場と建設の組み合わせで価値が上がる',
    x: region.x,
    y: region.y,
    adjacent: region.adjacent
  };
}

function getVisibleRegionIds(state) {
  const visible = new Set(STARTER_VISIBLE_REGION_IDS);
  if (!state) return [...visible];

  if (Array.isArray(state.visibleRegions)) {
    state.visibleRegions.forEach(id => visible.add(id));
  }
  if (state.unlockedZones) {
    for (const [id, region] of Object.entries(REGION_DATA)) {
      if (state.unlockedZones.has(getRegionZone(region))) visible.add(id);
    }
  }
  return [...visible];
}

function isRegionVisible(regionId, state) {
  return getVisibleRegionIds(state).includes(regionId);
}

// ===== 産地定義（260産地）=====
const REGION_DATA = {

  // ===== フランス (30) =====
  paris:       { name: 'パリ',               country: 'フランス', resource: 'knowledge', x: 430, y: 118, adjacent: ['champagne','burgundy','loire'] },
  muscadet:    { name: 'ミュスカデ',         country: 'フランス', resource: 'riesling',   x: 278, y: 168, adjacent: ['loire','cognac'] },
  touraine:    { name: 'トゥーレーヌ',       country: 'フランス', resource: 'riesling',   x: 355, y: 148, adjacent: ['muscadet','sancerre','loire'] },
  anjou:       { name: 'アンジュー',         country: 'フランス', resource: 'blend',      x: 318, y: 155, adjacent: ['muscadet','touraine','loire'] },
  sancerre:    { name: 'サンセール',         country: 'フランス', resource: 'riesling',   x: 470, y: 172, adjacent: ['touraine','pouillyfume','chablis'] },
  pouillyfume: { name: 'プイィ・フュメ',     country: 'フランス', resource: 'riesling',   x: 490, y: 190, adjacent: ['sancerre','chablis','burgundy'] },
  champagne:   { name: 'シャンパーニュ',     country: 'フランス', resource: 'chardonnay', x: 482, y: 108, adjacent: ['paris','sancerre','alsace','burgundy','chablis'] },
  chablis:     { name: 'シャブリ',           country: 'フランス', resource: 'chardonnay', x: 506, y: 196, adjacent: ['champagne','sancerre','pouillyfume','burgundy'] },
  alsace:      { name: 'アルザス',           country: 'フランス', resource: 'riesling',   x: 602, y: 128, adjacent: ['champagne','mosel','jura','burgundy'] },
  loire:       { name: 'ロワール',           country: 'フランス', resource: 'riesling',   x: 324, y: 162, adjacent: ['paris','champagne','bordeaux','touraine','anjou','muscadet'] },
  bordeaux:    { name: 'ボルドー',           country: 'フランス', resource: 'cabernet',   x: 362, y: 272, adjacent: ['loire','rioja','burgundy','cognac','bergerac','madiran'] },
  medoc:       { name: 'メドック',           country: 'フランス', resource: 'cabernet',   x: 338, y: 295, adjacent: ['bordeaux','cognac'] },
  sauternes:   { name: 'ソーテルヌ',         country: 'フランス', resource: 'chardonnay', x: 358, y: 312, adjacent: ['bordeaux','bergerac'] },
  cognac:      { name: 'コニャック',         country: 'フランス', resource: 'blend',      x: 310, y: 268, adjacent: ['bordeaux','muscadet','medoc'] },
  bergerac:    { name: 'ベルジュラック',     country: 'フランス', resource: 'blend',      x: 376, y: 300, adjacent: ['bordeaux','sauternes','cahors'] },
  cahors:      { name: 'カオール',           country: 'フランス', resource: 'blend',      x: 402, y: 350, adjacent: ['bergerac','armagnac','madiran'] },
  armagnac:    { name: 'アルマニャック',     country: 'フランス', resource: 'blend',      x: 352, y: 385, adjacent: ['cahors','madiran'] },
  madiran:     { name: 'マディラン',         country: 'フランス', resource: 'blend',      x: 368, y: 418, adjacent: ['armagnac','cahors','rioja','vinhoverdo'] },
  burgundy:    { name: 'ブルゴーニュ',       country: 'フランス', resource: 'pinot',      x: 530, y: 250, adjacent: ['paris','champagne','alsace','bordeaux','rhone','beaujolais','chablis','jura','macon'] },
  cotenuits:   { name: 'コート・ド・ニュイ', country: 'フランス', resource: 'pinot',      x: 548, y: 268, adjacent: ['burgundy','cotebeaune'] },
  cotebeaune:  { name: 'コート・ド・ボーヌ', country: 'フランス', resource: 'chardonnay', x: 548, y: 292, adjacent: ['cotenuits','macon','beaujolais'] },
  macon:       { name: 'マコネー',           country: 'フランス', resource: 'chardonnay', x: 536, y: 318, adjacent: ['burgundy','cotebeaune','beaujolais'] },
  beaujolais:  { name: 'ボジョレー',         country: 'フランス', resource: 'pinot',      x: 516, y: 340, adjacent: ['burgundy','macon','rhone','jura'] },
  jura:        { name: 'ジュラ',             country: 'フランス', resource: 'chardonnay', x: 620, y: 220, adjacent: ['alsace','burgundy','savoie','vaud','beaujolais'] },
  savoie:      { name: 'サヴォワ',           country: 'フランス', resource: 'riesling',   x: 640, y: 268, adjacent: ['jura','vaud','piedmont'] },
  rhone:       { name: 'ローヌ',             country: 'フランス', resource: 'blend',      x: 552, y: 368, adjacent: ['burgundy','beaujolais','provence','languedoc'] },
  costierenimes:{ name: 'コスティエール',    country: 'フランス', resource: 'blend',      x: 522, y: 420, adjacent: ['rhone','languedoc'] },
  languedoc:   { name: 'ラングドック',       country: 'フランス', resource: 'blend',      x: 490, y: 442, adjacent: ['rhone','roussillon','provence','costierenimes'] },
  roussillon:  { name: 'ルーシヨン',         country: 'フランス', resource: 'blend',      x: 447, y: 468, adjacent: ['languedoc','rioja','priorat'] },
  provence:    { name: 'プロヴァンス',       country: 'フランス', resource: 'blend',      x: 596, y: 415, adjacent: ['rhone','corsica','languedoc'] },
  corsica:     { name: 'コルシカ',           country: 'フランス', resource: 'blend',      x: 638, y: 462, adjacent: ['provence','tuscany','sardinia'] },

  // ===== ドイツ (12) =====
  ahr:         { name: 'アール',             country: 'ドイツ',       resource: 'pinot',      x: 638, y: 84,  adjacent: ['mosel','mittelrhein'] },
  mittelrhein: { name: 'ミッテルライン',     country: 'ドイツ',       resource: 'riesling',   x: 658, y: 96,  adjacent: ['ahr','mosel','rheingau'] },
  mosel:       { name: 'モーゼル',           country: 'ドイツ',       resource: 'riesling',   x: 674, y: 110, adjacent: ['alsace','nahe','rheingau','mittelrhein'] },
  nahe:        { name: 'ナーエ',             country: 'ドイツ',       resource: 'riesling',   x: 695, y: 124, adjacent: ['mosel','rheingau','rheinhessen'] },
  rheingau:    { name: 'ラインガウ',         country: 'ドイツ',       resource: 'riesling',   x: 712, y: 138, adjacent: ['mosel','nahe','rheinhessen','mittelrhein'] },
  rheinhessen: { name: 'ラインヘッセン',     country: 'ドイツ',       resource: 'blend',      x: 728, y: 154, adjacent: ['rheingau','nahe','pfalz','wachau'] },
  pfalz:       { name: 'プファルツ',         country: 'ドイツ',       resource: 'riesling',   x: 742, y: 174, adjacent: ['rheinhessen','alsace','wurttemberg'] },
  hessische:   { name: 'ヘッシッシェ',       country: 'ドイツ',       resource: 'riesling',   x: 726, y: 138, adjacent: ['rheingau','rheinhessen'] },
  wurttemberg: { name: 'ヴュルテンベルク',   country: 'ドイツ',       resource: 'blend',      x: 762, y: 192, adjacent: ['pfalz','franken','jura'] },
  franken:     { name: 'フランケン',         country: 'ドイツ',       resource: 'riesling',   x: 800, y: 155, adjacent: ['wurttemberg','rheinhessen','saaleunstrut'] },
  saaleunstrut:{ name: 'ザーレ・ウンシュトルート', country: 'ドイツ', resource: 'riesling',   x: 800, y: 122, adjacent: ['franken','sachsen'] },
  sachsen:     { name: 'ザクセン',           country: 'ドイツ',       resource: 'riesling',   x: 840, y: 112, adjacent: ['saaleunstrut','bohemia'] },

  // ===== オーストリア (7) =====
  wachau:      { name: 'ワッハウ',           country: 'オーストリア', resource: 'riesling',   x: 790, y: 168, adjacent: ['rheinhessen','kamptal','bolzano','tokaj','bohemia'] },
  kamptal:     { name: 'カンプタール',       country: 'オーストリア', resource: 'riesling',   x: 812, y: 180, adjacent: ['wachau','kremstal','burgenland'] },
  kremstal:    { name: 'クレムスタール',     country: 'オーストリア', resource: 'riesling',   x: 825, y: 170, adjacent: ['wachau','kamptal','wagram'] },
  wagram:      { name: 'ヴァッハウ・ヴァグラム', country: 'オーストリア', resource: 'blend',  x: 838, y: 182, adjacent: ['kremstal','kamptal','wien'] },
  wien:        { name: 'ウィーン',           country: 'オーストリア', resource: 'riesling',   x: 850, y: 194, adjacent: ['wagram','burgenland','tokaj'] },
  burgenland:  { name: 'ブルゲンランド',     country: 'オーストリア', resource: 'blend',      x: 860, y: 212, adjacent: ['wien','tokaj','steiermark','villany'] },
  steiermark:  { name: 'シュタイヤーマルク', country: 'オーストリア', resource: 'riesling',   x: 820, y: 218, adjacent: ['wachau','burgenland','friuli'] },

  // ===== スイス (5) =====
  vaud:        { name: 'ヴォー',             country: 'スイス',       resource: 'chardonnay', x: 616, y: 254, adjacent: ['jura','geneva','valais'] },
  geneva:      { name: 'ジュネーヴ',         country: 'スイス',       resource: 'chardonnay', x: 600, y: 266, adjacent: ['vaud','burgundy'] },
  valais:      { name: 'ヴァレー',           country: 'スイス',       resource: 'riesling',   x: 634, y: 276, adjacent: ['vaud','savoie','ticino'] },
  ticino:      { name: 'ティチーノ',         country: 'スイス',       resource: 'blend',      x: 644, y: 298, adjacent: ['valais','piedmont','lombardy'] },
  graubunden:  { name: 'グラウビュンデン',   country: 'スイス',       resource: 'riesling',   x: 670, y: 258, adjacent: ['valais','bolzano','savoie'] },

  // ===== イタリア (22) =====
  piedmont:    { name: 'ピエモンテ',         country: 'イタリア',     resource: 'blend',      x: 624, y: 282, adjacent: ['burgundy','bolzano','tuscany','savoie','ticino','lombardy','liguria'] },
  lombardy:    { name: 'ロンバルディア',     country: 'イタリア',     resource: 'blend',      x: 648, y: 302, adjacent: ['piedmont','ticino','veneto','trentino'] },
  liguria:     { name: 'リグーリア',         country: 'イタリア',     resource: 'riesling',   x: 620, y: 318, adjacent: ['piedmont','tuscany','provence'] },
  bolzano:     { name: 'ボルツァーノ',       country: 'イタリア',     resource: 'chardonnay', x: 718, y: 244, adjacent: ['wachau','piedmont','tuscany','graubunden','trentino'] },
  trentino:    { name: 'トレンティーノ',     country: 'イタリア',     resource: 'chardonnay', x: 730, y: 268, adjacent: ['bolzano','veneto','lombardy'] },
  veneto:      { name: 'ヴェネト',           country: 'イタリア',     resource: 'blend',      x: 754, y: 288, adjacent: ['bolzano','trentino','friuli','emilia','tuscany'] },
  friuli:      { name: 'フリウリ',           country: 'イタリア',     resource: 'blend',      x: 790, y: 300, adjacent: ['veneto','steiermark','slovenia_goriska'] },
  emilia:      { name: 'エミリア・ロマーニャ', country: 'イタリア',   resource: 'blend',      x: 672, y: 348, adjacent: ['tuscany','veneto','lombardy','marche','liguria'] },
  tuscany:     { name: 'トスカーナ',         country: 'イタリア',     resource: 'blend',      x: 684, y: 382, adjacent: ['rhone','piedmont','bolzano','sicily','umbria','lazio','liguria','emilia','sardinia','corsica'] },
  umbria:      { name: 'ウンブリア',         country: 'イタリア',     resource: 'blend',      x: 696, y: 410, adjacent: ['tuscany','lazio','marche','abruzzo'] },
  lazio:       { name: 'ラツィオ',           country: 'イタリア',     resource: 'blend',      x: 694, y: 438, adjacent: ['tuscany','umbria','campania','abruzzo'] },
  marche:      { name: 'マルケ',             country: 'イタリア',     resource: 'blend',      x: 722, y: 408, adjacent: ['umbria','abruzzo','emilia','veneto'] },
  abruzzo:     { name: 'アブルッツォ',       country: 'イタリア',     resource: 'blend',      x: 726, y: 436, adjacent: ['marche','lazio','campania','puglia'] },
  campania:    { name: 'カンパニア',         country: 'イタリア',     resource: 'blend',      x: 730, y: 462, adjacent: ['lazio','abruzzo','sicily','puglia','basilicata'] },
  puglia:      { name: 'プーリア',           country: 'イタリア',     resource: 'blend',      x: 758, y: 472, adjacent: ['abruzzo','campania','basilicata'] },
  basilicata:  { name: 'バジリカータ',       country: 'イタリア',     resource: 'blend',      x: 750, y: 494, adjacent: ['campania','puglia','calabria'] },
  calabria:    { name: 'カラブリア',         country: 'イタリア',     resource: 'blend',      x: 726, y: 522, adjacent: ['basilicata','sicily'] },
  sicily:      { name: 'シチリア',           country: 'イタリア',     resource: 'blend',      x: 680, y: 490, adjacent: ['tuscany','campania','calabria','santorini','sardinia'] },
  sardinia:    { name: 'サルデーニャ',       country: 'イタリア',     resource: 'blend',      x: 614, y: 486, adjacent: ['tuscany','provence','sicily','corsica'] },
  chianti:     { name: 'キャンティ',         country: 'イタリア',     resource: 'blend',      x: 698, y: 392, adjacent: ['tuscany','umbria'] },
  soave:       { name: 'ソアーヴェ',         country: 'イタリア',     resource: 'chardonnay', x: 740, y: 302, adjacent: ['veneto','trentino'] },
  amarone:     { name: 'アマローネ',         country: 'イタリア',     resource: 'blend',      x: 754, y: 310, adjacent: ['veneto','soave'] },

  // ===== スペイン (20) =====
  rioja:       { name: 'リオハ',             country: 'スペイン',     resource: 'blend',      x: 392, y: 334, adjacent: ['bordeaux','vinhoverdo','ribera','priorat','navarra','roussillon','madiran'] },
  ribera:      { name: 'リベラ・デル・ドゥエロ', country: 'スペイン', resource: 'cabernet',   x: 392, y: 412, adjacent: ['rioja','douro','jerez','priorat','rueda','toro'] },
  priorat:     { name: 'プリオラート',       country: 'スペイン',     resource: 'blend',      x: 494, y: 396, adjacent: ['rioja','ribera','rhone','roussillon','penedes','montsant'] },
  riasbaixas:  { name: 'リアス・バイシャス',  country: 'スペイン',    resource: 'riesling',   x: 252, y: 308, adjacent: ['vinhoverdo','bierzo'] },
  navarra:     { name: 'ナバーラ',           country: 'スペイン',     resource: 'blend',      x: 428, y: 346, adjacent: ['rioja','aragon','penedes'] },
  aragon:      { name: 'アラゴン',           country: 'スペイン',     resource: 'blend',      x: 446, y: 376, adjacent: ['navarra','priorat','rioja'] },
  penedes:     { name: 'ペネデス',           country: 'スペイン',     resource: 'chardonnay', x: 478, y: 412, adjacent: ['priorat','navarra','montsant'] },
  montsant:    { name: 'モンサン',           country: 'スペイン',     resource: 'blend',      x: 478, y: 430, adjacent: ['priorat','penedes','roussillon'] },
  rueda:       { name: 'ルエダ',             country: 'スペイン',     resource: 'riesling',   x: 376, y: 432, adjacent: ['ribera','rioja','bierzo','toro'] },
  bierzo:      { name: 'ビエルソ',           country: 'スペイン',     resource: 'blend',      x: 320, y: 378, adjacent: ['ribera','rueda','vinhoverdo','riasbaixas'] },
  toro:        { name: 'トロ',               country: 'スペイン',     resource: 'blend',      x: 356, y: 450, adjacent: ['rueda','ribera','douro'] },
  ribeiro:     { name: 'リベイロ',           country: 'スペイン',     resource: 'riesling',   x: 262, y: 334, adjacent: ['riasbaixas','vinhoverdo','bierzo'] },
  lamancha:    { name: 'ラ・マンチャ',       country: 'スペイン',     resource: 'blend',      x: 394, y: 474, adjacent: ['ribera','rueda','toro','jumilla','valdepenas'] },
  jumilla:     { name: 'フミーリャ',         country: 'スペイン',     resource: 'blend',      x: 452, y: 484, adjacent: ['lamancha','priorat','aragon','alicante'] },
  valdepenas:  { name: 'バルデペーニャス',   country: 'スペイン',     resource: 'blend',      x: 392, y: 496, adjacent: ['lamancha','jerez'] },
  alicante:    { name: 'アリカンテ',         country: 'スペイン',     resource: 'blend',      x: 472, y: 502, adjacent: ['jumilla','lamancha'] },
  somontano:   { name: 'ソモンタノ',         country: 'スペイン',     resource: 'blend',      x: 444, y: 356, adjacent: ['navarra','aragon'] },
  jerez:       { name: 'ヘレス',             country: 'スペイン',     resource: 'blend',      x: 310, y: 500, adjacent: ['douro','ribera','swartland','lamancha','valdepenas'] },
  malaga:      { name: 'マラガ',             country: 'スペイン',     resource: 'blend',      x: 346, y: 522, adjacent: ['jerez','valdepenas'] },
  cigales:     { name: 'シガレス',           country: 'スペイン',     resource: 'blend',      x: 376, y: 398, adjacent: ['ribera','rueda','toro'] },

  // ===== ポルトガル (9) =====
  vinhoverdo:  { name: 'ヴィーニョ・ヴェルデ', country: 'ポルトガル', resource: 'riesling',   x: 255, y: 305, adjacent: ['douro','rioja','riasbaixas','ribeiro'] },
  douro:       { name: 'ドウロ',             country: 'ポルトガル',   resource: 'blend',      x: 255, y: 395, adjacent: ['vinhoverdo','ribera','jerez','napa','toro','dao'] },
  dao:         { name: 'ダオン',             country: 'ポルトガル',   resource: 'blend',      x: 276, y: 420, adjacent: ['douro','bairrada','tejo'] },
  bairrada:    { name: 'バイラーダ',         country: 'ポルトガル',   resource: 'blend',      x: 258, y: 440, adjacent: ['dao','tejo'] },
  tejo:        { name: 'テージョ',           country: 'ポルトガル',   resource: 'blend',      x: 270, y: 462, adjacent: ['dao','bairrada','setubal','alentejo'] },
  setubal:     { name: 'セトゥバル',         country: 'ポルトガル',   resource: 'blend',      x: 256, y: 490, adjacent: ['tejo','alentejo'] },
  alentejo:    { name: 'アレンテージョ',     country: 'ポルトガル',   resource: 'blend',      x: 268, y: 518, adjacent: ['setubal','jerez','douro','tejo'] },
  algarve:     { name: 'アルガルヴェ',       country: 'ポルトガル',   resource: 'blend',      x: 266, y: 542, adjacent: ['alentejo','jerez'] },
  madeira:     { name: 'マデイラ',           country: 'ポルトガル',   resource: 'blend',      x: 220, y: 508, adjacent: ['douro','alentejo'] },

  // ===== ギリシャ・バルカン (10) =====
  naoussa:     { name: 'ナウサ',             country: 'ギリシャ',     resource: 'blend',      x: 848, y: 384, adjacent: ['santorini','nemea','bekaa'] },
  nemea:       { name: 'ネメア',             country: 'ギリシャ',     resource: 'cabernet',   x: 846, y: 412, adjacent: ['naoussa','santorini','patras'] },
  santorini:   { name: 'サントリーニ',       country: 'ギリシャ',     resource: 'chardonnay', x: 832, y: 442, adjacent: ['sicily','tokaj','bekaa','naoussa','nemea','crete'] },
  patras:      { name: 'パトラス',           country: 'ギリシャ',     resource: 'blend',      x: 830, y: 432, adjacent: ['nemea','crete'] },
  crete:       { name: 'クレタ',             country: 'ギリシャ',     resource: 'blend',      x: 838, y: 470, adjacent: ['santorini','patras'] },
  mantinia:    { name: 'マンティニア',       country: 'ギリシャ',     resource: 'riesling',   x: 848, y: 452, adjacent: ['naoussa','nemea'] },
  attica:      { name: 'アッティカ',         country: 'ギリシャ',     resource: 'riesling',   x: 860, y: 432, adjacent: ['naoussa','santorini'] },
  makedonia:   { name: 'マケドニア',         country: 'ギリシャ',     resource: 'blend',      x: 840, y: 364, adjacent: ['naoussa','bulgaria_plovdiv'] },
  thracegreece:{ name: 'トラキア(GR)',       country: 'ギリシャ',     resource: 'blend',      x: 872, y: 368, adjacent: ['makedonia','naoussa','turkey_thrace'] },
  cephalonia:  { name: 'ケファロニア',       country: 'ギリシャ',     resource: 'blend',      x: 812, y: 448, adjacent: ['patras','crete'] },

  // ===== 東欧 (14) =====
  tokaj:       { name: 'トカイ',             country: 'ハンガリー',   resource: 'riesling',   x: 880, y: 208, adjacent: ['wachau','santorini','wien','burgenland','eger','cotnari'] },
  eger:        { name: 'エゲル',             country: 'ハンガリー',   resource: 'blend',      x: 868, y: 222, adjacent: ['tokaj','villany','burgenland'] },
  villany:     { name: 'ヴィッラーニ',       country: 'ハンガリー',   resource: 'cabernet',   x: 848, y: 238, adjacent: ['eger','burgenland','tokaj'] },
  szekszard:   { name: 'セクシャード',       country: 'ハンガリー',   resource: 'blend',      x: 838, y: 230, adjacent: ['villany','wien','burgenland'] },
  bohemia:     { name: 'ボヘミア',           country: 'チェコ',       resource: 'riesling',   x: 782, y: 148, adjacent: ['sachsen','moravia','wachau'] },
  moravia:     { name: 'モラヴィア',         country: 'チェコ',       resource: 'riesling',   x: 808, y: 168, adjacent: ['bohemia','wachau','burgenland'] },
  slovakia_tokaj:{ name: 'スロヴァキア・トカイ', country: 'スロヴァキア', resource: 'riesling', x: 870, y: 196, adjacent: ['tokaj','burgenland'] },
  slovenia_goriska:{ name: 'ゴリシュカ・ブルダ', country: 'スロヴェニア', resource: 'blend', x: 796, y: 306, adjacent: ['friuli','vipava','croatia_istria'] },
  vipava:      { name: 'ヴィパヴァ',         country: 'スロヴェニア', resource: 'blend',      x: 798, y: 322, adjacent: ['slovenia_goriska','friuli','croatia_istria'] },
  croatia_istria:{ name: 'イストリア',       country: 'クロアチア',   resource: 'blend',      x: 798, y: 340, adjacent: ['slovenia_goriska','vipava','croatia_dalmatia'] },
  croatia_dalmatia:{ name: 'ダルマチア',     country: 'クロアチア',   resource: 'blend',      x: 798, y: 370, adjacent: ['croatia_istria','bosnia'] },
  croatia_slavonia:{ name: 'スラヴォニア',   country: 'クロアチア',   resource: 'riesling',   x: 820, y: 346, adjacent: ['croatia_istria','tokaj'] },
  bosnia:      { name: 'ボスニア',           country: 'ボスニア',     resource: 'blend',      x: 812, y: 388, adjacent: ['croatia_dalmatia','naoussa'] },
  bulgaria_plovdiv:{ name: 'トラキア渓谷',  country: 'ブルガリア',   resource: 'blend',      x: 886, y: 354, adjacent: ['makedonia','tokaj','romania_dealu'] },
  melnik:      { name: 'メルニク',           country: 'ブルガリア',   resource: 'blend',      x: 870, y: 380, adjacent: ['naoussa','bulgaria_plovdiv','santorini'] },
  romania_dealu:{ name: 'デアル・マーレ',    country: 'ルーマニア',   resource: 'blend',      x: 904, y: 238, adjacent: ['tokaj','cotnari','murfatlar'] },
  cotnari:     { name: 'コトナリ',           country: 'ルーマニア',   resource: 'riesling',   x: 940, y: 212, adjacent: ['romania_dealu','tokaj'] },
  murfatlar:   { name: 'ムルファトラル',     country: 'ルーマニア',   resource: 'blend',      x: 934, y: 258, adjacent: ['romania_dealu','bulgaria_plovdiv'] },

  // ===== コーカサス・モルドバ (5) =====
  georgia_kakheti:{ name: 'カヘティ',        country: 'ジョージア',   resource: 'blend',      x: 1058, y: 340, adjacent: ['bekaa','georgia_kartli','armenia_ararat'] },
  georgia_kartli:{ name: 'カルトリ',         country: 'ジョージア',   resource: 'blend',      x: 1042, y: 328, adjacent: ['georgia_kakheti','bekaa'] },
  georgia_imereti:{ name: 'イメレティ',      country: 'ジョージア',   resource: 'blend',      x: 1030, y: 338, adjacent: ['georgia_kartli','bekaa'] },
  armenia_ararat:{ name: 'アラガツォトン',   country: 'アルメニア',   resource: 'blend',      x: 1058, y: 368, adjacent: ['georgia_kakheti','bekaa','turkey_cappadocia'] },
  moldova_codru:{ name: 'コドル',            country: 'モルドバ',     resource: 'blend',      x: 930, y: 228, adjacent: ['cotnari','romania_dealu'] },

  // ===== 中東・東地中海 (8) =====
  bekaa:       { name: 'ベカー高原',         country: 'レバノン',     resource: 'blend',      x: 972, y: 408, adjacent: ['santorini','ningxia','georgia_kakheti','israel_golan','turkey_cappadocia','naoussa'] },
  israel_golan:{ name: 'ゴラン高原',         country: 'イスラエル',   resource: 'blend',      x: 970, y: 436, adjacent: ['bekaa','israel_galilee'] },
  israel_galilee:{ name: 'ガリラヤ',         country: 'イスラエル',   resource: 'blend',      x: 972, y: 452, adjacent: ['israel_golan','bekaa'] },
  turkey_thrace:{ name: 'トラキア(TR)',       country: 'トルコ',       resource: 'blend',      x: 888, y: 370, adjacent: ['thracegreece','turkey_cappadocia'] },
  turkey_cappadocia:{ name: 'カッパドキア',  country: 'トルコ',       resource: 'blend',      x: 960, y: 378, adjacent: ['turkey_thrace','bekaa','armenia_ararat'] },
  turkey_aegean:{ name: 'エーゲ海(TR)',      country: 'トルコ',       resource: 'blend',      x: 888, y: 400, adjacent: ['turkey_thrace','santorini'] },
  cyprus_comm: { name: 'コマンダリア',       country: 'キプロス',     resource: 'blend',      x: 938, y: 456, adjacent: ['bekaa','santorini'] },
  ukraine_crimea:{ name: 'クリミア',         country: 'ウクライナ',   resource: 'blend',      x: 950, y: 282, adjacent: ['cotnari','moldova_codru'] },

  // ===== 北アフリカ (5) =====
  morocco_meknes:{ name: 'メクネス',         country: 'モロッコ',     resource: 'blend',      x: 356, y: 544, adjacent: ['jerez','morocco_casa'] },
  morocco_casa:{ name: 'カサブランカ(MA)',   country: 'モロッコ',     resource: 'blend',      x: 322, y: 550, adjacent: ['morocco_meknes','jerez'] },
  tunisia:     { name: 'チュニジア',         country: 'チュニジア',   resource: 'blend',      x: 620, y: 540, adjacent: ['sardinia','sicily'] },
  algeria:     { name: 'アルジェリア',       country: 'アルジェリア', resource: 'blend',      x: 512, y: 546, adjacent: ['morocco_meknes','languedoc'] },
  egypt:       { name: 'エジプト',           country: 'エジプト',     resource: 'blend',      x: 910, y: 522, adjacent: ['bekaa','israel_galilee'] },

  // ===== アフリカ (9) =====
  swartland:   { name: 'スワートランド',     country: '南アフリカ',   resource: 'blend',      x: 710, y: 692, adjacent: ['jerez','stellenbosch','capetown'] },
  stellenbosch:{ name: 'ステレンボッシュ',   country: '南アフリカ',   resource: 'blend',      x: 796, y: 742, adjacent: ['swartland','capetown','paarl'] },
  capetown:    { name: 'ケープタウン',       country: '南アフリカ',   resource: 'blend',      x: 710, y: 802, adjacent: ['swartland','stellenbosch','tuscany','margaret','mendoza'] },
  paarl:       { name: 'パール',             country: '南アフリカ',   resource: 'blend',      x: 740, y: 760, adjacent: ['stellenbosch','swartland','franschhoek'] },
  franschhoek: { name: 'フランシュフック',   country: '南アフリカ',   resource: 'chardonnay', x: 762, y: 770, adjacent: ['paarl','stellenbosch','elgin'] },
  elgin:       { name: 'エルジン',           country: '南アフリカ',   resource: 'chardonnay', x: 762, y: 796, adjacent: ['franschhoek','walkerbay'] },
  walkerbay:   { name: 'ウォーカーベイ',     country: '南アフリカ',   resource: 'pinot',      x: 782, y: 822, adjacent: ['elgin','stellenbosch'] },
  ethiopia:    { name: 'エチオピア',         country: 'エチオピア',   resource: 'blend',      x: 1008, y: 622, adjacent: ['egypt'] },
  kenya_naivasha:{ name: 'ナイバシャ',       country: 'ケニア',       resource: 'blend',      x: 1010, y: 668, adjacent: ['ethiopia'] },

  // ===== 北米・西海岸 (17) =====
  okanagan:    { name: 'オカナガン',         country: 'カナダ',       resource: 'pinot',      x: 64,  y: 234, adjacent: ['willamette','columbia'] },
  niagara:     { name: 'ナイアガラ',         country: 'カナダ',       resource: 'chardonnay', x: 148, y: 272, adjacent: ['fingerlakes','longisland'] },
  novascotia:  { name: 'ノバスコシア',       country: 'カナダ',       resource: 'riesling',   x: 178, y: 258, adjacent: ['niagara'] },
  willamette:  { name: 'ウィラメット',       country: 'アメリカ',     resource: 'pinot',      x: 52,  y: 296, adjacent: ['okanagan','columbia','sonoma'] },
  columbia:    { name: 'コロンビア・バレー', country: 'アメリカ',     resource: 'blend',      x: 88,  y: 278, adjacent: ['okanagan','willamette','wallawalla'] },
  wallawalla:  { name: 'ワラワラ',           country: 'アメリカ',     resource: 'blend',      x: 106, y: 296, adjacent: ['columbia','sonoma'] },
  mendocino:   { name: 'メンドシーノ',       country: 'アメリカ',     resource: 'pinot',      x: 46,  y: 326, adjacent: ['willamette','sonoma'] },
  sonoma:      { name: 'ソノマ',             country: 'アメリカ',     resource: 'pinot',      x: 60,  y: 348, adjacent: ['willamette','napa','mendocino','russianriver'] },
  russianriver:{ name: 'ロシアン・リバー',   country: 'アメリカ',     resource: 'pinot',      x: 52,  y: 364, adjacent: ['sonoma','andersonvalley'] },
  andersonvalley:{ name: 'アンダーソン',     country: 'アメリカ',     resource: 'pinot',      x: 46,  y: 348, adjacent: ['mendocino','russianriver'] },
  napa:        { name: 'ナパバレー',         country: 'アメリカ',     resource: 'cabernet',   x: 72,  y: 368, adjacent: ['sonoma','pasorobles','lodi','carneros'] },
  carneros:    { name: 'カーネロス',         country: 'アメリカ',     resource: 'chardonnay', x: 60,  y: 380, adjacent: ['sonoma','napa'] },
  lodi:        { name: 'ローダイ',           country: 'アメリカ',     resource: 'blend',      x: 82,  y: 352, adjacent: ['napa','sierrafoothills'] },
  sierrafoothills:{ name: 'シエラ',          country: 'アメリカ',     resource: 'blend',      x: 96,  y: 358, adjacent: ['lodi','napa'] },
  pasorobles:  { name: 'パソ・ロブレス',     country: 'アメリカ',     resource: 'blend',      x: 64,  y: 394, adjacent: ['napa','santabarbara'] },
  santabarbara:{ name: 'サンタ・バーバラ',   country: 'アメリカ',     resource: 'chardonnay', x: 62,  y: 418, adjacent: ['pasorobles','guadalupe'] },
  guadalupe:   { name: 'グアダルーペ',       country: 'メキシコ',     resource: 'blend',      x: 74,  y: 455, adjacent: ['santabarbara'] },

  // ===== 北米・東海岸 (4) =====
  fingerlakes: { name: 'フィンガー・レイクス', country: 'アメリカ',   resource: 'riesling',   x: 158, y: 292, adjacent: ['niagara','longisland','virginia'] },
  longisland:  { name: 'ロング・アイランド', country: 'アメリカ',     resource: 'chardonnay', x: 174, y: 308, adjacent: ['fingerlakes','virginia'] },
  virginia:    { name: 'バージニア',         country: 'アメリカ',     resource: 'blend',      x: 168, y: 332, adjacent: ['fingerlakes','longisland','texashills'] },
  texashills:  { name: 'テキサス',           country: 'アメリカ',     resource: 'blend',      x: 122, y: 446, adjacent: ['virginia','guadalupe'] },

  // ===== 南アメリカ (22) =====
  ica_peru:    { name: 'イカ',               country: 'ペルー',       resource: 'blend',      x: 148, y: 568, adjacent: ['tarija','elqui'] },
  tarija:      { name: 'タリハ',             country: 'ボリビア',     resource: 'blend',      x: 202, y: 608, adjacent: ['ica_peru','salta'] },
  elqui:       { name: 'エルキ',             country: 'チリ',         resource: 'chardonnay', x: 144, y: 602, adjacent: ['ica_peru','limari'] },
  limari:      { name: 'リマリ',             country: 'チリ',         resource: 'chardonnay', x: 144, y: 636, adjacent: ['elqui','aconcagua'] },
  aconcagua:   { name: 'アコンカグア',       country: 'チリ',         resource: 'cabernet',   x: 142, y: 666, adjacent: ['limari','casablanca_cl','salta'] },
  casablanca_cl:{ name: 'カサブランカ(CL)',  country: 'チリ',         resource: 'chardonnay', x: 138, y: 690, adjacent: ['aconcagua','leyda','maipo'] },
  leyda:       { name: 'レイダ',             country: 'チリ',         resource: 'pinot',      x: 132, y: 716, adjacent: ['casablanca_cl','maipo'] },
  maipo:       { name: 'マイポ',             country: 'チリ',         resource: 'cabernet',   x: 148, y: 726, adjacent: ['casablanca_cl','leyda','cachapoal','mendoza'] },
  cachapoal:   { name: 'カチャポアル',       country: 'チリ',         resource: 'cabernet',   x: 148, y: 758, adjacent: ['maipo','colchagua'] },
  colchagua:   { name: 'コルチャグア',       country: 'チリ',         resource: 'cabernet',   x: 146, y: 790, adjacent: ['cachapoal','maule'] },
  maule:       { name: 'マウレ',             country: 'チリ',         resource: 'blend',      x: 146, y: 822, adjacent: ['colchagua','biobio'] },
  biobio:      { name: 'ビオビオ',           country: 'チリ',         resource: 'pinot',      x: 144, y: 856, adjacent: ['maule','patagonia'] },
  salta:       { name: 'サルタ',             country: 'アルゼンチン', resource: 'blend',      x: 196, y: 624, adjacent: ['tarija','aconcagua','sanjuan'] },
  larioja_ar:  { name: 'ラ・リオハ(AR)',     country: 'アルゼンチン', resource: 'blend',      x: 198, y: 660, adjacent: ['salta','sanjuan','mendoza'] },
  sanjuan:     { name: 'サン・ファン',       country: 'アルゼンチン', resource: 'blend',      x: 190, y: 692, adjacent: ['salta','larioja_ar','mendoza'] },
  mendoza:     { name: 'メンドーサ',         country: 'アルゼンチン', resource: 'blend',      x: 190, y: 726, adjacent: ['napa','maipo','capetown','sanjuan','larioja_ar','neuquen'] },
  neuquen:     { name: 'ネウケン',           country: 'アルゼンチン', resource: 'pinot',      x: 188, y: 764, adjacent: ['mendoza','patagonia'] },
  patagonia:   { name: 'パタゴニア',         country: 'アルゼンチン', resource: 'pinot',      x: 182, y: 806, adjacent: ['neuquen','biobio'] },
  serragaucha: { name: 'セラ・ガウシャ',     country: 'ブラジル',     resource: 'blend',      x: 246, y: 756, adjacent: ['canelones','valedos'] },
  valedos:     { name: 'ヴァーレ・ドス・ヴィニェードス', country: 'ブラジル', resource: 'pinot', x: 258, y: 774, adjacent: ['serragaucha','canelones'] },
  canelones:   { name: 'カネローネス',       country: 'ウルグアイ',   resource: 'blend',      x: 244, y: 812, adjacent: ['serragaucha','valedos'] },
  colombia_wine:{ name: 'コロンビア',        country: 'コロンビア',   resource: 'blend',      x: 168, y: 530, adjacent: ['ica_peru','guadalupe'] },

  // ===== オーストラリア (17) =====
  margaret:    { name: 'マーガレット・リバー', country: 'オーストラリア', resource: 'cabernet', x: 1332, y: 652, adjacent: ['maipo','barossa','capetown'] },
  swanhills:   { name: 'スワン・ヒルズ',     country: 'オーストラリア', resource: 'blend',    x: 1296, y: 616, adjacent: ['margaret','mclaren'] },
  hunter:      { name: 'ハンター・バレー',   country: 'オーストラリア', resource: 'chardonnay',x: 1630, y: 624, adjacent: ['yarra','mudgee'] },
  mudgee:      { name: 'マジー',             country: 'オーストラリア', resource: 'blend',    x: 1614, y: 644, adjacent: ['hunter','canberra_dist'] },
  canberra_dist:{ name: 'キャンベラ',        country: 'オーストラリア', resource: 'riesling', x: 1636, y: 668, adjacent: ['mudgee','yarra'] },
  mclaren:     { name: 'マクラーレン・ベイル', country: 'オーストラリア', resource: 'blend',  x: 1524, y: 668, adjacent: ['barossa','swanhills','coonawarra'] },
  barossa:     { name: 'バロッサ',           country: 'オーストラリア', resource: 'blend',    x: 1510, y: 608, adjacent: ['yamanashi','margaret','coonawarra','mclaren','clare','adelaidehills'] },
  clare:       { name: 'クレア・バレー',     country: 'オーストラリア', resource: 'riesling', x: 1494, y: 588, adjacent: ['barossa','adelaidehills'] },
  adelaidehills:{ name: 'アデレード・ヒルズ', country: 'オーストラリア', resource: 'chardonnay',x: 1512, y: 630, adjacent: ['barossa','clare','mclaren'] },
  edenvalley:  { name: 'エデン・バレー',     country: 'オーストラリア', resource: 'riesling', x: 1508, y: 647, adjacent: ['barossa','mclaren'] },
  coonawarra:  { name: 'クナワラ',           country: 'オーストラリア', resource: 'cabernet', x: 1566, y: 702, adjacent: ['barossa','yarra','mclaren'] },
  heathcote:   { name: 'ヒースコート',       country: 'オーストラリア', resource: 'blend',    x: 1618, y: 710, adjacent: ['yarra','coonawarra'] },
  yarra:       { name: 'ヤラ・バレー',       country: 'オーストラリア', resource: 'pinot',    x: 1658, y: 742, adjacent: ['coonawarra','marlborough','heathcote','hunter'] },
  mornington:  { name: 'モーニントン',       country: 'オーストラリア', resource: 'pinot',    x: 1660, y: 760, adjacent: ['yarra','coonawarra'] },
  rutherglen:  { name: 'ラザーグレン',       country: 'オーストラリア', resource: 'blend',    x: 1636, y: 726, adjacent: ['yarra','heathcote'] },
  grampians:   { name: 'グランピアンズ',     country: 'オーストラリア', resource: 'blend',    x: 1576, y: 726, adjacent: ['mclaren','heathcote','coonawarra'] },
  greatSouthern:{ name: 'グレート・サザン',  country: 'オーストラリア', resource: 'riesling', x: 1386, y: 690, adjacent: ['margaret','mclaren'] },

  // ===== ニュージーランド (8) =====
  marlborough: { name: 'マールボロ',         country: 'ニュージーランド', resource: 'chardonnay', x: 1746, y: 832, adjacent: ['yarra','yamanashi'] },
  nelson:      { name: 'ネルソン',           country: 'ニュージーランド', resource: 'chardonnay', x: 1730, y: 818, adjacent: ['marlborough','hawkesbay'] },
  hawkesbay:   { name: 'ホークス・ベイ',     country: 'ニュージーランド', resource: 'blend',      x: 1762, y: 810, adjacent: ['nelson','gisborne','martinborough'] },
  gisborne:    { name: 'ギズボーン',         country: 'ニュージーランド', resource: 'chardonnay', x: 1778, y: 798, adjacent: ['hawkesbay'] },
  martinborough:{ name: 'マーティンボロ',    country: 'ニュージーランド', resource: 'pinot',      x: 1762, y: 826, adjacent: ['hawkesbay','marlborough'] },
  centralotago:{ name: 'セントラル・オタゴ', country: 'ニュージーランド', resource: 'pinot',      x: 1758, y: 866, adjacent: ['marlborough','canterbury'] },
  canterbury:  { name: 'カンタベリー',       country: 'ニュージーランド', resource: 'chardonnay', x: 1762, y: 848, adjacent: ['marlborough','centralotago'] },
  auckland:    { name: 'オークランド',       country: 'ニュージーランド', resource: 'blend',      x: 1764, y: 786, adjacent: ['gisborne','hawkesbay'] },

  // ===== 日本 (7) =====
  yamanashi:   { name: '山梨',               country: '日本',         resource: 'chardonnay', x: 1502, y: 218, adjacent: ['ningxia','barossa','marlborough','nagano'] },
  nagano:      { name: '長野',               country: '日本',         resource: 'chardonnay', x: 1518, y: 234, adjacent: ['yamanashi','yamagata'] },
  yamagata:    { name: '山形',               country: '日本',         resource: 'blend',      x: 1530, y: 218, adjacent: ['nagano','hokkaido'] },
  hokkaido:    { name: '北海道',             country: '日本',         resource: 'pinot',      x: 1552, y: 192, adjacent: ['yamagata'] },
  osaka:       { name: '大阪',               country: '日本',         resource: 'blend',      x: 1512, y: 248, adjacent: ['yamanashi','nagano'] },
  kumamoto:    { name: '熊本',               country: '日本',         resource: 'blend',      x: 1518, y: 264, adjacent: ['osaka'] },
  miyazaki:    { name: '宮崎',               country: '日本',         resource: 'blend',      x: 1534, y: 260, adjacent: ['osaka','kumamoto'] },

  // ===== 中国・アジア (10) =====
  ningxia:     { name: '寧夏',               country: '中国',         resource: 'cabernet',   x: 1282, y: 252, adjacent: ['bekaa','yamanashi','changli','xinjiang'] },
  changli:     { name: '昌黎(河北)',         country: '中国',         resource: 'cabernet',   x: 1358, y: 238, adjacent: ['ningxia','shandong'] },
  shandong:    { name: '山東',               country: '中国',         resource: 'blend',      x: 1388, y: 260, adjacent: ['changli','yunnan_cn'] },
  xinjiang:    { name: '新疆',               country: '中国',         resource: 'blend',      x: 1180, y: 268, adjacent: ['ningxia','bekaa'] },
  yunnan_cn:   { name: '雲南',               country: '中国',         resource: 'blend',      x: 1348, y: 358, adjacent: ['shandong','ningxia'] },
  korea:       { name: '韓国',               country: '韓国',         resource: 'blend',      x: 1476, y: 248, adjacent: ['yamanashi','changli'] },
  india_nashik:{ name: 'ナーシク',           country: 'インド',       resource: 'blend',      x: 1112, y: 478, adjacent: ['bekaa','india_pune'] },
  india_pune:  { name: 'プネー',             country: 'インド',       resource: 'blend',      x: 1128, y: 498, adjacent: ['india_nashik'] },
  thailand:    { name: 'タイ',               country: 'タイ',         resource: 'blend',      x: 1326, y: 468, adjacent: ['yunnan_cn'] },
  vietnam:     { name: 'ベトナム',           country: 'ベトナム',     resource: 'blend',      x: 1348, y: 492, adjacent: ['thailand'] },

  // ===== 追加産地 (+58) =====

  // イングランド・ルクセンブルク
  english_wine:{ name: 'イングランド',       country: 'イギリス',     resource: 'chardonnay', x: 436, y:  82, adjacent: ['champagne','loire'] },
  luxembourg:  { name: 'ルクセンブルク',     country: 'ルクセンブルク', resource: 'riesling', x: 608, y: 104, adjacent: ['mosel','alsace'] },

  // フランス追加
  pomerol:     { name: 'ポムロル',           country: 'フランス',     resource: 'pinot',      x: 380, y: 284, adjacent: ['bordeaux','saintemilion'] },
  saintemilion:{ name: 'サン・テミリオン',   country: 'フランス',     resource: 'blend',      x: 394, y: 288, adjacent: ['pomerol','bordeaux'] },
  saumur:      { name: 'ソーミュール',        country: 'フランス',     resource: 'blend',      x: 338, y: 166, adjacent: ['touraine','anjou','loire'] },
  chateauneuf: { name: 'シャトーヌフ',       country: 'フランス',     resource: 'blend',      x: 566, y: 398, adjacent: ['rhone','gigondas'] },
  gigondas:    { name: 'ジゴンダス',         country: 'フランス',     resource: 'blend',      x: 580, y: 410, adjacent: ['chateauneuf','rhone','provence'] },
  bandol:      { name: 'バンドール',          country: 'フランス',     resource: 'blend',      x: 590, y: 434, adjacent: ['provence'] },
  banyuls:     { name: 'バニュルス',          country: 'フランス',     resource: 'blend',      x: 446, y: 490, adjacent: ['roussillon'] },

  // イタリア追加
  barolo_docg: { name: 'バローロ',           country: 'イタリア',     resource: 'blend',      x: 612, y: 294, adjacent: ['piedmont'] },
  barbaresco:  { name: 'バルバレスコ',       country: 'イタリア',     resource: 'blend',      x: 624, y: 302, adjacent: ['piedmont','barolo_docg'] },
  gavi:        { name: 'ガヴィ',             country: 'イタリア',     resource: 'chardonnay', x: 626, y: 316, adjacent: ['piedmont','liguria'] },
  prosecco:    { name: 'プロセッコ',         country: 'イタリア',     resource: 'chardonnay', x: 760, y: 274, adjacent: ['veneto'] },
  valpolicella:{ name: 'ヴァルポリチェッラ', country: 'イタリア',     resource: 'blend',      x: 748, y: 296, adjacent: ['veneto','amarone'] },
  bolgheri:    { name: 'ボルゲリ',           country: 'イタリア',     resource: 'cabernet',   x: 668, y: 396, adjacent: ['tuscany'] },
  etna:        { name: 'エトナ',             country: 'イタリア',     resource: 'blend',      x: 696, y: 504, adjacent: ['sicily'] },
  primitivo:   { name: 'プリミティーヴォ',   country: 'イタリア',     resource: 'blend',      x: 768, y: 486, adjacent: ['puglia'] },
  grecodisoave:{ name: 'グレコ・ディ・トゥーフォ', country: 'イタリア', resource: 'chardonnay', x: 736, y: 468, adjacent: ['campania'] },

  // スペイン追加
  txakoli:     { name: 'チャコリ',           country: 'スペイン',     resource: 'riesling',   x: 360, y: 316, adjacent: ['rioja','riasbaixas'] },
  utielrequena:{ name: 'ウティエル・レケナ',  country: 'スペイン',     resource: 'blend',      x: 450, y: 460, adjacent: ['jumilla','lamancha'] },
  canarias:    { name: 'カナリア諸島',       country: 'スペイン',     resource: 'blend',      x: 226, y: 548, adjacent: ['morocco_meknes'] },

  // ポルトガル追加
  colares:     { name: 'コラレス',           country: 'ポルトガル',   resource: 'blend',      x: 244, y: 468, adjacent: ['tejo','setubal'] },
  obidos:      { name: 'オビドス',           country: 'ポルトガル',   resource: 'blend',      x: 248, y: 478, adjacent: ['colares','tejo'] },

  // ギリシャ追加
  limnos:      { name: 'リムノス',           country: 'ギリシャ',     resource: 'blend',      x: 872, y: 400, adjacent: ['thracegreece','attica'] },
  drama:       { name: 'ドラマ',             country: 'ギリシャ',     resource: 'blend',      x: 870, y: 354, adjacent: ['makedonia'] },

  // 東欧追加
  ukraine_zak: { name: 'ザカルパッチャ',     country: 'ウクライナ',   resource: 'blend',      x: 902, y: 222, adjacent: ['tokaj','slovakia_tokaj'] },
  north_mac:   { name: '北マケドニア',       country: '北マケドニア', resource: 'blend',      x: 848, y: 372, adjacent: ['makedonia','bulgaria_plovdiv'] },
  serbia:      { name: 'セルビア',           country: 'セルビア',     resource: 'blend',      x: 826, y: 360, adjacent: ['croatia_dalmatia','north_mac','tokaj'] },
  albania:     { name: 'アルバニア',         country: 'アルバニア',   resource: 'blend',      x: 826, y: 406, adjacent: ['naoussa','makedonia'] },
  moldova_pur: { name: 'プルカリ',           country: 'モルドバ',     resource: 'blend',      x: 946, y: 244, adjacent: ['moldova_codru','ukraine_crimea'] },

  // カナダ追加
  bc_canada:   { name: 'ブリティッシュ・コロンビア', country: 'カナダ', resource: 'pinot',    x: 56,  y: 218, adjacent: ['okanagan'] },
  pec_canada:  { name: 'プリンス・エドワード郡', country: 'カナダ',   resource: 'chardonnay', x: 162, y: 278, adjacent: ['niagara','fingerlakes'] },

  // 米国追加
  santacruz:   { name: 'サンタ・クルーズ',   country: 'アメリカ',     resource: 'pinot',      x: 62,  y: 396, adjacent: ['santabarbara','napa'] },
  texasnew:    { name: 'テキサス高原',       country: 'アメリカ',     resource: 'blend',      x: 114, y: 464, adjacent: ['texashills'] },

  // 南米追加
  uco_valley:  { name: 'ウコ・バレー',       country: 'アルゼンチン', resource: 'blend',      x: 196, y: 744, adjacent: ['mendoza'] },
  itata:       { name: 'イタタ',             country: 'チリ',         resource: 'pinot',      x: 142, y: 886, adjacent: ['biobio'] },
  ecuador_wine:{ name: 'エクアドル',         country: 'エクアドル',   resource: 'blend',      x: 148, y: 534, adjacent: ['colombia_wine','ica_peru'] },

  // オーストラリア追加
  swanvalley:  { name: 'スワン・バレー',     country: 'オーストラリア', resource: 'blend',    x: 1314, y: 628, adjacent: ['margaret','swanhills'] },
  pemberton:   { name: 'ペンバートン',       country: 'オーストラリア', resource: 'pinot',    x: 1356, y: 672, adjacent: ['margaret','greatSouthern'] },
  kingvalley:  { name: 'キング・バレー',     country: 'オーストラリア', resource: 'riesling', x: 1642, y: 710, adjacent: ['yarra','rutherglen'] },
  gippsland:   { name: 'ギップスランド',     country: 'オーストラリア', resource: 'pinot',    x: 1666, y: 762, adjacent: ['yarra','mornington'] },
  padthaway:   { name: 'パドサウェイ',       country: 'オーストラリア', resource: 'chardonnay',x: 1570, y: 718, adjacent: ['coonawarra','mclaren'] },
  hilltops:    { name: 'ヒルトップス',       country: 'オーストラリア', resource: 'blend',    x: 1614, y: 662, adjacent: ['canberra_dist','mudgee'] },
  orange_nsw:  { name: 'オレンジ(NSW)',      country: 'オーストラリア', resource: 'chardonnay',x: 1624, y: 638, adjacent: ['mudgee','hilltops'] },
  strathbogie: { name: 'ストラスボギー',     country: 'オーストラリア', resource: 'riesling', x: 1636, y: 724, adjacent: ['heathcote','rutherglen'] },

  // NZ追加
  northland:   { name: 'ノースランド',       country: 'ニュージーランド', resource: 'blend',  x: 1764, y: 776, adjacent: ['auckland'] },
  wairarapa:   { name: 'ワイラパ',           country: 'ニュージーランド', resource: 'pinot',  x: 1766, y: 838, adjacent: ['martinborough','marlborough'] },

  // 日本追加
  niigata:     { name: '新潟',               country: '日本',         resource: 'blend',      x: 1540, y: 234, adjacent: ['nagano','yamagata'] },
  kochi:       { name: '高知',               country: '日本',         resource: 'blend',      x: 1522, y: 262, adjacent: ['osaka'] },
  iwate:       { name: '岩手',               country: '日本',         resource: 'blend',      x: 1554, y: 206, adjacent: ['hokkaido'] },

  // 中国追加
  hebei:       { name: '河北',               country: '中国',         resource: 'cabernet',   x: 1358, y: 224, adjacent: ['changli','beijing_cn'] },
  beijing_cn:  { name: '北京',               country: '中国',         resource: 'blend',      x: 1372, y: 238, adjacent: ['hebei','shandong'] },
  gansu:       { name: '甘粛',               country: '中国',         resource: 'blend',      x: 1234, y: 268, adjacent: ['ningxia','xinjiang'] },

  // 南アフリカ追加
  robertson:   { name: 'ロバートソン',       country: '南アフリカ',   resource: 'chardonnay', x: 790, y: 766, adjacent: ['stellenbosch','walkerbay'] },
  elim:        { name: 'エリム',             country: '南アフリカ',   resource: 'riesling',   x: 770, y: 836, adjacent: ['walkerbay','capetown'] },
  zimbabwe:    { name: 'ジンバブエ',         country: 'ジンバブエ',   resource: 'blend',      x: 922, y: 698, adjacent: ['kenya_naivasha'] },
  namibia:     { name: 'ナミビア',           country: 'ナミビア',     resource: 'blend',      x: 712, y: 654, adjacent: ['swartland'] },

  // 中東追加
  jordan:      { name: 'ヨルダン',           country: 'ヨルダン',     resource: 'blend',      x: 966, y: 468, adjacent: ['israel_galilee','bekaa'] },
  iran:        { name: 'イラン(歴史的)',     country: 'イラン',       resource: 'blend',      x: 1040, y: 408, adjacent: ['turkey_cappadocia','bekaa'] },
};


// ===== ルートマス自動生成 =====
const OVERSEAS_ROUTES = new Set([
  ['jerez','swartland'].sort().join('-'),
  ['capetown','tuscany'].sort().join('-'),
  ['capetown','margaret'].sort().join('-'),
  ['capetown','mendoza'].sort().join('-'),
  ['bekaa','ningxia'].sort().join('-'),
  ['barossa','yamanashi'].sort().join('-'),
  ['marlborough','yamanashi'].sort().join('-'),
  ['maipo','margaret'].sort().join('-'),
  ['mendoza','napa'].sort().join('-'),
  ['douro','napa'].sort().join('-'),
  ['ningxia','changli'].sort().join('-'),
  ['willamette','okanagan'].sort().join('-'),
  ['biobio','patagonia'].sort().join('-'),
  ['auckland','gisborne'].sort().join('-'),
  ['yarra','marlborough'].sort().join('-'),
  ['turkey_cappadocia','bekaa'].sort().join('-'),
  ['georgia_kakheti','bekaa'].sort().join('-'),
  ['ningxia','xinjiang'].sort().join('-'),
]);

function isOverseasRoute(a, b) {
  return OVERSEAS_ROUTES.has([a, b].sort().join('-'));
}

const ROUTE_SQUARES = {};
(function generateRoutes() {
  const typePool = ['trivia','trivia','tasting','market','event'];
  for (const [id, region] of Object.entries(REGION_DATA)) {
    for (const adjId of region.adjacent) {
      const key = [id, adjId].sort().join('-');
      if (ROUTE_SQUARES[key]) continue;
      const adj = REGION_DATA[adjId];
      if (!adj) continue;
      const overseas = isOverseasRoute(id, adjId);
      if (overseas) {
        ROUTE_SQUARES[key] = ['event', 'trivia', typePool[Math.floor(Math.random()*3)+1], 'event'];
      } else {
        const sq = ['trivia'];
        if (region.resource === adj.resource) sq.push('tasting');
        if (adj.country !== region.country) sq.push('market');
        ROUTE_SQUARES[key] = sq;
      }
    }
  }
})();

function getRouteSquares(regionA, regionB) {
  return ROUTE_SQUARES[[regionA, regionB].sort().join('-')] || [];
}

// ===== 大陸アウトライン =====
const CONTINENTS = [
  // ヨーロッパ本体
  { fill:'#271c0a', stroke:'#483212', points:[
    [148,78],[240,54],[508,48],[696,60],[870,70],[1010,130],[1012,228],
    [944,312],[882,444],[856,544],[806,578],[620,578],[432,568],[268,556],
    [205,528],[152,498],[138,432],[130,288],[130,168],[148,78]
  ]},
  // イベリア半島（やや分離）
  { fill:'#231808', stroke:'#40280e', points:[
    [240,282],[370,255],[508,268],[520,390],[500,500],[350,540],[220,530],
    [204,490],[205,420],[218,348],[240,282]
  ]},
  // 南アフリカ
  { fill:'#221508', stroke:'#3c2610', points:[
    [620,582],[730,548],[880,580],[962,648],[966,718],[934,794],[870,864],
    [788,898],[704,888],[632,862],[608,808],[596,748],[612,688],[620,582]
  ]},
  // 南北アメリカ
  { fill:'#1e1606', stroke:'#38280c', points:[
    [30,222],[82,192],[152,210],[190,250],[225,300],[250,350],[265,448],
    [262,566],[255,648],[240,730],[215,812],[195,880],[152,900],[105,882],
    [50,855],[28,775],[26,618],[26,490],[26,360],[30,222]
  ]},
  // 中国・中央アジア
  { fill:'#271c0a', stroke:'#483212', points:[
    [1118,170],[1300,148],[1464,172],[1478,272],[1450,338],[1295,358],
    [1152,308],[1112,240],[1118,170]
  ]},
  // 日本列島
  { fill:'#281e0e', stroke:'#4a3618', points:[
    [1462,130],[1512,108],[1562,130],[1578,170],[1556,212],[1516,234],
    [1480,220],[1460,190],[1462,158],[1462,130]
  ]},
  // オーストラリア
  { fill:'#22160a', stroke:'#3e2c12', points:[
    [1252,574],[1390,534],[1562,540],[1714,572],[1762,648],[1760,764],
    [1706,806],[1614,816],[1478,800],[1342,774],[1256,722],[1236,652],
    [1252,574]
  ]},
  // ニュージーランド南島
  { fill:'#22160a', stroke:'#3e2c12', points:[
    [1716,792],[1764,774],[1798,802],[1800,882],[1764,916],[1720,904],
    [1700,864],[1710,830],[1716,792]
  ]},
  // インド亜大陸
  { fill:'#221508', stroke:'#3c2610', points:[
    [1052,428],[1150,398],[1220,438],[1222,550],[1168,618],[1098,628],
    [1052,568],[1048,488],[1052,428]
  ]},
  // 東アフリカ
  { fill:'#1e1408', stroke:'#382408', points:[
    [950,540],[1050,528],[1068,610],[1044,700],[980,750],[920,730],
    [900,660],[920,590],[950,540]
  ]},
];

// ===== 描画ヘルパー =====
function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHex(ctx, cx, cy, r, fill, stroke, strokeW = 1.5, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  hexPath(ctx, cx, cy, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeW;
  ctx.stroke();
  ctx.restore();
}

function blendColor(hex, base, t) {
  const expand = h => h.length === 4
    ? '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3] : h;
  const parse = h => {
    const e = expand(h);
    return [parseInt(e.slice(1,3),16), parseInt(e.slice(3,5),16), parseInt(e.slice(5,7),16)];
  };
  const [r1,g1,b1] = parse(hex);
  const [r2,g2,b2] = parse(base);
  return `rgb(${Math.round(r1*t+r2*(1-t))},${Math.round(g1*t+g2*(1-t))},${Math.round(b1*t+b2*(1-t))})`;
}

// ===== 海洋背景 =====
function drawOcean(ctx, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0,   '#0d2038');
  grad.addColorStop(0.4, '#0a1a2e');
  grad.addColorStop(1,   '#061020');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 緯度経度グリッド（薄い）
  ctx.save();
  ctx.strokeStyle = 'rgba(30,70,130,0.12)';
  ctx.lineWidth = 0.6;
  ctx.setLineDash([2,10]);
  for (let y = 0; y <= CANVAS_H; y += 100) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CANVAS_W,y); ctx.stroke();
  }
  for (let x = 0; x <= CANVAS_W; x += 120) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CANVAS_H); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // 大陸
  for (const c of CONTINENTS) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(c.points[0][0], c.points[0][1]);
    for (let i = 1; i < c.points.length; i++) ctx.lineTo(c.points[i][0], c.points[i][1]);
    ctx.closePath();
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // 海洋波紋アニメ
  if (time > 0) {
    ctx.save();
    const phase = (time * 0.0008) % (Math.PI * 2);
    const waveSpots = [[1100,580],[450,640],[200,570],[1600,390],[900,190],[650,700]];
    for (const [wx, wy] of waveSpots) {
      for (let ri = 0; ri < 3; ri++) {
        const rr = ((ri * 8 + phase * 6) % 22) + 4;
        const alpha = 0.06 - rr * 0.002;
        if (alpha <= 0) continue;
        ctx.beginPath();
        ctx.arc(wx, wy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(40,100,180,${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ===== ルート線 =====
const SQUARE_ICONS = { trivia:'📖', tasting:'🍷', market:'🛒', event:'🎲' };

function drawConnections(ctx, state) {
  ctx.save();
  const visible = new Set(getVisibleRegionIds(state));
  const drawn = new Set();
  for (const [id, region] of Object.entries(REGION_DATA)) {
    if (!visible.has(id)) continue;
    for (const adjId of region.adjacent) {
      const key = [id, adjId].sort().join('-');
      if (drawn.has(key)) continue;
      drawn.add(key);
      const adj = REGION_DATA[adjId];
      if (!adj || !visible.has(adjId)) continue;
      const overseas = isOverseasRoute(id, adjId);
      const squares = getRouteSquares(id, adjId);
      const total = squares.length + 2;

      ctx.beginPath();
      ctx.moveTo(region.x, region.y);
      ctx.lineTo(adj.x, adj.y);
      if (overseas) {
        ctx.setLineDash([4,6]);
        ctx.strokeStyle = 'rgba(60,130,220,0.3)';
        ctx.lineWidth = 1.2;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(140,100,38,0.38)';
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < squares.length; i++) {
        const t = (i + 1) / total;
        const sx = region.x + (adj.x - region.x) * t;
        const sy = region.y + (adj.y - region.y) * t;
        ctx.beginPath();
        ctx.arc(sx, sy, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6,16,32,0.8)';
        ctx.fill();
        ctx.strokeStyle = overseas ? 'rgba(60,130,220,0.4)' : 'rgba(100,72,24,0.5)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.font = '7px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(SQUARE_ICONS[squares[i]] || '?', sx, sy);
      }
    }
  }
  ctx.restore();
}

// ===== メイン描画 =====
// 静的な盤面(海・線路・産地・地名・建物)を裏画面に一度だけ描いてキャッシュする。
// 毎フレーム全再描画すると重く、サイコロ演出がカクつくため。
let _boardLayer = null;
let _boardDirty = true;
function markBoardDirty() { _boardDirty = true; }

function buildBoardLayer(state) {
  if (!_boardLayer) _boardLayer = document.createElement('canvas');
  _boardLayer.width = CANVAS_W;
  _boardLayer.height = CANVAS_H;
  const ctx = _boardLayer.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawOcean(ctx, 0);          // 波紋アニメは焼かない(time=0)
  drawConnections(ctx, state);

  const regions = state ? state.regions : REGION_DATA;
  const players = state ? state.players : [];
  const visibleRegions = new Set(getVisibleRegionIds(state));

  for (const [id, region] of Object.entries(REGION_DATA)) {
    if (!visibleRegions.has(id)) continue;
    const regionState = regions[id] || {};
    const ownerPlayer = state && regionState.claimedBy ? players.find(p => p.id === regionState.claimedBy) : null;
    const base = RESOURCE_COLORS[region.resource];

    hexPath(ctx, region.x, region.y, HEX_RADIUS);
    const grad = ctx.createRadialGradient(region.x - 3, region.y - 4, 2, region.x, region.y, HEX_RADIUS);
    grad.addColorStop(0, blendColor(base, '#1a1000', 0.7));
    grad.addColorStop(1, blendColor(base, '#030100', 0.35));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = ownerPlayer ? ownerPlayer.color : blendColor(base, '#111', 0.4);
    ctx.lineWidth = ownerPlayer ? 2 : 1.2;
    ctx.stroke();

    ctx.font = `${HEX_RADIUS * 0.65}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(RESOURCE_ICONS[region.resource], region.x, region.y - 5);

    ctx.font = `bold ${HEX_RADIUS * 0.56}px "Hiragino Kaku Gothic ProN","Helvetica Neue",sans-serif`;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(region.name, region.x, region.y + 6);
    ctx.fillStyle = '#f0e0cc';
    ctx.fillText(region.name, region.x, region.y + 6);

    const b = regionState.buildings || {};
    const icons = [];
    if (b.vineyard) icons.push('🌿');
    if (b.winery)   icons.push('🍾');
    if (b.cellar)   icons.push('🏛️');
    if (icons.length) {
      ctx.font = `${HEX_RADIUS * 0.5}px serif`;
      ctx.fillText(icons.join(''), region.x, region.y + HEX_RADIUS - 4);
    }
  }
}

function renderMap(canvas, state, time = 0) {
  const ctx = canvas.getContext('2d');
  if (_boardDirty || !_boardLayer) { buildBoardLayer(state); _boardDirty = false; }
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.drawImage(_boardLayer, 0, 0);

  const reachable = state ? (state.reachableRegions || []) : [];
  const players  = state ? state.players : [];
  const curPlayer = state ? players[state.currentPlayerIndex] : null;

  // 動的な強調表示だけ毎フレーム上描き(対象は数マスのみで軽い)
  if (state) {
    const highlightIds = new Set(reachable);
    if (state.destination) highlightIds.add(state.destination);
    if (curPlayer) highlightIds.add(curPlayer.position);
    for (const id of highlightIds) {
      const region = REGION_DATA[id];
      if (!region) continue;
      const isReachable = reachable.includes(id);
      const isDestination = state.destination === id;
      const isCurrentPos = curPlayer && curPlayer.position === id;

      if (isReachable) {
        const pulse = 0.25 + 0.15 * Math.sin(time * 0.004);
        hexPath(ctx, region.x, region.y, HEX_RADIUS + 6);
        ctx.fillStyle = `rgba(255,215,0,${pulse})`;
        ctx.fill();
      } else if (isDestination) {
        const pulse = 0.2 + 0.15 * Math.sin(time * 0.005 + 1);
        hexPath(ctx, region.x, region.y, HEX_RADIUS + 8);
        ctx.fillStyle = `rgba(255,80,80,${pulse})`;
        ctx.fill();
      }

      if (isReachable || isCurrentPos || isDestination) {
        hexPath(ctx, region.x, region.y, HEX_RADIUS);
        ctx.strokeStyle = isReachable ? '#FFD700' : isCurrentPos ? '#ffffff' : '#FF6060';
        ctx.lineWidth = (isReachable || isCurrentPos) ? 2.5 : 2;
        ctx.stroke();
      }

      if (isDestination) {
        ctx.font = `bold ${HEX_RADIUS * 0.5}px sans-serif`;
        ctx.fillStyle = '#FF9090';
        ctx.textAlign = 'center';
        ctx.fillText('🎯', region.x, region.y - HEX_RADIUS - 5);
      }
    }
  }

  // プレイヤートークン
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const region = REGION_DATA[p.position];
    if (!region) continue;
    const anim = p.moveAnim;
    const fromRegion = anim ? anim.from : region;
    const toRegion = anim ? anim.to : region;
    const progress = anim ? Math.min(1, (time - anim.start) / anim.duration) : 1;
    const eased = anim ? (1 - Math.pow(1 - Math.max(0, progress), 2)) : 1;
    const txBase = anim ? fromRegion.x + (toRegion.x - fromRegion.x) * eased : region.x;
    const tyBase = anim ? fromRegion.y + (toRegion.y - fromRegion.y) * eased : region.y;
    const off = getTokenOffset(i, players, p.position);
    const tx = txBase + off.x;
    const ty = tyBase + off.y;
    const r  = HEX_RADIUS * 0.58;
    const isActive = state && state.currentPlayerIndex === i;

    // アクティブプレイヤー脈動リング
    if (isActive && time > 0) {
      const pulse = 0.4 + 0.3 * Math.sin(time * 0.005);
      ctx.beginPath();
      ctx.arc(tx, ty, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,215,0,${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 影
    ctx.beginPath();
    ctx.arc(tx + 1, ty + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();

    // トークン本体（グラデ）
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    const tg = ctx.createRadialGradient(tx - r*0.3, ty - r*0.3, r*0.1, tx, ty, r);
    tg.addColorStop(0, lightenColor(p.color, 0.4));
    tg.addColorStop(1, p.color);
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = isActive ? '#FFD700' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = isActive ? 2 : 1.2;
    ctx.stroke();

    ctx.save();
    ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i + 1, tx, ty);
    ctx.restore();
  }

  if (state) {
    const wrapper = document.querySelector('.map-wrapper');
    const active = players[state.currentPlayerIndex];
    if (wrapper && active) {
      const activeAnim = active.moveAnim;
      const activeRegion = activeAnim ? activeAnim.to : REGION_DATA[active.position];
      if (activeRegion) {
        const focusX = activeAnim
          ? activeAnim.from.x + (activeAnim.to.x - activeAnim.from.x) * Math.min(1, (time - activeAnim.start) / activeAnim.duration)
          : activeRegion.x;
        const focusY = activeAnim
          ? activeAnim.from.y + (activeAnim.to.y - activeAnim.from.y) * Math.min(1, (time - activeAnim.start) / activeAnim.duration)
          : activeRegion.y;
        // キャンバスには CSS で 600px の余白がある(#mapCanvas margin)。
        // その分を足して、端の産地でも自分が常に画面中央に来るようにする。
        const MAP_MARGIN = 600;
        wrapper.scrollLeft = Math.max(0, focusX + MAP_MARGIN - wrapper.clientWidth / 2);
        wrapper.scrollTop = Math.max(0, focusY + MAP_MARGIN - wrapper.clientHeight / 2);
      }
    }
    updateStepsBadge(state, wrapper);
  }
}

// 盤面右上に「あと○マス」を固定表示(桃鉄風)。
// .map-wrapper は常時スクロールするので、毎フレーム可視領域の右上へ置き直す。
function ensureStepsBadge(wrapper) {
  let badge = document.getElementById('stepsBadge');
  if (badge) return badge;
  badge = document.createElement('div');
  badge.id = 'stepsBadge';
  badge.className = 'steps-badge';
  badge.innerHTML = `<span class="steps-badge-die">🎲</span><span class="steps-badge-text"></span>`;
  wrapper.appendChild(badge);
  return badge;
}

function updateStepsBadge(state, wrapper) {
  if (!wrapper) return;
  const badge = ensureStepsBadge(wrapper);
  const show = state.phase === 'move' && state.stepsLeft > 0;
  if (!show) { if (badge.style.display !== 'none') badge.style.display = 'none'; return; }
  const txt = `あと ${state.stepsLeft} マス`;
  const textEl = badge.querySelector('.steps-badge-text');
  // 幅の再計測(offsetWidth)は毎フレームやるとレイアウト再計算で重いので、変化時のみ。
  if (textEl.textContent !== txt) { textEl.textContent = txt; badge._w = 0; }
  if (badge.style.display !== 'flex') { badge.style.display = 'flex'; badge._w = 0; }
  if (!badge._w) badge._w = badge.offsetWidth;
  // 可視領域の右上に固定(スクロール量を加味)
  badge.style.left = (wrapper.scrollLeft + wrapper.clientWidth - badge._w - 18) + 'px';
  badge.style.top = (wrapper.scrollTop + 18) + 'px';
}

function lightenColor(hex, amount) {
  const parse = h => {
    const e = h.length === 4 ? '#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3] : h;
    return [parseInt(e.slice(1,3),16), parseInt(e.slice(3,5),16), parseInt(e.slice(5,7),16)];
  };
  const [r,g,b] = parse(hex);
  const clamp = v => Math.min(255, Math.round(v + (255 - v) * amount));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

function getTokenOffset(playerIndex, players, posId) {
  const atPos = players.reduce((acc,p,i) => { if (p.position===posId) acc.push(i); return acc; }, []);
  const myIdx = atPos.indexOf(playerIndex);
  const offsets = [{x:0,y:HEX_RADIUS+4},{x:-10,y:HEX_RADIUS+4},{x:10,y:HEX_RADIUS+4},{x:0,y:HEX_RADIUS+14}];
  return offsets[myIdx] || {x:(myIdx-1)*10, y:HEX_RADIUS+4};
}

function getRegionAtPoint(x, y, state) {
  const visibleRegions = new Set(getVisibleRegionIds(state));
  let closest = null, closestDist = HEX_RADIUS * 1.1;
  for (const [id, region] of Object.entries(REGION_DATA)) {
    if (!visibleRegions.has(id)) continue;
    const d = Math.sqrt((x-region.x)**2 + (y-region.y)**2);
    if (d < closestDist) { closest = id; closestDist = d; }
  }
  return closest;
}
