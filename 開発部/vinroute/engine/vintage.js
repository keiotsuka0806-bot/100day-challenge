/* ヴィンテージ（天候）・注目産地・パーカーポイント（評価） */
import { CONFIG } from "./config.js";

export function seasonYear(g) { return CONFIG.baseYear + g.season; }

/* シーズン頭の天候抽選：当たり年＝注目産地。次の当たり年も先に抽選（予知カード用） */
export function rollVintage(g) {
  const ks = g.country.regionKeys;
  g.vintage.great = g.vintage.nextGreat || ks[Math.floor(g.rand() * ks.length)];
  let guard = 0;
  do { g.vintage.poor = ks[Math.floor(g.rand() * ks.length)]; guard++; }
  while (g.vintage.poor === g.vintage.great && guard < 20);
  g.vintage.nextGreat = ks[Math.floor(g.rand() * ks.length)];
  g.spotlight.region = g.vintage.great;
  g.spotlight.wonBy = null;
}

export function vintageMultiplier(g, k) {
  if (k === g.vintage.great) return CONFIG.vintageMult.great;
  if (k === g.vintage.poor) return CONFIG.vintageMult.poor;
  return 1;
}

/* 大物評論家：各シーズン一定確率で来訪（評価の振れが大きくなる） */
export function maybeBigCritic(g) {
  g.critic.big = g.rand() < CONFIG.bigCriticChance;
  return g.critic.big;
}

/* ワイナリー評価（60-100）：条件＋運。設計書§5.9の式そのまま */
export function computeRating(g, p, k, a) {
  const R = CONFIG.rating;
  let score = R.base;
  if (k === g.vintage.great) score += R.great;
  if (k === g.vintage.poor) score += R.poor;
  if (a.vineyard) score += R.vineyard;
  if (a.vineyard && a.winery_std && a.winery_prem) score += R.monopoly;
  score += Math.floor(g.rand() * (R.jitter * 2 + 1)) - R.jitter;
  if (g.critic.big) score += Math.floor(g.rand() * (R.bigCriticJitter * 2 + 1)) - R.bigCriticJitter;
  return Math.max(R.min, Math.min(R.max, score));
}

/* 評価→価値倍率（90点=等倍・100点=1.2倍） */
export function ratingToMult(rating) { return 1 + (rating - 90) * 0.02; }

/* 評価→試飲料倍率 */
export function ratingFeeMult(rating) {
  return rating >= 95 ? 1.5 : rating >= 85 ? 1.2 : rating >= 75 ? 1.0 : 0.7;
}
