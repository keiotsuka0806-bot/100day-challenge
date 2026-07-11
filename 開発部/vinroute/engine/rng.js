/* seed制御の決定的乱数（LCG）。同じseed→同じ列。盤面生成・リプレイ用 */
export function makeRng(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/* 重み付き抽選：items[i].w（省略時1）に比例して選ぶ */
export function weightedPick(items, rnd = Math.random) {
  let total = 0;
  for (const it of items) total += it.w || 1;
  let r = rnd() * total;
  for (const it of items) {
    r -= it.w || 1;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
