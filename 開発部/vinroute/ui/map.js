/* Canvas描画（国非依存）v2：AI生成スプライトによる本実装
   - 地形＝海/草テクスチャ＋砂浜の縁取り（国の輪郭でクリップ）
   - 道＝石畳テクスチャ／マス＝金縁タイル／産地・都市＝広場プレート
   - 名所名産・木・花・ぶどう畑は「道・マス・広場に被らない」よう seed 制御で自動配置
   - キャラ＝シリコンフィギュアPNG（DOM要素で追従） */
import { bestPickToward } from "../engine/state.js";
import { makeRng } from "../engine/rng.js";
import { charSprite } from "./characters.js";
import { sfx } from "./sound.js";

export const KIND_STYLE = {
  card:      { c: "#16c65a", tile: "cell_green",  label: "カード" },
  criticHit: { c: "#ff2d2d", tile: "cell_red",    label: "評論家" },
  quiz:      { c: "#1f7bff", tile: "cell_blue",   label: "クイズ" },
  market:    { c: "#b026ff", tile: "cell_purple", label: "市場" },
  slot:      { c: "#00d0e0", tile: "cell_cyan",   label: "資源" },
  fund:      { c: "#ffc400", tile: "cell_yellow", label: "資金" },
};
const PLAZA_BY_GROUP = { red: "plaza_red", white: "plaza_white", sparkle: "plaza_sparkle", rose: "plaza_rose", city: "plaza_city" };

