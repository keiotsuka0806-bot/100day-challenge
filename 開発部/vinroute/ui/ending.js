/* エンディング（設計書§11）：内訳→特別賞→順位→優勝者→共有カード
   ＋戦績保存（localStorage）：順位・内訳・日時 */
import { CONFIG } from "../engine/config.js";
import { seasonYear } from "../engine/state.js";

const STORE_KEY = "vinroute_records_v1";

export function loadRecords() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
export function saveRecord(g, ranked) {
  const rec = {
    date: new Date().toISOString(),
    country: g.country.id,
    seasons: CONFIG.totalSeasons,
    results: ranked.map((e, i) => ({
      rank: i + 1, name: e.p.pname, isNpc: e.p.isNpc, total: e.total,
      wines: e.p.wines.length,
      breakdown: {
        premV: e.breakdown.premV, stdV: e.breakdown.stdV, money: e.breakdown.money,
        assetWorth: e.breakdown.assetWorth, bonusTotal: e.breakdown.bonusTotal, parker: e.breakdown.parker,
      },
    })),
  };
  const list = loadRecords();
  list.unshift(rec);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 50))); } catch {}
  return rec;
}

export function showEnding(g, ranked, dom) {
  saveRecord(g, ranked);
  const modal = dom.resultModal;
  modal.style.display = "flex";
  modal.innerHTML = `<div class="edStage" id="edStage"><div class="edFade">${seasonYear(g)}年 —— 長い旅が終わった。</div></div>`;
  setTimeout(() => phaseBreakdown(g, ranked, modal), 3400);
}

function nodeName(g, k) { return g.country.nodes[k]?.name || k; }

function phaseBreakdown(g, ranked, modal) {
  const stage = modal.querySelector("#edStage");
  if (!stage) { phaseAwards(g, ranked, modal); return; }
  const order = [...ranked].reverse(); // 順位が下の人から
  let rows = "";
  order.forEach(e => {
    const b = e.breakdown, bl = b.bl;
    let bonusLines = "";
    const bonusItem = (label, v) => { if (v > 0) bonusLines += `<div class="edbRow sub"><span>${label}</span><span>+${v}</span></div>`; };
    bonusItem("🍷 タイプコレクション", bl.typeColl);
    bonusItem("🗺 産地コレクション", bl.regionColl);
    bonusItem("📅 ヴィンテージコレクション", bl.vintageColl);
    bonusItem("🗺 地理セット（畑制覇）", bl.geoSet);
    bonusItem("👑 独占", bl.monopoly);
    bonusItem("⭐ 注目産地一番乗り", bl.spotlight);
    const parkerLine = b.parker !== 0 ? `<div class="edbRow sub"><span>🎩 パーカーポイント影響</span><span>${b.parker > 0 ? "+" : ""}${b.parker}</span></div>` : "";
    rows += `<div class="edbCard">
      <div class="edbName">${e.p.pname}<span class="edbTotal">総資産 ${b.total}</span></div>
      <div class="edbRow"><span>⭐ プレミアムワイン価値（${b.premN}本）</span><span>${b.premV}</span></div>
      <div class="edbRow"><span>🍷 量産ワイン価値（${b.stdN}本）</span><span>${b.stdV}</span></div>
      ${parkerLine}
      <div class="edbRow"><span>💰 資金</span><span>${b.money}</span></div>
      <div class="edbRow"><span>🏛 資産（畑・醸造所・ワイナリー）</span><span>${b.assetWorth}</span></div>
      <div class="edbRow"><span>🧳 旅した土地</span><span>${(e.p.visitedNodes || []).length}ヶ所</span></div>
      <div class="edbRowHead">— コレクション／ボーナス内訳 —</div>
      ${bonusLines || '<div class="edbRow sub"><span>（ボーナスなし）</span><span>0</span></div>'}
    </div>`;
  });
  stage.innerHTML = `<div class="edScroll" id="edScroll">
    <div class="edBigTitle">📖 それぞれの醸造家の記録</div>
    <div class="edSection">資産の内訳</div>
    ${rows}
  </div>`;
  const sc = stage.querySelector("#edScroll");
  const dur = Math.max(42, order.length * 15);
  if (sc) sc.style.animation = `edRoll ${dur}s linear forwards`;
  setTimeout(() => phaseAwards(g, ranked, modal), dur * 1000 * 0.8);
}

