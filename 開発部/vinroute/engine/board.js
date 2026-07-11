/* 盤面生成（国非依存）：投影→配置→ルート→メッシュ→接続保証→マス種配布
   プロトタイプ検証済みのアルゴリズムを移植。乱数は seed 制御（同じ国データ＋seed→同じ盤面） */
import { makeRng } from "./rng.js";
import { CONFIG } from "./config.js";

/* 道中マスの種類（色や演出はUI側） */
export const CELL_KINDS = ["card", "criticHit", "quiz", "market", "slot", "fund"];

export function buildBoard(country, opts = {}) {
  const seed = opts.seed ?? 7;
  const GRID = opts.grid ?? CONFIG.board.grid;
  const cells = {};
  const cellArr = [];
  const rnd = makeRng(seed);

  const snap = v => Math.round(v / GRID) * GRID;
  const gridKey = (gx, gy) => `G_${Math.round(gx / GRID)}_${Math.round(gy / GRID)}`;
  function makeCell(id, x, y, type, payload) {
    const c = { id, x, y, type, payload, next: [] };
    cells[id] = c; cellArr.push(c); return c;
  }
  function connect(a, b) {
    if (!a || !b || a === b) return;
    if (!a.next.includes(b.id)) a.next.push(b.id);
    if (!b.next.includes(a.id)) b.next.push(a.id);
  }
  function disconnect(a, b) {
    a.next = a.next.filter(x => x !== b.id);
    b.next = b.next.filter(x => x !== a.id);
  }
  function stillConnected(a, b) {
    const seen = { [a.id]: 1 }; const q = [a.id];
    while (q.length) {
      const id = q.shift();
      if (id === b.id) return true;
      for (const n of cells[id].next) if (!seen[n]) { seen[n] = 1; q.push(n); }
    }
    return false;
  }

  /* 1. 産地・都市をグリッドスナップ配置（重なり回避） */
  const nodeCellId = {};
  const occupied = new Set();
  const nodePos = {}; // key -> スナップ後座標（描画用に返す）
  for (const k in country.nodes) {
    const n = country.nodes[k];
    let gx = snap(n.x), gy = snap(n.y), tries = 0;
    while (occupied.has(gridKey(gx, gy)) && tries < 8) { gx += GRID; tries++; }
    occupied.add(gridKey(gx, gy));
    const id = "R_" + k;
    makeCell(id, gx, gy, "node", k);
    nodeCellId[k] = id;
    nodePos[k] = { x: gx, y: gy };
  }

  const gridCells = {};
  for (const k in nodeCellId) {
    const c = cells[nodeCellId[k]];
    gridCells[gridKey(c.x, c.y)] = c.id;
  }
  function getOrMakeGridCell(gx, gy) {
    const key = gridKey(gx, gy);
    if (gridCells[key]) return gridCells[key];
    const kind = CELL_KINDS[Math.floor(rnd() * CELL_KINDS.length)];
    const id = `C_${Math.round(gx / GRID)}_${Math.round(gy / GRID)}`;
    makeCell(id, gx, gy, kind);
    gridCells[key] = id;
    return id;
  }

  /* 2. links を階段状ルートで接続（曲がりが交差点＝分岐を生む） */
  function routeStaircase(ax, ay, bx, by) {
    let gx = Math.round(ax / GRID), gy = Math.round(ay / GRID);
    const gbx = Math.round(bx / GRID), gby = Math.round(by / GRID);
    const ids = [getOrMakeGridCell(gx * GRID, gy * GRID)];
    let guard = 0;
    while ((gx !== gbx || gy !== gby) && guard++ < 200) {
      const dx = gbx - gx, dy = gby - gy;
      let moveX;
      if (dx === 0) moveX = false; else if (dy === 0) moveX = true; else moveX = rnd() < 0.5;
      if (moveX) gx += Math.sign(dx); else gy += Math.sign(dy);
      ids.push(getOrMakeGridCell(gx * GRID, gy * GRID));
    }
    for (let i = 0; i < ids.length - 1; i++) {
      if (ids[i] !== ids[i + 1]) connect(cells[ids[i]], cells[ids[i + 1]]);
    }
  }
  country.links.forEach(lk => {
    const A = cells[nodeCellId[lk.a]], B = cells[nodeCellId[lk.b]];
    routeStaircase(A.x, A.y, B.x, B.y);
  });

  /* 3. メッシュ化：控えめな基本網 → 一本道に分岐追加 → 過剰分岐の間引き */
  const meshRnd = makeRng(seed * 4 + 3);
  const keys = Object.keys(gridCells);
  // パス1：基本の網（控えめ）
  keys.forEach(key => {
    const c = cells[gridCells[key]];
    const gx = Math.round(c.x / GRID), gy = Math.round(c.y / GRID);
    [[1, 0], [0, 1]].forEach(d => {
      const nk = `G_${gx + d[0]}_${gy + d[1]}`;
      if (gridCells[nk] && meshRnd() < CONFIG.board.meshBaseProb) connect(c, cells[gridCells[nk]]);
    });
  });
  // パス2：分岐が少ない所（一本道）だけに分岐を1つ足す
  keys.forEach(key => {
    const c = cells[gridCells[key]];
    if (c.next.length >= 3) return;
    if (c.next.length === 2 && meshRnd() < 0.5) return;
    const gx = Math.round(c.x / GRID), gy = Math.round(c.y / GRID);
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (c.next.length >= 3) break;
      const nid = gridCells[`G_${gx + d[0]}_${gy + d[1]}`];
      if (nid && !c.next.includes(nid) && cells[nid].next.length < 3) {
        if (meshRnd() < 0.5) connect(c, cells[nid]);
      }
    }
  });
  // パス3：4方向以上の過剰分岐を、連結を壊さない範囲で間引く
  cellArr.forEach(c => {
    while (c.next.length >= CONFIG.board.maxBranch) {
      let removed = false;
      const cand = c.next.slice().sort(() => meshRnd() - 0.5);
      for (const nid of cand) {
        const n = cells[nid];
        if (n.next.length <= 2) continue;
        if (c.type === "node" || n.type === "node") continue;
        disconnect(c, n);
        if (stillConnected(c, n)) { removed = true; break; }
        connect(c, n);
      }
      if (!removed) break;
    }
  });

  /* 4. 接続保証：全産地・都市を最低2方向、全マス到達可能に */
  const MIN = CONFIG.board.minNodeLinks;
  for (const k in nodeCellId) {
    const c = cells[nodeCellId[k]];
    let guard = 0;
    while (c.next.length < MIN && guard++ < 12) {
      let best = null, bd = Infinity;
      cellArr.forEach(o => {
        if (o.id === c.id || c.next.includes(o.id)) return;
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d < bd) { bd = d; best = o; }
      });
      if (!best) break;
      connect(c, best);
    }
  }
  // 道中マスの行き止まり（next=1）も最寄りにつなぐ
  cellArr.forEach(c => {
    let guard = 0;
    while (c.next.length < 2 && guard++ < 6) {
      let best = null, bd = Infinity;
      cellArr.forEach(o => {
        if (o.id === c.id || c.next.includes(o.id)) return;
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d < bd) { bd = d; best = o; }
      });
      if (!best) break;
      connect(c, best);
    }
  });
  // 孤立成分の解消：開始地点の成分に最も近いペアでつなぐ
  const startId = nodeCellId[country.startKey];
  let comp = reachableFrom(cells, startId);
  let guard = 0;
  while (comp.size < cellArr.length && guard++ < 50) {
    let bestA = null, bestB = null, bd = Infinity;
    cellArr.forEach(o => {
      if (comp.has(o.id)) return;
      cellArr.forEach(i => {
        if (!comp.has(i.id)) return;
        const d = Math.hypot(o.x - i.x, o.y - i.y);
        if (d < bd) { bd = d; bestA = i; bestB = o; }
      });
    });
    if (!bestA) break;
    connect(bestA, bestB);
    comp = reachableFrom(cells, startId);
  }

  return { cells, cellArr, nodeCellId, nodePos, startCellId: startId, seed, grid: GRID };
}