export function createMapRenderer(g, dom, uiState) {
  const { canvas, avatarLayer, gameEl } = dom;
  const ctx = canvas.getContext("2d");
  const country = g.country;
  let W = 0, H = 0;
  const DPR = 1; // 性能優先（Intel Mac配慮）：等倍描画
  const CLOSE_ZOOM = 2.6, OVER_ZOOM = 0.85;
  const cam = { x: 46, y: 24, zoom: CLOSE_ZOOM, tx: 46, ty: 24, tzoom: CLOSE_ZOOM };
  let overview = false, panX = 0, panY = 0, userPanned = false;
  let criticSpriteEl = null, criticFollow = null;

  const cx0 = avg(g.board.cellArr.map(c => c.x));
  const cy0 = avg(g.board.cellArr.map(c => c.y));
  function avg(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

  const BASE = () => Math.min(W, H) / 100;
  const P = (x, y) => {
    const s = BASE() * cam.zoom;
    return [W / 2 + (x - cam.x) * s + cam.sx, H / 2 + (y - cam.y) * s + cam.sy];
  };

  /* ===== カメラ演出：パンチズーム（一瞬寄る/引く）・シェイク・呼吸 ===== */
  cam.zbase = cam.zoom; cam.sx = 0; cam.sy = 0;
  let punch0 = 0, punchAmt = 0, punchDur = 0;
  let shake0 = 0, shakeAmp = 0, shakeDur = 0;
  function punch(amt = 0.14, ms = 800) { punchAmt = amt; punchDur = ms; punch0 = performance.now(); }
  function shake(amp = 8, ms = 450) { shakeAmp = amp; shakeDur = ms; shake0 = performance.now(); }
  function cameraFx(now) {
    let pz = 1 + 0.007 * Math.sin(now / 1900); // ゆっくり呼吸
    if (punch0) {
      const t = (now - punch0) / punchDur;
      if (t < 1) pz *= 1 + punchAmt * Math.sin(t * Math.PI);
      else punch0 = 0;
    }
    if (shake0) {
      const t = (now - shake0) / shakeDur;
      if (t < 1) {
        const a = shakeAmp * (1 - t);
        cam.sx = (Math.random() * 2 - 1) * a;
        cam.sy = (Math.random() * 2 - 1) * a;
      } else { shake0 = 0; cam.sx = 0; cam.sy = 0; }
    }
    return pz;
  }

  /* ===== 画像ロード ===== */
  const IMG = {};                 // name -> Image（ロード成功のみ）
  function loadImg(name, paths) {
    return new Promise(resolve => {
      const tryNext = i => {
        if (i >= paths.length) { resolve(null); return; }
        const im = new Image();
        im.onload = () => { IMG[name] = im; resolve(im); };
        im.onerror = () => tryNext(i + 1);
        im.src = paths[i];
      };
      tryNext(0);
    });
  }
  const art = country.raw.art || {};
  const loaders = [];
  ["cell_green", "cell_yellow", "cell_red", "cell_blue", "cell_purple", "cell_cyan",
    "plaza_red", "plaza_white", "plaza_sparkle", "plaza_rose", "plaza_city",
    "road", "grass", "sea"].forEach(n => loaders.push(loadImg(n, [`assets/game/tile/${n}.png`])));
  ["tree", "vineyard", "house", "flowers_white", "flowers_orange", "fence"]
    .forEach(n => loaders.push(loadImg(n, [`assets/game/deco/${n}.png`, `assets/game/lm/${n}.png`])));
  loaders.push(loadImg("house2", ["assets/game/lm/house_stone.png"]));
  for (const k in (art.landmarks || {})) {
    loaders.push(loadImg("lm_" + k, [`assets/game/lm/${art.landmarks[k]}`]));
  }
  (art.trees || []).forEach(f => loaders.push(loadImg("tree:" + f, [`assets/game/deco/${f}`, `assets/game/lm/${f}`])));
  if (art.mountainSprite) loaders.push(loadImg("mountain", [`assets/game/lm/${art.mountainSprite}`]));
  const ready = Promise.all(loaders).then(() => { buildDecor(); buildWorldCanvas(); });

  /* ===== プレイヤーアバター（PNG） ===== */
  const avatars = [];
  function buildAvatars(chars) {
    avatarLayer.innerHTML = "";
    g.players.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "mapAvatar" + (p.isNpc ? " npc" : "");
      div.innerHTML = `<div class="nameTag">${p.pname}</div><img src="${charSprite(chars[i].id)}" style="display:block;height:46px;width:auto;margin:0 auto">`;
      avatarLayer.appendChild(div);
      const c = g.board.cells[p.posCell];
      avatars[i] = { el: div, dlx: c.x, dly: c.y, ch: chars[i] };
    });
    const cel = document.createElement("div");
    cel.className = "criticSprite";
    cel.innerHTML = `<img src="assets/game/critic.png" alt="評論家" style="display:block;height:56px;width:auto">`;
    cel.style.display = "none";
    avatarLayer.appendChild(cel);
    criticSpriteEl = cel;
  }

  /* ===== 幾何ヘルパー ===== */
  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  const inLand = (x, y) => country.outlines.some(o => pointInPoly(x, y, o.points));
  function distToNearestCell(x, y) {
    let d = Infinity;
    for (const c of g.board.cellArr) {
      const dd = Math.hypot(c.x - x, c.y - y);
      if (dd < d) d = dd;
    }
    return d;
  }

  /* 川の折れ線（論理座標）：描画のquadraticCurveToと同じ形を直線近似でサンプリング。
     川辺の並木（buildDecor）と橋（buildWorldCanvas）で共用する */
  function riverPolys() {
    return (country.raw.geo.rivers || []).map(rv => {
      const pts = rv.latlon.map(pt => country.proj.ll2logic(pt[0], pt[1]));
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const pv = pts[i - 1], pt = pts[i];
        const cx = (pv[0] + pt[0]) / 2 + (i % 2 ? 3 : -3), cy = (pv[1] + pt[1]) / 2;
        for (let t = 1; t <= 8; t++) {
          const u = t / 8, v = 1 - u;
          out.push([v * v * pv[0] + 2 * v * u * cx + u * u * pt[0], v * v * pv[1] + 2 * v * u * cy + u * u * pt[1]]);
        }
      }
      return out;
    });
  }

  /* ===== 装飾の自動配置（道・マス・広場に被らない） =====
     マスは全て道の上にあるので「全マスから一定距離」を取れば道にも被らない。
     ノード（広場）はさらに広めに避ける。seed固定＝同じ盤面なら同じ風景 */
  let decor = [];   // {img, x, y, w, h} 底辺中央基準
  function buildDecor() {
    decor = [];
    const rnd = makeRng((g.board.seed ?? 7) * 131 + 7);
    const nodePos = g.board.nodePos;

    /* 道の線分リスト（マス間の道そのものに被らないための距離判定に使う） */
    const roadEdges = [];
    g.board.cellArr.forEach(cc => cc.next.forEach(nid => {
      if (cc.id < nid) { const n = g.board.cells[nid]; roadEdges.push([cc.x, cc.y, n.x, n.y]); }
    }));
    const distToRoad = (x, y) => {
      let d = Infinity;
      for (const [x1, y1, x2, y2] of roadEdges) {
        const dx = x2 - x1, dy = y2 - y1;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
        const dd = Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
        if (dd < d) d = dd;
      }
      return d;
    };

    /* 地名ラベルの矩形（広場の下に描かれる文字。絵で隠さない） */
    const labelZones = [];
    for (const k in nodePos) {
      const node = country.nodes[k];
      const R = (node.kind === "city" ? 1.08 : 1.2);
      labelZones.push({ x: nodePos[k].x, y: nodePos[k].y + R + 0.6, hw: node.name.length * 0.45 + 0.4, hh: 0.75 });
    }
    /* スプライト（底辺中央x,y・半幅r・高さh）がラベル矩形に重なるか */
    const hitsLabel = (x, y, r, h) => {
      for (const z of labelZones) {
        if (Math.abs(x - z.x) < z.hw + r * 0.8 && y > z.y - z.hh - 0.1 && y - h < z.y + z.hh + 0.1) return true;
      }
      return false;
    };

    const clearOf = (x, y, r) => {
      if (!inLand(x, y)) return false;
      if (distToNearestCell(x, y) < r * 0.6 + 1.7) return false;
      const h = r * 2.2;
      if (distToRoad(x, y - h * 0.4) < r * 0.55 + 0.75) return false; // 絵の胴体が道に被らない
      if (hitsLabel(x, y, r, h)) return false;                        // 地名を隠さない
      for (const k in nodePos) {
        if (Math.hypot(nodePos[k].x - x, nodePos[k].y - y) < r + 3.2) return false;
      }
      for (const d of decor) {
        if (Math.hypot(d.x - x, d.y - y) < (r + d.w / 2) * 0.7) return false;
      }
      return true;
    };
    const put = (img, x, y, w) => {
      if (!img) return false;
      const h = w * (img.naturalHeight / img.naturalWidth);
      decor.push({ img, x, y, w, h });
      return true;
    };
    // 0) 手植えの景観（art.placed：ノード相対の設計配置）。
    //    道の形はゲームごとに少し変わるため、希望位置が道・地名・マスに被る時は
    //    近くの空き地へ自動でずらす（見つからなければ置かない）
    const clearHand = (x, y, r) => {
      if (!inLand(x, y)) return false;
      const h = r * 2.2;
      if (distToNearestCell(x, y) < r * 0.6 + 1.5) return false;
      if (distToRoad(x, y - h * 0.4) < r * 0.55 + 0.75) return false;
      if (hitsLabel(x, y, r, h)) return false;
      for (const d of decor) { if (Math.hypot(d.x - x, d.y - y) < (r + d.w / 2) * 0.6) return false; }
      return true;
    };
    (art.placed || []).forEach(pl => {
      const base = pl.near ? nodePos[pl.near] : { x: 0, y: 0 };
      if (!base) return;
      const img = IMG[pl.img] || IMG["tree:" + pl.img];
      if (!img) return;
      const r = (pl.w || 2.6) / 2;
      const x0 = base.x + (pl.dx || 0), y0 = base.y + (pl.dy || 0);
      outer:
      for (const rad of [0, 0.9, 1.8, 2.7, 3.6]) {
        for (let a = 0; a < (rad ? 12 : 1); a++) {
          const ang = a * Math.PI / 6;
          const x = x0 + Math.cos(ang) * rad, y = y0 + Math.sin(ang) * rad * 0.8;
          if (clearHand(x, y, r)) { put(img, x, y, pl.w || 2.6); break outer; }
        }
      }
    });

    // 1) 名所名産：各ノードの近傍リングで空きを探す
    const offsets = [];
    for (let a = 0; a < 16; a++) {
      const ang = -Math.PI / 2 + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * (Math.PI / 8);
      offsets.push([Math.cos(ang), Math.sin(ang)]);
    }
    const clearForLm = (x, y, r, ownKey) => {
      if (!inLand(x, y)) return false;
      if (distToNearestCell(x, y) < r * 0.5 + 1.5) return false;
      if (distToRoad(x, y - r * 0.9) < r * 0.5 + 0.7) return false;
      if (hitsLabel(x, y, r, r * 2)) return false;
      for (const k2 in nodePos) {
        const min = (k2 === ownKey ? r * 0.6 + 2.4 : r * 0.6 + 3.4);
        if (Math.hypot(nodePos[k2].x - x, nodePos[k2].y - y) < min) return false;
      }
      for (const d of decor) {
        if (Math.hypot(d.x - x, d.y - y) < (r + d.w / 2) * 0.7) return false;
      }
      return true;
    };
    for (const k in nodePos) {
      const img = IMG["lm_" + k];
      if (!img) continue;
      const big = (art.bigLandmarks || []).includes(k);
      let placed = false;
      for (const w of (big ? [4.5, 4] : [3.6, 3.2, 2.8])) {
        for (const rad of [4.5, 6, 7.5, 9.5, 12]) {
          for (const [ox, oy] of offsets) {
            const x = nodePos[k].x + ox * rad, y = nodePos[k].y + oy * rad * 0.8;
            if (clearForLm(x, y, w / 2, k)) { put(img, x, y + w * 0.2, w); placed = true; break; }
          }
          if (placed) break;
        }
        if (placed) break;
      }
    }
    // 2) ぶどう畑：ワイン産地の近くに「畝が揃った畑」（3列×2段＋端に柵＝人の手が入った畑に見せる）
    const vy = IMG.vineyard;
    if (vy) {
      for (const k of country.regionKeys) {
        // ワイン産地には原則畑を置く（銘醸地らしさ＝地図情報の反映）。2区画目は半々で
        const blocks = rnd() < 0.15 ? 0 : (rnd() < 0.5 ? 2 : 1);
        for (let b = 0; b < blocks; b++) placeVineyardBlock(k);
      }
    }
    function placeVineyardBlock(k) {
      const vy = IMG.vineyard;
      {
        const n = nodePos[k];
        let done = false;
        for (const rad of [8, 10, 13, 16]) {
          for (const [ox, oy] of offsets) {
            const x = n.x + ox * rad, y = n.y + oy * rad * 0.8;
            const cells = [];
            for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
              cells.push([x + col * 2.5 + row * 0.22, y + row * 1.15]);
            }
            if (cells.every(([px2, py2]) => clearOf(px2, py2, 2.5))) {
              cells.forEach(([px2, py2], ci) => put(vy, px2, py2, 2.7 + (ci >= 3 ? 0.15 : 0)));
              if (IMG.fence) {
                if (clearOf(x - 2.5, y + 0.6, 1.0)) put(IMG.fence, x - 2.5, y + 0.6, 2.2);
                if (clearOf(x + 7.5, y + 0.6, 1.0)) put(IMG.fence, x + 7.5, y + 0.6, 2.2);
              }
              done = true; break;
            }
          }
          if (done) break;
        }
      }
    }
    // 3) 山（国データの山地に）
    if (IMG.mountain) {
      (country.raw.geo.elevation || []).forEach(m => {
        const [x, y] = country.proj.ll2logic(m.lat, m.lon);
        for (const [ox, oy] of offsets) {
          const px2 = x + ox * 5, py2 = y + oy * 4;
          if (clearOf(px2, py2, 2.4)) { put(IMG.mountain, px2, py2 + 1.2, 4.5); break; }
        }
      });
    }
    // 4) 自然と暮らしの「かたまり」配置（一様ばら撒きをやめ、意味の単位で置く）
    const treeImgs = [IMG.tree, ...(art.trees || []).map(f => IMG["tree:" + f])].filter(Boolean);
    const houseImgs = [IMG.house, IMG.house2].filter(Boolean);
    const flowerImgs = [IMG.flowers_white, IMG.flowers_orange].filter(Boolean);

    // 4a) 村：都市の広場のそばに家＋柵＋花（暮らしの気配）。
    //     都市ほど建物が多い＝大都市(bigLandmarks)4軒・都市3軒（地図情報の反映）
    if (houseImgs.length) {
      for (const k in nodePos) {
        if (country.nodes[k].kind !== "city") continue;
        const target = (art.bigLandmarks || []).includes(k) ? 4 : 3;
        const n = nodePos[k];
        let placedH = 0;
        for (const rad of [5.5, 7, 8.5, 10.5, 12.5]) {
          for (const [ox, oy] of offsets) {
            if (placedH >= target) break;
            const x = n.x + ox * rad, y = n.y + oy * rad * 0.8;
            if (clearOf(x, y, 1.5)) {
              put(houseImgs[Math.floor(rnd() * houseImgs.length)], x, y, 2.5);
              if (IMG.fence && clearOf(x + 2.3, y + 0.3, 1.0)) put(IMG.fence, x + 2.3, y + 0.3, 2.1);
              if (flowerImgs.length && clearOf(x - 2.1, y + 0.5, 0.8)) put(flowerImgs[Math.floor(rnd() * flowerImgs.length)], x - 2.1, y + 0.5, 1.5);
              placedH++;
            }
          }
          if (placedH >= target) break;
        }
      }
    }

    // 4b) 森：3〜7本の木のかたまり（群生。中心ほど密、外周ほど小さめの木）
    const forest = (fx, fy, count) => {
      let ok = 0, t = 0;
      while (ok < count && t++ < count * 8) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 4.2;
        const x = fx + Math.cos(a) * r, y = fy + Math.sin(a) * r * 0.75;
        const w = 2.2 + rnd() * 1.4 + (1 - r / 4.2) * 0.5;
        if (clearOf(x, y, w / 2 * 0.75)) { put(treeImgs[Math.floor(rnd() * treeImgs.length)], x, y, w); ok++; }
      }
      return ok;
    };
    if (treeImgs.length) {
      // 山がち（標高が高い）ほど森が湧きやすく、本数も多い＝地図の地形の反映
      let clusters = 0, tries = 0;
      while (clusters < 16 && tries++ < 320) {
        const cx = 4 + rnd() * 92, cy = 4 + rnd() * 92;
        if (!inLand(cx, cy) || distToNearestCell(cx, cy) < 4.2) continue;
        const e = elevationAt(...country.proj.logic2ll(cx, cy));
        if (rnd() > 0.3 + e * 1.6) continue; // 平地は3割、山地はほぼ確定で森に
        if (forest(cx, cy, 3 + Math.floor(rnd() * 4) + Math.round(e * 4)) >= 2) clusters++;
      }
    }

    // 4c) 花畑：同じ種類の花だけを楕円形に4〜7株（種類を混ぜない＝畑に見える）
    if (flowerImgs.length) {
      let patches = 0, tries = 0;
      while (patches < 6 && tries++ < 120) {
        const cx = 5 + rnd() * 90, cy = 5 + rnd() * 90;
        if (!inLand(cx, cy)) continue;
        const img = flowerImgs[Math.floor(rnd() * flowerImgs.length)];
        let ok = 0;
        const count = 4 + Math.floor(rnd() * 4);
        for (let f = 0; f < count; f++) {
          const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 2.6;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.6;
          if (clearOf(x, y, 0.8)) { put(img, x, y, 1.4 + rnd() * 0.6); ok++; }
        }
        if (ok >= 3) patches++;
      }
    }

    // 4d) 川辺の並木：川に沿って点々と木（水辺の気配）
    if (treeImgs.length) {
      riverPolys().forEach(poly => {
        for (let i = 2; i < poly.length - 2; i += 5 + Math.floor(rnd() * 4)) {
          const [rx, ry] = poly[i];
          const side = rnd() < 0.5 ? -1 : 1;
          const x = rx + side * (1.6 + rnd() * 1.2), y = ry + (rnd() - 0.3) * 1.4;
          if (clearOf(x, y, 1.2)) put(treeImgs[Math.floor(rnd() * treeImgs.length)], x, y, 2.3 + rnd() * 0.9);
        }
      });
    }

    // 4e) 孤木：開けた草原にぽつんと立つ木を少しだけ（余白のアクセント。密度の緩急を作る）
    if (treeImgs.length) {
      let lone = 0, tries = 0;
      while (lone < 6 && tries++ < 120) {
        const x = 3 + rnd() * 94, y = 3 + rnd() * 94;
        let nearDecor = false;
        for (const d of decor) { if (Math.hypot(d.x - x, d.y - y) < 8) { nearDecor = true; break; } }
        if (!nearDecor && clearOf(x, y, 1.6)) { put(treeImgs[Math.floor(rnd() * treeImgs.length)], x, y, 2.8 + rnd() * 0.8); lone++; }
      }
    }
    decor.sort((a, b) => (a.y) - (b.y)); // 奥から手前へ（yソート）
  }

  /* ===== 静的世界の焼き込み =====
     動かないもの（海・陸・道・マス・広場・地名・装飾）を一度だけ1枚のキャンバスに描き、
     毎フレームはその1枚＋動くものだけを描く（低スペック機対応の最重要最適化） */
  const geo = country.raw.geo;
  const WORLD_RES = 2048, W2C = WORLD_RES / 100; // 論理1単位 = 約20.5px
  let worldCanvas = null;
  let seaPat = null;

  function patternOf(img, tilePx, c) {
    const t = document.createElement("canvas");
    t.width = t.height = tilePx;
    t.getContext("2d").drawImage(img, 0, 0, tilePx, tilePx);
    return c.createPattern(t, "repeat");
  }
  function traceOutlines(c, scale) {
    c.beginPath();
    country.outlines.forEach(o => {
      o.points.forEach((pt, i) => { i ? c.lineTo(pt[0] * scale, pt[1] * scale) : c.moveTo(pt[0] * scale, pt[1] * scale); });
      c.closePath();
    });
  }

  /* ===== 標高（国データの山地情報から）：山がちな場所を茶→白（雪）へ、等高線を重ねる =====
     低地は0（芝のまま）。山の中心に近いほど1に近づく（複数の山がなだらかに合成される） */
  function elevationAt(lat, lon) {
    let e = 0;
    (geo.elevation || []).forEach(m => {
      e += Math.max(0, 1 - Math.hypot(lat - m.lat, lon - m.lon) / m.radius) * (m.strength ?? 1);
    });
    return Math.min(1, e);
  }
  function elevGrid(step) {
    const n = Math.round(100 / step) + 1;
    const grid = new Float32Array(n * n);
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        const [lat, lon] = country.proj.logic2ll(gx * step, gy * step);
        grid[gy * n + gx] = elevationAt(lat, lon);
      }
    }
    return { grid, n, step };
  }
  /* 標高→色（低地は透明＝芝そのまま。丘は土色、山頂は雪の白） */
  function elevColor(e, alpha) {
    const stops = [
      [0.00, [150, 210, 120]], [0.30, [150, 210, 120]], [0.45, [196, 178, 128]],
      [0.62, [176, 150, 110]], [0.80, [205, 195, 178]], [1.00, [255, 255, 255]],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      if (e <= stops[i + 1][0]) {
        const t = (e - stops[i][0]) / (stops[i + 1][0] - stops[i][0] || 1);
        const a = stops[i][1], b = stops[i + 1][1];
        return `rgba(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)},${alpha})`;
      }
    }
    return `rgba(255,255,255,${alpha})`;
  }
  function drawElevation(c, U) {
    if (!(geo.elevation || []).length) return;
    const step = 0.8;
    const { grid, n } = elevGrid(step);
    // 塗り：閾値以下（低地）は描かない＝芝テクスチャがそのまま透ける
    for (let gy = 0; gy < n - 1; gy++) {
      for (let gx = 0; gx < n - 1; gx++) {
        const e = grid[gy * n + gx];
        if (e < 0.28) continue;
        const alpha = Math.min(1, (e - 0.28) / 0.72);
        c.fillStyle = elevColor(e, alpha);
        c.fillRect(gx * step * U - 0.5, gy * step * U - 0.5, step * U + 1, step * U + 1);
      }
    }
    // 等高線
    const levels = [0.3, 0.42, 0.54, 0.66, 0.78, 0.9];
    levels.forEach((lv, li) => {
      c.strokeStyle = lv >= 0.78 ? "rgba(255,255,255,.65)" : `rgba(95,75,50,${0.18 + li * 0.06})`;
      c.lineWidth = Math.max(1, 0.06 * U);
      for (let gy = 0; gy < n - 1; gy++) {
        for (let gx = 0; gx < n - 1; gx++) {
          const a = grid[gy * n + gx], b = grid[gy * n + gx + 1];
          const d = grid[(gy + 1) * n + gx], e2 = grid[(gy + 1) * n + gx + 1];
          const pts = [];
          const edge = (va, vb, xa, ya, xb, yb) => {
            if ((va < lv) !== (vb < lv)) {
              const t = (lv - va) / (vb - va);
              pts.push([xa + (xb - xa) * t, ya + (yb - ya) * t]);
            }
          };
          const x0 = gx * step, y0 = gy * step, x1 = x0 + step, y1 = y0 + step;
          edge(a, b, x0, y0, x1, y0); edge(b, e2, x1, y0, x1, y1);
          edge(e2, d, x1, y1, x0, y1); edge(d, a, x0, y1, x0, y0);
          if (pts.length >= 2) {
            c.beginPath();
            c.moveTo(pts[0][0] * U, pts[0][1] * U);
            c.lineTo(pts[1][0] * U, pts[1][1] * U);
            c.stroke();
          }
        }
      }
    });
  }

  function buildWorldCanvas() {
    worldCanvas = document.createElement("canvas");
    worldCanvas.width = worldCanvas.height = WORLD_RES;
    const c = worldCanvas.getContext("2d");
    const U = W2C; // 単位→px

    // 海
    if (IMG.sea) { c.fillStyle = patternOf(IMG.sea, Math.round(21 * U), c); c.fillRect(0, 0, WORLD_RES, WORLD_RES); }
    else { c.fillStyle = "#7fc4e8"; c.fillRect(0, 0, WORLD_RES, WORLD_RES); }
    // 沖のきらめき（陸から離れた海面に小さな白い光）
    {
      const srand = makeRng((g.board.seed ?? 7) * 13 + 5);
      c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = 0.09 * U; c.lineCap = "round";
      let n = 0, tries = 0;
      while (n < 80 && tries++ < 900) {
        const x = srand() * 100, y = srand() * 100;
        if (inLand(x, y) || distToNearestCell(x, y) < 6) continue;
        const w = 0.4 + srand() * 0.7;
        c.beginPath(); c.moveTo((x - w / 2) * U, y * U); c.lineTo((x + w / 2) * U, y * U); c.stroke();
        if (srand() < 0.4) { c.beginPath(); c.moveTo((x + 0.3) * U, (y + 0.35) * U); c.lineTo((x + 0.3 + w * 0.5) * U, (y + 0.35) * U); c.stroke(); }
        n++;
      }
    }
    // 浅瀬→白波→砂浜の縁取り（岸に向かって明るくなるグラデーション）
    traceOutlines(c, U);
    c.strokeStyle = "rgba(255,255,255,.14)"; c.lineWidth = 6.8 * U; c.lineJoin = "round"; c.stroke();
    traceOutlines(c, U);
    c.strokeStyle = "rgba(255,255,255,.2)"; c.lineWidth = 4.8 * U; c.stroke();
    traceOutlines(c, U);
    c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 3.4 * U; c.stroke();
    traceOutlines(c, U);
    c.strokeStyle = "rgba(246,232,193,.96)"; c.lineWidth = 2.2 * U; c.stroke();
    // 陸＝草
    c.save();
    traceOutlines(c, U);
    c.clip();
    if (IMG.grass) { c.fillStyle = patternOf(IMG.grass, Math.round(17 * U), c); c.fillRect(0, 0, WORLD_RES, WORLD_RES); }
    else { c.fillStyle = "#8bc46a"; c.fillRect(0, 0, WORLD_RES, WORLD_RES); }
    // 草地の濃淡パッチ（均一な芝をやめ、明るい草原と深い緑のむらを作る）
    {
      const prand = makeRng((g.board.seed ?? 7) * 77 + 3);
      for (let i = 0; i < 26; i++) {
        const x = prand() * 100, y = prand() * 100, r = 4 + prand() * 9;
        const grad = c.createRadialGradient(x * U, y * U, 0, x * U, y * U, r * U);
        grad.addColorStop(0, prand() < 0.5 ? "rgba(90,150,80,.15)" : "rgba(215,240,160,.14)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = grad;
        c.beginPath(); c.ellipse(x * U, y * U, r * U, r * 0.7 * U, 0, 0, 7); c.fill();
      }
    }
    // 標高（山がちな場所だけ茶→白へ色づけ＋等高線。低地の芝はそのまま）
    drawElevation(c, U);
    // 川
    c.strokeStyle = "rgba(120,190,230,.9)"; c.lineWidth = 0.9 * U; c.lineCap = "round"; c.lineJoin = "round";
    (geo.rivers || []).forEach(rv => {
      const pts = rv.latlon.map(pt => country.proj.ll2logic(pt[0], pt[1]));
      c.beginPath();
      pts.forEach((pt, i) => {
        if (i === 0) c.moveTo(pt[0] * U, pt[1] * U);
        else {
          const pv = pts[i - 1];
          c.quadraticCurveTo((pv[0] + pt[0]) / 2 * U + (i % 2 ? 3 : -3) * U, (pv[1] + pt[1]) / 2 * U, pt[0] * U, pt[1] * U);
        }
      });
      c.stroke();
    });
    c.restore();

    // 道（石畳）
    c.lineCap = "round"; c.lineJoin = "round";
    const roadW = 0.95 * U;
    const roadPass = (style, w) => {
      c.strokeStyle = style; c.lineWidth = w;
      c.beginPath();
      g.board.cellArr.forEach(cc => cc.next.forEach(nid => {
        if (cc.id < nid) {
          const n = g.board.cells[nid];
          c.moveTo(cc.x * U, cc.y * U); c.lineTo(n.x * U, n.y * U);
        }
      }));
      c.stroke();
    };
    roadPass("rgba(140,110,60,.85)", roadW * 1.22);
    roadPass(IMG.road ? patternOf(IMG.road, Math.round(2.2 * U), c) : "#ecdcb4", roadW);

    // 川と道の交点に木の橋（板張り＋両側の欄干。「渡っている」文脈を作る）
    {
      const segX = (a, b, p, q) => { // 線分交差：交点を返す（なければnull）
        const d1x = b[0] - a[0], d1y = b[1] - a[1], d2x = q[0] - p[0], d2y = q[1] - p[1];
        const den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) < 1e-9) return null;
        const t = ((p[0] - a[0]) * d2y - (p[1] - a[1]) * d2x) / den;
        const s = ((p[0] - a[0]) * d1y - (p[1] - a[1]) * d1x) / den;
        if (t < 0 || t > 1 || s < 0 || s > 1) return null;
        return [a[0] + d1x * t, a[1] + d1y * t, Math.atan2(d1y, d1x)];
      };
      const bridges = [];
      const rivers = riverPolys();
      g.board.cellArr.forEach(cc => cc.next.forEach(nid => {
        if (cc.id >= nid) return;
        const nn = g.board.cells[nid];
        rivers.forEach(poly => {
          for (let i = 1; i < poly.length; i++) {
            const hit = segX([cc.x, cc.y], [nn.x, nn.y], poly[i - 1], poly[i]);
            if (hit && !bridges.some(b => Math.hypot(b[0] - hit[0], b[1] - hit[1]) < 3)) bridges.push(hit);
          }
        });
      }));
      bridges.forEach(([bx, by, ang]) => {
        c.save();
        c.translate(bx * U, by * U); c.rotate(ang);
        const L = 2.6 * U, Wb = 0.95 * 1.22 * U; // 幅は道（外縁込み）と同じ
        c.fillStyle = "#8a5a30";
        c.fillRect(-L / 2, -Wb / 2, L, Wb);
        c.fillStyle = "#a8713d";
        const planks = 6;
        for (let p2 = 0; p2 < planks; p2++) {
          c.fillRect(-L / 2 + p2 * (L / planks) + 0.04 * U, -Wb / 2 + 0.06 * U, L / planks - 0.08 * U, Wb - 0.12 * U);
        }
        c.fillStyle = "#6b4522"; // 欄干
        c.fillRect(-L / 2, -Wb / 2 - 0.14 * U, L, 0.16 * U);
        c.fillRect(-L / 2, Wb / 2 - 0.02 * U, L, 0.16 * U);
        c.restore();
      });
    }

    // マス（金縁タイル）
    const S = 0.62 * U;
    g.board.cellArr.forEach(cc => {
      if (cc.type === "node") return;
      const st = KIND_STYLE[cc.type];
      const img = IMG[st.tile];
      if (img) c.drawImage(img, cc.x * U - S, cc.y * U - S, S * 2, S * 2);
      else { c.fillStyle = st.c; c.fillRect(cc.x * U - S, cc.y * U - S, S * 2, S * 2); }
    });

    // 広場＋スタート星＋地名
    for (const k in g.board.nodePos) {
      const node = country.nodes[k];
      const pos = g.board.nodePos[k];
      const isCity = node.kind === "city";
      const R = (isCity ? 1.08 : 1.2) * U;
      const plaza = IMG[PLAZA_BY_GROUP[node.group] || "plaza_city"];
      if (plaza) c.drawImage(plaza, pos.x * U - R, pos.y * U - R, R * 2, R * 2);
      else { c.fillStyle = "#b0314f"; c.beginPath(); c.arc(pos.x * U, pos.y * U, R, 0, 7); c.fill(); }
      if (node.isStart) {
        c.font = `${0.7 * U}px serif`; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("★", pos.x * U, pos.y * U - R - 0.42 * U);
      }
      c.font = `bold ${0.78 * U}px sans-serif`;
      c.fillStyle = isCity ? "#4a5560" : "#3a2a22";
      c.strokeStyle = "rgba(255,255,255,.95)"; c.lineWidth = 0.4 * U;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.strokeText(node.name, pos.x * U, pos.y * U + R + 0.6 * U);
      c.fillText(node.name, pos.x * U, pos.y * U + R + 0.6 * U);
    }

    // 装飾（接地影つき・yソート済み）
    decor.forEach(d => {
      const w = d.w * U, h = d.h * U;
      c.fillStyle = "rgba(0,0,0,.14)";
      c.beginPath(); c.ellipse(d.x * U, d.y * U, w * 0.34, w * 0.10, 0, 0, 7); c.fill();
      c.drawImage(d.img, d.x * U - w / 2, d.y * U - h, w, h);
    });

    // 海域名
    c.fillStyle = "rgba(255,255,255,.75)"; c.font = `italic ${1.1 * U}px sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    (geo.seaLabels || []).forEach(sl => {
      const [lx, ly] = country.proj.ll2logic(sl.lat, sl.lon);
      if (sl.vertical) { c.save(); c.translate(lx * U, ly * U); c.rotate(-Math.PI / 2); c.fillText(sl.name, 0, 0); c.restore(); }
      else c.fillText(sl.name, lx * U, ly * U);
    });
  }

  /* 毎フレーム：海の背景＋世界1枚＋動的オーバーレイ */
  function drawWorld() {
    if (!seaPat && IMG.sea) {
      const t = document.createElement("canvas"); t.width = t.height = 220;
      t.getContext("2d").drawImage(IMG.sea, 0, 0, 220, 220);
      seaPat = ctx.createPattern(t, "repeat");
    }
    ctx.fillStyle = seaPat || "#7fc4e8";
    ctx.fillRect(0, 0, W, H);
    if (!worldCanvas) return;
    const [ox, oy] = P(0, 0); const s = BASE() * cam.zoom * (100 / WORLD_RES);
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.translate(ox, oy); ctx.scale(s, s); ctx.drawImage(worldCanvas, 0, 0); ctx.restore();
  }

  /* 動的：注目産地の輪・所有リング・分岐ハイライト */
  function drawDynamicNodes() {
    const s = BASE() * cam.zoom;
    // 分岐候補のハイライト（道中マス）
    if (uiState.awaitingPick) {
      const S = 0.62 * s;
      const pulse = (2 + Math.sin(performance.now() / 200) * 2) * s * 0.06;
      uiState.pickOptions.forEach(id => {
        const cc = g.board.cells[id];
        if (cc.type === "node") return;
        const [x, y] = P(cc.x, cc.y);
        ctx.strokeStyle = "#7a1f3d"; ctx.lineWidth = 0.25 * s;
        ctx.strokeRect(x - S - 2 - pulse, y - S - 2 - pulse, (S + 2 + pulse) * 2, (S + 2 + pulse) * 2);
      });
    }
    for (const k in g.board.nodePos) {
      const node = country.nodes[k];
      const pos = g.board.nodePos[k];
      const [x, y] = P(pos.x, pos.y);
      const id = g.board.nodeCellId[k];
      const isCity = node.kind === "city";
      const R = (isCity ? 1.08 : 1.2) * s;
      if (k === g.spotlight.region && g.spotlight.wonBy === null) {
        const pulse = (Math.sin(performance.now() / 300) + 1) / 2;
        ctx.strokeStyle = `rgba(227,178,60,${0.4 + pulse * 0.5})`;
        ctx.lineWidth = (0.35 + pulse * 0.25) * s;
        ctx.beginPath(); ctx.arc(x, y, R + (0.5 + pulse * 0.5) * s, 0, 7); ctx.stroke();
        ctx.font = `${1.4 * s}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const starY = y - R - (1 + pulse * 0.4) * s;
        ctx.fillText("⭐", x, starY);
        ctx.font = `bold 0.75px sans-serif`.replace("0.75", (0.75 * s).toFixed(1));
        ctx.fillStyle = "#b8860b"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
        ctx.strokeText("注目産地", x, starY - s);
        ctx.fillText("注目産地", x, starY - s);
      }
      const ownIdx = g.owned[k];
      if (ownIdx !== undefined && ownIdx !== null && avatars[ownIdx]) {
        ctx.strokeStyle = avatars[ownIdx].ch.color; ctx.lineWidth = 0.2 * s;
        ctx.beginPath(); ctx.arc(x, y, R + 0.16 * s, 0, 7); ctx.stroke();
        ctx.fillStyle = avatars[ownIdx].ch.color;
        ctx.beginPath(); ctx.arc(x + R * 0.72, y - R * 0.72, 0.28 * s, 0, 7); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.09 * s; ctx.stroke();
      }
      if (uiState.awaitingPick && uiState.pickOptions.includes(id)) {
        ctx.strokeStyle = "#7a1f3d"; ctx.lineWidth = 0.3 * s;
        const pulse = (2 + Math.sin(performance.now() / 200) * 2) * s * 0.06;
        ctx.beginPath(); ctx.arc(x, y, R + 0.35 * s + pulse, 0, 7); ctx.stroke();
      }
    }
  }

  /* ===== 分岐の近道矢印 ===== */
  function drawSpotlightArrow() {
    if (!uiState.awaitingPick) return;
    const best = bestPickToward(g, uiState.pickOptions);
    if (!best) return;
    const c = g.board.cells[best];
    const p = g.players[g.cur];
    const from = g.board.cells[p.posCell];
    if (!from) return;
    const z = cam.zoom;
    const [fx, fy] = P(from.x, from.y);
    const [bx, by] = P(c.x, c.y);
    let dx = bx - fx, dy = by - fy;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const pulse = (Math.sin(performance.now() / 500) + 1) / 2;
    const L = 10 * z, Wd = 6 * z;
    const tipx = bx + dx * L * 0.6, tipy = by + dy * L * 0.6;
    const backx = bx - dx * L * 0.4, backy = by - dy * L * 0.4;
    const px = -dy, py = dx;
    ctx.save(); ctx.lineJoin = "round";
    ctx.globalAlpha = 0.55 + pulse * 0.25;
    ctx.fillStyle = "#e3b23c";
    const hbX = tipx - (tipx - backx) * 0.5, hbY = tipy - (tipy - backy) * 0.5;
    const sw = Wd * 0.4;
    ctx.beginPath();
    ctx.moveTo(tipx, tipy);
    ctx.lineTo(hbX + px * Wd * 0.5, hbY + py * Wd * 0.5);
    ctx.lineTo(hbX + px * sw * 0.5, hbY + py * sw * 0.5);
    ctx.lineTo(backx + px * sw * 0.5, backy + py * sw * 0.5);
    ctx.lineTo(backx - px * sw * 0.5, backy - py * sw * 0.5);
    ctx.lineTo(hbX - px * sw * 0.5, hbY - py * sw * 0.5);
    ctx.lineTo(hbX - px * Wd * 0.5, hbY - py * Wd * 0.5);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ===== 季節の色（シーズン＝ヴィンテージ年と連動して画面の色味が巡る） =====
     soft-light合成で世界全体をほんのり色づけ。シーズン切替時は1.2秒かけてクロスフェード */
  const SEASONS = [
    { tint: "rgba(255,182,210,1)", a: 0.10, wash: "rgba(210,255,205,1)", wa: 0.05 }, // 春：桜色
    { tint: "rgba(255,214,110,1)", a: 0.12, wash: "rgba(120,200,255,1)", wa: 0.04 }, // 夏：陽射し
    { tint: "rgba(235,140,60,1)",  a: 0.16, wash: "rgba(180,90,40,1)",   wa: 0.05 }, // 秋：黄葉
    { tint: "rgba(140,170,235,1)", a: 0.17, wash: "rgba(240,248,255,1)", wa: 0.08 }, // 冬：青白い光
  ];
  let tintSeason = -1, tintFade0 = 0;
  function drawSeasonTint() {
    const idx = ((g.season || 1) - 1) % 4;
    const now = performance.now();
    if (idx !== tintSeason) { tintSeason = idx; tintFade0 = now; }
    const fade = Math.min(1, (now - tintFade0) / 1200);
    const s = SEASONS[idx];
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = s.a * 3.2 * fade;
    ctx.fillStyle = s.tint;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = s.wa * fade;
    ctx.fillStyle = s.wash;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ===== 土埃パーティクル（着地時） ===== */
  let dust = []; // {x,y,vx,vy,born,size} 論理座標
  function spawnDust(lx, ly) {
    const now = performance.now();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + Math.random() * Math.PI; // 左右へ広がる
      dust.push({
        x: lx, y: ly,
        vx: Math.cos(a) * (0.6 + Math.random() * 0.9),
        vy: -0.25 - Math.random() * 0.35,
        born: now, size: 0.28 + Math.random() * 0.22,
      });
    }
  }
  function drawDust() {
    if (!dust.length) return;
    const now = performance.now(), s = BASE() * cam.zoom;
    dust = dust.filter(d => now - d.born < 450);
    dust.forEach(d => {
      const t = (now - d.born) / 450;
      const [x, y] = P(d.x + d.vx * t * 2.2, d.y + d.vy * t * 2.2 + t * t * 0.9);
      ctx.fillStyle = `rgba(214,196,160,${0.55 * (1 - t)})`;
      ctx.beginPath(); ctx.arc(x, y, d.size * s * (0.7 + t * 0.8), 0, 7); ctx.fill();
    });
  }

  /* ===== 吹き出しリアクション（あつ森の頭上リアクション風） ===== */
  function bubble(playerIdx, text) {
    const av = avatars[playerIdx]; if (!av) return;
    av.el.querySelectorAll(".sayBubble").forEach(b => b.remove());
    const b = document.createElement("div");
    b.className = "sayBubble"; b.textContent = text;
    av.el.appendChild(b);
    setTimeout(() => b.remove(), 2000);
  }

  /* ===== プレイヤー ===== */
  const HOP_MS = 290, LAND_MS = 140;
  function drawAllPlayers() {
    const z = cam.zoom;
    const now = performance.now();
    criticFollow = null;
    g.players.forEach((p, i) => {
      const av = avatars[i]; if (!av) return;
      const c = g.board.cells[p.posCell];
      av.dlx += (c.x - av.dlx) * 0.18; av.dly += (c.y - av.dly) * 0.18;
      const [sx, sy] = P(av.dlx, av.dly);
      const isCur = i === g.cur;

      /* マスが変わったら1回ぴょんと跳ぶ（NPC含む全員） */
      if (av.lastCell === undefined) av.lastCell = p.posCell;
      if (p.posCell !== av.lastCell) {
        av.lastCell = p.posCell;
        av.hop0 = now;
        sfx.hop();
      }
      let hopY = 0, sqx = 1, sqy = 1;
      if (av.hop0) {
        const t = (now - av.hop0) / HOP_MS;
        if (t < 1) {
          const arc = Math.sin(t * Math.PI);
          hopY = arc * 8 * z * 0.5;
          sqy = 1 + 0.10 * arc; sqx = 1 - 0.07 * arc; // 空中で縦に伸びる
        } else if (t < 1 + LAND_MS / HOP_MS) {
          if (!av.landed) { av.landed = true; spawnDust(av.dlx, av.dly + 0.35); sfx.land(); }
          const lt = (t - 1) / (LAND_MS / HOP_MS);
          sqy = 0.86 + 0.14 * lt; sqx = 1.12 - 0.12 * lt; // 着地でむにっと潰れて戻る
        } else { av.hop0 = 0; av.landed = false; }
      }

      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(sx, sy + 5 * z, (6.5 - hopY * 0.18) * z, 2.4 * z, 0, 0, 7); ctx.fill();
      const img = av.el.querySelector("img");
      const s = BASE() * cam.zoom;
      if (img) { img.style.height = (3.5 * s) + "px"; img.style.width = "auto"; }
      av.el.style.left = sx + "px";
      av.el.style.top = (sy + 4.5 * z - hopY) + "px";
      av.el.style.transform = `translate(-50%,-100%) scale(${sqx.toFixed(3)},${sqy.toFixed(3)})`;
      av.el.style.transformOrigin = "50% 100%";
      av.el.style.zIndex = isCur ? 20 : 10;
      av.el.style.opacity = isCur ? 1 : 0.92;
      av.el.style.filter = isCur ? "drop-shadow(0 0 4px rgba(227,178,60,.9))" : "none";
      if (i === g.critic.on) criticFollow = { x: sx, y: sy, z };
    });
    if (criticSpriteEl) {
      if (g.critic.on !== null && criticFollow) {
        const t = performance.now() / 400;
        const ox = (-18 + Math.sin(t) * 4) * criticFollow.z * 0.5;
        const oy = (-10 + Math.cos(t * 1.3) * 4) * criticFollow.z * 0.5;
        criticSpriteEl.style.display = "block";
        criticSpriteEl.style.left = (criticFollow.x + ox) + "px";
        criticSpriteEl.style.top = (criticFollow.y + oy) + "px";
        criticSpriteEl.style.transform = `translate(-50%,-100%) scale(${criticFollow.z / 2.2})`;
        criticSpriteEl.style.zIndex = 25;
      } else criticSpriteEl.style.display = "none";
    }
  }

  /* ===== カメラ・リサイズ・入力（v1と同じ操作系） ===== */
  function resize() {
    W = gameEl.clientWidth; H = gameEl.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function updateCamera() {
    if (!overview && !userPanned) {
      const av = avatars[g.cur];
      if (av) { cam.tx = av.dlx + panX; cam.ty = av.dly + panY; }
      cam.tzoom = CLOSE_ZOOM;
    } else if (overview && !userPanned) {
      cam.tx = cx0 + panX; cam.ty = cy0 + panY;
    }
    cam.x += (cam.tx - cam.x) * 0.18;
    cam.y += (cam.ty - cam.y) * 0.18;
    cam.zbase += (cam.tzoom - cam.zbase) * 0.12;
    cam.zoom = cam.zbase * cameraFx(performance.now());
  }
  function setOverview(on) {
    overview = on; userPanned = false; panX = 0; panY = 0;
    if (on) { cam.tx = cx0; cam.ty = cy0; cam.tzoom = OVER_ZOOM; }
    else cam.tzoom = CLOSE_ZOOM;
  }
  function recenter() { userPanned = false; panX = 0; panY = 0; }

  /* 旅の振り返り：訪れた土地を順にカメラで巡ってから cb を呼ぶ（エンディング前の余韻） */
  function flyover(nodeKeys, cb) {
    const pts = (nodeKeys || []).map(k => g.board.nodePos[k]).filter(Boolean).slice(0, 10);
    if (!pts.length) { if (cb) cb(); return; }
    userPanned = true;
    cam.tzoom = 1.7;
    let i = 0;
    const step = () => {
      if (i >= pts.length) {
        userPanned = false; panX = 0; panY = 0; cam.tzoom = CLOSE_ZOOM;
        if (cb) cb();
        return;
      }
      cam.tx = pts[i].x; cam.ty = pts[i].y; i++;
      setTimeout(step, 820);
    };
    step();
  }

  let dragging = false, dragMoved = false, dragStart = { x: 0, y: 0 }, camStart = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", ev => {
    dragging = true; dragMoved = false;
    dragStart = { x: ev.clientX, y: ev.clientY }; camStart = { x: cam.x, y: cam.y };
    canvas.setPointerCapture(ev.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", ev => {
    if (!dragging) return;
    const dx = ev.clientX - dragStart.x, dy = ev.clientY - dragStart.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
    if (dragMoved) {
      userPanned = true;
      const s = BASE() * cam.zoom;
      cam.x = camStart.x - dx / s; cam.y = camStart.y - dy / s;
      cam.tx = cam.x; cam.ty = cam.y;
    }
  });
  canvas.addEventListener("pointerup", ev => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = "grab";
    if (!dragMoved && uiState.awaitingPick) {
      const r = canvas.getBoundingClientRect();
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;
      const hit = 16 * cam.zoom;
      for (const id of uiState.pickOptions) {
        const c = g.board.cells[id];
        const [x, y] = P(c.x, c.y);
        if (Math.hypot(mx - x, my - y) < hit) { uiState.onPick(id); return; }
      }
    }
  });
  canvas.style.cursor = "grab";
  window.addEventListener("keydown", ev => {
    if (!uiState.awaitingPick || !uiState.pickOptions.length) return;
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (!dirs[ev.key]) return;
    ev.preventDefault();
    const from = g.board.cells[g.players[g.cur].posCell];
    const [d0, d1] = dirs[ev.key];
    let best = null, bestScore = -Infinity;
    for (const id of uiState.pickOptions) {
      const c = g.board.cells[id];
      const vx = c.x - from.x, vy = c.y - from.y;
      const len = Math.hypot(vx, vy) || 1;
      const score = (vx / len) * d0 + (vy / len) * d1;
      if (score > bestScore) { bestScore = score; best = id; }
    }
    if (best !== null) uiState.onPick(best);
  });

  let lastTs = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - lastTs < 31) return; // 約30fpsに制限（低スペック機対応）
    lastTs = ts;
    updateCamera();
    drawWorld(); drawSeasonTint(); drawDynamicNodes(); drawSpotlightArrow(); drawDust(); drawAllPlayers();
  }

  return { resize, buildAvatars, setOverview, recenter, ready, avatars, bubble, punch, shake, flyover, start: () => { resize(); requestAnimationFrame(loop); } };
}
