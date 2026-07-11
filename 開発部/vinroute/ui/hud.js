/* HUD：シーズンバー・プレイヤーチップ・手札 */
import { totalAssets, distanceToSpotlight, seasonYear, useCard } from "../engine/state.js";
import { CONFIG } from "../engine/config.js";
import { CARD_DEFS } from "../engine/cards.js";

export function createHUD(g, dom, chars) {
  const hud = dom.hud;

  function render() {
    const nodes = g.country.nodes;
    let spotTxt = "";
    if (g.spotlight.region && nodes[g.spotlight.region]) {
      if (g.spotlight.wonBy === null) {
        const d = distanceToSpotlight(g);
        spotTxt = `　⭐${nodes[g.spotlight.region].name}${d !== null ? `(あと${d})` : ""}`;
      } else spotTxt = `　⭐制覇:${g.players[g.spotlight.wonBy].pname}`;
    }
    const criticTxt = g.critic.on !== null && g.players[g.critic.on] ? `　🧐${g.players[g.critic.on].pname}` : "";
    const great = g.vintage.great && nodes[g.vintage.great] ? `　☀️${nodes[g.vintage.great].name}` : "";
    const poor = g.vintage.poor && nodes[g.vintage.poor] ? `　🌧${nodes[g.vintage.poor].name}` : "";
    const seasonInfo = `<div class="seasonBar">${seasonYear(g)}年 第${Math.min(g.season, CONFIG.totalSeasons)}/${CONFIG.totalSeasons}季${great}${poor}${spotTxt}${criticTxt}</div>`;
    const chips = g.players.map((p, i) => {
      const active = i === g.cur;
      return `<div class="pchip ${active ? "active" : ""}">
        <span class="dot" style="background:${chars[i].color}"></span>
        <span class="pn">${p.pname}${p.isNpc ? "<small>NPC</small>" : ""}</span>
        <span class="pv">${totalAssets(g, p)}</span>
        ${active ? `<span class="pres">🍇${p.grapes} 🛢${p.barrels} 💰${p.money}</span>` : ""}
      </div>`;
    }).join("");
    hud.innerHTML = seasonInfo + `<div class="chips">${chips}</div>` + renderHand();
    hud.querySelectorAll(".handCard").forEach(b => {
      b.onclick = () => useCard(g, +b.dataset.i, () => render());
    });
  }

  function renderHand() {
    const p = g.players[g.cur];
    if (!p || p.isNpc || !p.hand.length) return "";
    let html = `<div class="handBar"><div class="handLabel">手札（タップで使用）</div><div class="handCards">`;
    p.hand.forEach((key, idx) => {
      const d = CARD_DEFS[key];
      html += `<button class="handCard" data-i="${idx}" title="${d.desc}"><span>${d.icon}</span>${d.name}</button>`;
    });
    return html + `</div></div>`;
  }

  return { render };
}