function reachableFrom(cells, startId) {
  const seen = new Set([startId]); const q = [startId];
  while (q.length) {
    const id = q.shift();
    for (const n of cells[id].next) if (!seen.has(n)) { seen.add(n); q.push(n); }
  }
  return seen;
}

/* BFS最短距離：fromId から全マスへ */
export function bfsDistances(board, fromId) {
  const dist = { [fromId]: 0 }; const q = [fromId];
  while (q.length) {
    const id = q.shift();
    for (const n of board.cells[id].next) {
      if (dist[n] === undefined) { dist[n] = dist[id] + 1; q.push(n); }
    }
  }
  return dist;
}

/* 検証（ビルド時に必ず自動チェック）：
   1. 全マス到達可能  2. 全産地・都市の接続≥2（行き止まり0）  3. 密度バランス（3分割帯） */
export function validateBoard(board, country) {
  const errors = [];
  const reach = reachableFrom(board.cells, board.startCellId);
  const unreachable = board.cellArr.filter(c => !reach.has(c.id));
  if (unreachable.length) errors.push(`到達不能マス ${unreachable.length} 件`);

  for (const k in board.nodeCellId) {
    const c = board.cells[board.nodeCellId[k]];
    if (c.next.length < CONFIG.board.minNodeLinks)
      errors.push(`ノード ${k} の接続が ${c.next.length}（最低${CONFIG.board.minNodeLinks}）`);
  }
  const deadEnds = board.cellArr.filter(c => c.next.length < 2);
  if (deadEnds.length) errors.push(`行き止まりマス ${deadEnds.length} 件`);

  // 密度バランス：マスのy範囲を3帯に分割し、マス数と分岐数の偏りを見る
  const ys = board.cellArr.map(c => c.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const bandOf = y => Math.min(2, Math.floor(((y - minY) / (maxY - minY + 1e-9)) * 3));
  const counts = [0, 0, 0], branches = [0, 0, 0];
  board.cellArr.forEach(c => {
    const b = bandOf(c.y);
    counts[b]++;
    if (c.next.length >= 3) branches[b]++;
  });
  const ratio = Math.max(...counts) / Math.max(1, Math.min(...counts));
  if (ratio > 3.0) errors.push(`密度バランス：帯ごとのマス数 ${counts.join("/")}（比 ${ratio.toFixed(2)} > 3.0）`);

  return { ok: errors.length === 0, errors, stats: { cellCount: board.cellArr.length, counts, branches, ratio } };
}
