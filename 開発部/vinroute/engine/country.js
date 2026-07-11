/* 国データ（country.json）の読み込み・検証・投影。エンジンは国名を一切知らない */

/* 緯度経度 → 論理座標(0-100)。bbox正規化 */
export function makeProjector(bbox) {
  const lonSpan = bbox.maxLon - bbox.minLon;
  const latSpan = bbox.maxLat - bbox.minLat;
  return {
    ll2logic(lat, lon) {
      return [((lon - bbox.minLon) / lonSpan) * 100, ((bbox.maxLat - lat) / latSpan) * 100];
    },
    logic2ll(x, y) {
      return [bbox.maxLat - (y / 100) * latSpan, bbox.minLon + (x / 100) * lonSpan];
    },
  };
}

/* country.json → エンジン内部表現。regions/cities を nodes に統合しつつ区別を保つ */
export function loadCountry(json) {
  const errors = validateCountry(json);
  if (errors.length) throw new Error("country data invalid: " + errors.join(" / "));

  const proj = makeProjector(json.geo.bbox);
  const nodes = {}; // key -> {key,kind:'region'|'city',name,group,type,value,x,y,mark,isStart}

  for (const k in json.regions) {
    const r = json.regions[k];
    const [x, y] = proj.ll2logic(r.lat, r.lon);
    nodes[k] = { key: k, kind: "region", name: r.name, group: r.group, type: r.type,
      altTypes: r.altTypes || [], value: r.value, x, y, mark: r.mark || "vines", lore: r.lore || null };
  }
  for (const k in json.cities) {
    const c = json.cities[k];
    const [x, y] = proj.ll2logic(c.lat, c.lon);
    nodes[k] = { key: k, kind: "city", name: c.name, group: "city", type: null,
      altTypes: [], value: 0, x, y, mark: c.mark || "city", isStart: !!c.isStart, lore: c.lore || null };
  }

  const outlines = (json.geo.outlines || []).map(o => ({
    name: o.name,
    points: o.latlon.map(p => proj.ll2logic(p[0], p[1])),
  }));

  const startKey = Object.keys(json.cities).find(k => json.cities[k].isStart);

  return {
    id: json.id, name: json.name,
    raw: json, proj, nodes, outlines,
    regionKeys: Object.keys(json.regions),
    cityKeys: Object.keys(json.cities),
    links: json.links,
    geoSets: json.sets.geo,
    typeLabels: json.sets.typeLabels,
    startKey,
    flavor: json.flavor || {},
  };
}

/* スキーマ検証（Step 0の抽出検証を兼ねる） */
export function validateCountry(json) {
  const errors = [];
  if (!json.id) errors.push("id がない");
  if (!json.geo || !json.geo.bbox) errors.push("geo.bbox がない");
  if (!json.regions || Object.keys(json.regions).length === 0) errors.push("regions が空");
  if (!json.cities || Object.keys(json.cities).length === 0) errors.push("cities が空");
  if (!Array.isArray(json.links) || json.links.length === 0) errors.push("links が空");
  if (!json.sets || !json.sets.geo || !Array.isArray(json.sets.typeLabels)) errors.push("sets が不完全");
  if (errors.length) return errors;

  const keys = new Set([...Object.keys(json.regions), ...Object.keys(json.cities)]);
  for (const k in json.regions) {
    const r = json.regions[k];
    if (typeof r.lat !== "number" || typeof r.lon !== "number") errors.push(`region ${k}: lat/lon が数値でない`);
    if (!json.sets.typeLabels.includes(r.type)) errors.push(`region ${k}: type "${r.type}" が typeLabels にない`);
  }
  for (const k in json.cities) {
    const c = json.cities[k];
    if (typeof c.lat !== "number" || typeof c.lon !== "number") errors.push(`city ${k}: lat/lon が数値でない`);
  }
  json.links.forEach((lk, i) => {
    if (!keys.has(lk.a)) errors.push(`links[${i}]: 不明なノード "${lk.a}"`);
    if (!keys.has(lk.b)) errors.push(`links[${i}]: 不明なノード "${lk.b}"`);
  });
  for (const s in json.sets.geo) {
    json.sets.geo[s].forEach(k => { if (!json.regions[k]) errors.push(`geoSet ${s}: 不明な産地 "${k}"`); });
  }
  const starts = Object.keys(json.cities).filter(k => json.cities[k].isStart);
  if (starts.length !== 1) errors.push(`isStart の都市が ${starts.length} 件（1件であるべき）`);
  return errors;
}