function phaseAwards(g, ranked, modal) {
  const stage = modal.querySelector("#edStage");
  if (!stage) { phaseWinner(g, ranked, modal); return; }
  const mostWines = [...ranked].sort((a, b) => b.p.wines.length - a.p.wines.length)[0];
  const richest = [...ranked].sort((a, b) => b.p.money - a.p.money)[0];
  const bestParker = [...ranked].sort((a, b) => (b.p.parkerDelta || 0) - (a.p.parkerDelta || 0))[0];
  const bestWine = (() => {
    let best = null, bp = null;
    ranked.forEach(e => e.p.wines.forEach(w => { if (!best || w.value > best.value) { best = w; bp = e.p; } }));
    return { w: best, p: bp };
  })();
  let awards = "";
  awards += `<div class="edAward"><span>🍷 最多コレクション賞</span><b>${mostWines.p.pname}</b>（${mostWines.p.wines.length}本）</div>`;
  awards += `<div class="edAward"><span>💰 大富豪賞</span><b>${richest.p.pname}</b>（資金${richest.p.money}）</div>`;
  const traveler = [...ranked].sort((a, b) => (b.p.visitedNodes || []).length - (a.p.visitedNodes || []).length)[0];
  if ((traveler.p.visitedNodes || []).length > 0) awards += `<div class="edAward"><span>🧳 旅人賞</span><b>${traveler.p.pname}</b>（${traveler.p.visitedNodes.length}の土地を巡った）</div>`;
  if ((bestParker.p.parkerDelta || 0) > 0) awards += `<div class="edAward"><span>🎩 パーカーの寵児賞</span><b>${bestParker.p.pname}</b>（評価で+${Math.round(bestParker.p.parkerDelta)}）</div>`;
  if (bestWine.w) {
    const bw = bestWine.w;
    const nm = bw.type === "prem" ? `${bw.vintage}年 ${nodeName(g, bw.region)}` : `${nodeName(g, bw.region)} 量産`;
    awards += `<div class="edAward"><span>⭐ 最高の一本賞</span><b>${bestWine.p.pname}</b>（${nm}・価値${bw.value}）</div>`;
  }
  stage.innerHTML = `<div class="edScroll" id="edScroll2">
    <div class="edBigTitle">🏅 特別賞</div>
    ${awards}
  </div>`;
  const sc = stage.querySelector("#edScroll2");
  if (sc) sc.style.animation = "edRoll 24s linear forwards";
  setTimeout(() => phaseWinner(g, ranked, modal), 17000);
}

function phaseWinner(g, ranked, modal) {
  const stage = modal.querySelector("#edStage");
  if (!stage) return;
  let rankRows = "";
  ranked.forEach((e, i) => {
    rankRows += `<div class="edRankRow ${i === 0 ? "win" : ""}"><span class="edRk">${i + 1}位</span><span class="edNm">${e.p.pname}</span><span class="edTot">総資産 ${e.total}</span></div>`;
  });
  stage.innerHTML = `<div class="edResults"><div class="edBigTitle">最終順位</div>${rankRows}</div>`;
  setTimeout(() => {
    const w = ranked[0];
    let others = "";
    ranked.forEach((e, i) => {
      const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}位`;
      others += `<div class="edFinalRow ${i === 0 ? "win" : ""}"><span class="efMedal">${medal}</span><span class="efName">${e.p.pname}</span><span class="efTot">総資産 ${e.total}</span></div>`;
    });
    stage.innerHTML = `<div class="edSpot">
      <div class="edCrown">👑</div>
      <div class="edWinLabel">総合優勝</div>
      <div class="edWinName">${w.p.pname}</div>
      <div class="edWinAssets">総資産 <b>${w.total}</b></div>
      <div class="edFinalList">${others}</div>
      <div class="edBtns">
        <button class="rsClose" id="edShareBtn">📸 結果を保存・共有</button>
        <button class="rsClose alt" onclick="location.reload()">もう一度遊ぶ</button>
      </div>
    </div>`;
    const sb = stage.querySelector("#edShareBtn");
    if (sb) sb.onclick = () => showShareCard(g, ranked, stage);
  }, 4200);
}

function showShareCard(g, ranked, stage) {
  const w = ranked[0];
  let rows = "";
  ranked.forEach((e, i) => {
    const b = e.breakdown;
    const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}位`;
    const factors = [["ワイン", b.premV + b.stdV], ["資金", b.money], ["資産", b.assetWorth], ["コレクション", b.bonusTotal], ["評価", b.parker]];
    factors.sort((a, c) => c[1] - a[1]);
    const topFactor = factors[0][1] > 0 ? factors[0][0] : "—";
    rows += `<div class="scRow ${i === 0 ? "win" : ""}">
      <span class="scMedal">${medal}</span>
      <span class="scName">${e.p.pname}</span>
      <span class="scTotal">${b.total}</span>
      <span class="scFactor">主力: ${topFactor}</span>
    </div>`;
  });
  stage.innerHTML = `<div class="shareCard" id="shareCard">
    <div class="scTitle">🍷 VinRoute 🍷</div>
    <div class="scSub">${seasonYear(g)}年 ${g.country.flavor.journeyName || g.country.name + "の旅"}・全${CONFIG.totalSeasons}シーズン</div>
    <div class="scCrown">👑 ${w.p.pname}</div>
    <div class="scWinTotal">総資産 ${w.total}</div>
    <div class="scRows">${rows}</div>
    <div class="scFooter">${g.country.flavor.shareTag || "#VinRoute"}</div>
  </div>
  <div class="edBtns">
    <button class="rsClose" onclick="location.reload()">もう一度遊ぶ</button>
  </div>
  <div class="scHint">📸 この画面をスクリーンショットで保存・共有できます</div>`;
}
