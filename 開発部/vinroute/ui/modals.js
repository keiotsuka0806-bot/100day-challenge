/* モーダル群＝エンジン io インターフェースの実装。
   すべて「閉じたら done() でターン再開」に統一（デッドロック厳禁）。
   評論家系はトークン管理（古いタイマーが新しい表示を閉じない） */
import { CONFIG } from "../engine/config.js";
import { CARD_DEFS } from "../engine/cards.js";
import {
  pickPath, pickPinpoint, seasonYear, marketRates, buyResource,
  sellWine, listWine, buyCityWine, startCityAuction, buyMarketCard, wineryRegionsOf, wineryWarp, totalAssets,
} from "../engine/state.js";
import { buildAsset, reinvest, canAfford, sellPrice } from "../engine/economy.js";
import { sfx } from "./sound.js";

/* 吹き出しの台詞（あつ森風の頭上リアクション） */
const LINES = {
  claim:   ["この産地はもらい！", "いい畑だ〜！", "ここ、好き！"],
  spot:    ["一番乗り〜！⭐", "やったー！⭐"],
  quizOk:  ["せいかい！✨", "ふふん♪"],
  quizNg:  ["うぅ…", "むずかしい…"],
  critic:  ["ぐぬぬ…", "ひええ…"],
  build:   ["できたー！🏗", "いい建物！"],
  monopoly:["ぜんぶ私のもの！👑"],
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
/* 評論家の姿（フィギュア画像。cls: angry=大暴走 / big=大物） */
const criticImg = (cls = "") => `<img class="criticImg ${cls}" src="assets/game/critic.png" alt="評論家">`;

export function createIO(g, env) {
  const { dom, uiState, mapR, toast, hudRender } = env;
  const M = id => dom[id];
  let criticToken = 0;

  const nodeName = k => g.country.nodes[k]?.name || k;
  const wineName = w => w.type === "prem"
    ? `${w.vintage}年 ${nodeName(w.region)}（評価${w.rating ?? "-"}）`
    : `${nodeName(w.region)} 量産`;
  const costText = cost => {
    const t = [];
    if (cost.grapes) t.push(`🍇${cost.grapes}`);
    if (cost.barrels) t.push(`🛢${cost.barrels}`);
    if (cost.money) t.push(`💰${cost.money}`);
    return t.join(" ");
  };
  const show = m => { m.style.display = "flex"; };
  const hide = m => { m.style.display = "none"; };
  const fin = done => { if (typeof done === "function") done(); };

  function updateMoves() {
    dom.movesLeft.textContent = g.movesLeft > 0 ? `あと ${g.movesLeft} マス` : "";
  }

  /* ===== 旅ノート（産地の知識カード＋図鑑）。記録は端末に永続保存 ===== */
  const NOTE_KEY = "vinroute_notebook_" + (g.country.raw.id || "x");
  const loadNote = () => { try { return JSON.parse(localStorage.getItem(NOTE_KEY)) || {}; } catch { return {}; } };
  const saveVisit = k => {
    const n = loadNote();
    if (!n[k]) { n[k] = Date.now(); localStorage.setItem(NOTE_KEY, JSON.stringify(n)); return true; }
    return false;
  };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const KIND_ICON = { "泡": "🥂", "白": "🥂", "白ワイン": "🥂", "赤": "🍷", "赤ワイン": "🍷", "ロゼ": "🌸" };

  function loreCardHtml(k, { compact = false } = {}) {
    const node = g.country.nodes[k];
    const lore = node.lore || {};
    const isCity = node.kind === "city";
    const icon = isCity ? "🏙" : (KIND_ICON[node.type] || "🍇");
    let rows = "";
    if (lore.grape) rows += `<div class="loreRow"><span>🍇 品種</span><b>${esc(lore.grape)}</b></div>`;
    if (lore.land) rows += `<div class="loreRow"><span>🌍 土地</span><b>${esc(lore.land)}</b></div>`;
    if (lore.taste) rows += `<div class="loreRow"><span>🍷 味わい</span><b>${esc(lore.taste)}</b></div>`;
    if (lore.pair) rows += `<div class="loreRow"><span>🍽 合う料理</span><b>${esc(lore.pair)}</b></div>`;
    if (lore.note) rows += `<div class="loreRow"><span>📖 メモ</span><b>${esc(lore.note)}</b></div>`;
    if (!rows) rows = `<div class="loreRow"><span>📖</span><b>この土地の記録はまだ白紙だ…</b></div>`;
    return `<div class="loreBox${compact ? " compact" : ""}">
      <div class="loreKind">${icon} ${isCity ? "都市" : `ワイン産地（${esc(node.type || "")}）`}</div>
      <div class="loreName">${esc(node.name)}</div>
      ${rows}</div>`;
  }

  function renderNotebook() {
    const m = M("loreModal");
    const noted = loadNote();
    const keys = Object.keys(g.country.nodes);
    const visitedN = keys.filter(k => noted[k]).length;
    let list = "";
    ["region", "city"].forEach(kind => {
      list += `<div class="noteSec">${kind === "city" ? "🏙 都市" : "🍇 ワイン産地"}</div>`;
      keys.filter(k => (g.country.nodes[k].kind === "city") === (kind === "city")).forEach(k => {
        const node = g.country.nodes[k];
        if (noted[k]) {
          const hint = node.lore ? esc(node.lore.grape || node.lore.note || "") : "";
          list += `<button class="noteRow" data-k="${k}"><b>${esc(node.name)}</b><small>${hint}</small></button>`;
        } else {
          list += `<div class="noteRow locked"><b>？？？</b><small>まだ訪れていない</small></div>`;
        }
      });
    });
    m.innerHTML = `<div class="noteBook">
      <div class="noteTitle">📖 旅ノート <span class="noteCount">${visitedN} / ${keys.length}</span></div>
      <div class="noteHint">止まった土地の知識が集まっていく（この端末に残ります）</div>
      <div class="noteList">${list}</div>
      <button class="noteClose">とじる</button></div>`;
    show(m);
    m.querySelectorAll(".noteRow[data-k]").forEach(b => b.onclick = () => {
      m.innerHTML = `<div class="loreWrap">${loreCardHtml(b.dataset.k, { compact: true })}
        <button class="loreOk" id="loreBack">← 旅ノートへ戻る</button></div>`;
      m.querySelector("#loreBack").onclick = renderNotebook;
    });
    m.querySelector(".noteClose").onclick = () => hide(m);
  }
  if (dom.noteBtn) dom.noteBtn.onclick = renderNotebook;

  const io = {
    /* ===== 進行の骨格 ===== */
    hud(game, done) { hudRender(); fin(done); },

    /* ===== 到着演出：ご当地のひとこと＋都市の鐘（進行は待たせない） ===== */
    nodeArrived(game, k, p, firstVisit, done) {
      const node = g.country.nodes[k];
      if (firstVisit) {
        const idx = g.players.indexOf(p);
        if (node.lore && node.lore.line && idx >= 0) mapR.bubble(idx, node.lore.line);
        if (node.kind === "city") sfx.bell();
      }
      fin(done);
    },

    /* ===== 旅ノートカード：初到着の土地の知識（人間のみ・ゲーム内1回） ===== */
    loreCard(game, k, done) {
      const m = M("loreModal");
      const newly = saveVisit(k);
      m.innerHTML = `<div class="loreWrap">${loreCardHtml(k)}
        <div class="loreSaved">${newly ? "✒️ 旅ノートに書き記した" : "📖 旅ノートを読み返した"}</div>
        <button class="loreOk" id="loreOk">旅を続ける →</button></div>`;
      sfx.card();
      mapR.punch(0.12, 900);
      show(m);
      m.querySelector("#loreOk").onclick = () => { hide(m); fin(done); };
    },

    turnBegin(game, p, done) {
      dom.dieFace.textContent = "—";
      dom.movesLeft.textContent = "";
      toast(`▶ ${p.pname} のターン（第${Math.min(g.season, CONFIG.totalSeasons)}シーズン）`);
      mapR.recenter();
      dom.rollBtn.disabled = p.isNpc;
      if (p.isNpc) setTimeout(() => fin(done), 700);
      else fin(done); // 人間はサイコロボタン → rollDice(g)
    },

    diceRolled(game, info, done) {
      dom.rollBtn.disabled = true;
      mapR.punch(0.15, 780); // 振る瞬間、少し寄る
      let flick = 0;
      const iv = setInterval(() => {
        dom.dieFace.textContent = 1 + Math.floor(Math.random() * 6);
        sfx.tick();
        if (++flick > 9) {
          clearInterval(iv);
          dom.dieFace.textContent = info.total; // 確定値（急行込み）で着地
          if (info.pinpoint) toast(`🎯 ${g.players[info.playerIdx].pname} は ${info.face} を選んだ！${info.boost ? `＋急行${info.boost}` : ""}`);
          else if (info.boost) toast(`🚄 ${info.face}＋急行${info.boost}＝${info.total} 進む！`);
          else toast(`🎲 ${g.players[info.playerIdx].pname} に ${info.face} が出た！`);
          uiState.moving = true;
          setTimeout(() => fin(done), 400);
        }
      }, 70);
    },

    moved(game, playerIdx, cellId, done) {
      updateMoves();
      setTimeout(() => fin(done), 360);
    },

    choosePath(game, choices) {
      uiState.awaitingPick = true;
      uiState.pickOptions = choices;
      dom.pickHint.classList.add("show");
      uiState.onPick = id => {
        uiState.awaitingPick = false;
        uiState.pickOptions = [];
        dom.pickHint.classList.remove("show");
        mapR.recenter();
        pickPath(g, id);
      };
    },

    pinpointPick(game, p) {
      const m = M("fundModal");
      let btns = "";
      for (let n = 1; n <= 6; n++) btns += `<button class="ppBtn" data-n="${n}">${n}</button>`;
      m.innerHTML = `<div class="slotBox"><div class="slotTitle">🎯 好きな目を選ぶ</div>
        <div class="ppGrid">${btns}</div>
        <div class="slotHint">出したい目をタップ</div></div>`;
      show(m);
      m.querySelectorAll(".ppBtn").forEach(b => b.onclick = () => { hide(m); pickPinpoint(g, +b.dataset.n); });
    },

    turnEnd(game, p, done) {
      uiState.moving = false;
      updateMoves();
      setTimeout(() => fin(done), 600);
    },

    skipped(game, p, done) {
      toast(`💤 ${p.pname} は1回休み`);
      setTimeout(() => fin(done), 1000);
    },

    /* ===== 到着イベント ===== */
    regionClaimed(game, k, p, value, done) {
      toast(`✨ ${nodeName(k)} を確保！ +${value}`);
      sfx.claim(); mapR.bubble(g.cur, pick(LINES.claim));
      mapR.punch(0.12, 700);
      fin(done);
    },
    spotlightWon(game, k, p, done) {
      toast(`⭐ 注目産地 ${nodeName(k)} に一番乗り！ +${CONFIG.bonus.spotlight}`);
      sfx.fanfare(); mapR.bubble(g.cur, pick(LINES.spot));
      mapR.punch(0.2, 1000);
      fin(done);
    },
    tastingFee(game, k, p, fee, done) {
      toast(`🍷 ${fee.owner.pname} のワイナリー（評価${fee.rating}）で試飲料 ${fee.fee}を支払い`);
      sfx.coin();
      fin(done);
    },

    /* ===== 建設メニュー ===== */
    buildMenu(game, k, done) {
      renderBuildMenu(k, false, done);
    },

    /* ===== 都市市場 ===== */
    cityMarket(game, k, done) {
      const p = g.players[g.cur];
      const m = M("cityModal");
      const render = () => {
        const pIdx = g.cur;
        const forSale = g.market.listings.filter(x => x.sellerIdx !== pIdx);
        let html = `<div class="cityBox"><div class="cityTitle">🏙 ${nodeName(k)} の市場</div>
          <div class="cityRes">💰${p.money}　保有ワイン${p.wines.length}本</div>`;
        html += `<div class="citySec">🛒 出品中のワイン（買う）</div>`;
        if (!forSale.length) html += `<div class="cityEmpty">今は出品がありません</div>`;
        else forSale.forEach(x => {
          const gi = g.market.listings.indexOf(x);
          html += `<div class="cityRow"><span class="cn">${x.w.type === "prem" ? "⭐" : "🍷"} ${wineName(x.w)}<small>出品：${g.players[x.sellerIdx].pname}</small></span>
            <button class="cbtn buy" data-gi="${gi}" ${p.money < x.price ? "disabled" : ""}>買う 💰${x.price}</button></div>`;
        });
        html += `<div class="citySec">🍷 自分のワイン（売る・出品）</div>`;
        if (!p.wines.length) html += `<div class="cityEmpty">売れるワインがありません</div>`;
        else p.wines.forEach((w, i) => {
          html += `<div class="cityRow"><span class="cn">${w.type === "prem" ? "⭐" : "🍷"} ${wineName(w)} <small>価値${w.value}</small></span>
            <span class="cbtns"><button class="cbtn" data-sell="${i}">卸す +${sellPrice(w)}</button><button class="cbtn list" data-auction="${i}">競売 開始${Math.round(w.value * CONFIG.listRate)}</button></span></div>`;
        });
        html += `<button class="cityClose">市場を出る →</button></div>`;
        m.innerHTML = html; show(m);
        m.querySelectorAll(".cbtn.buy:not([disabled])").forEach(b => b.onclick = () => {
          const x = g.market.listings[+b.dataset.gi];
          const r = buyCityWine(g, p, x);
          if (r.ok) { sfx.coin(); toast(`🛒 ワインを購入！`); }
          hudRender(); render();
        });
        m.querySelectorAll(".cbtn[data-sell]").forEach(b => b.onclick = () => {
          const price = sellWine(g, p, p.wines[+b.dataset.sell]);
          sfx.coin(); toast(`💰 卸した +${price}`); hudRender(); render();
        });
        m.querySelectorAll(".cbtn[data-auction]").forEach(b => b.onclick = () => {
          startCityAuction(g, g.cur, p.wines[+b.dataset.auction], () => render());
        });
        m.querySelector(".cityClose").onclick = () => { hide(m); fin(done); };
      };
      render();
    },

    auctionStart(game, w, done) {
      const m = M("cityModal");
      m.innerHTML = `<div class="cityBox"><div class="cityTitle">🔨 オークション開始</div>
        <div class="auctItem">${w.type === "prem" ? "⭐" : "🍷"} ${wineName(w)}</div>
        <div class="auctInfo">開始価格 ${Math.round(w.value * CONFIG.listRate)}（価値 ${w.value}）</div>
        <div class="cityEmpty">入札を募っています…</div></div>`;
      show(m); fin(done);
    },
    auctionEvent(game, ev, done) {
      if (ev.kind === "bid") toast(`💬 ${g.players[ev.playerIdx].pname} が ${ev.bid} で入札`);
      fin(done);
    },
    auctionBidPrompt(game, p, info, cb) {
      const m = M("cityModal");
      const leader = info.highBidder >= 0 ? `現在の最高：${g.players[info.highBidder].pname} の ${info.highBid}` : "まだ入札なし";
      m.innerHTML = `<div class="cityBox"><div class="cityTitle">🔨 オークション</div>
        <div class="auctItem">${wineName(info.w)}</div>
        <div class="auctInfo">${leader}</div>
        <div class="auctYou">${p.pname} の番　💰${p.money}</div>
        <button class="cbtn list bidBtn" ${p.money < info.nextBid ? "disabled" : ""}>${info.nextBid} で入札</button>
        <button class="cityClose passBtn">パスする</button></div>`;
      show(m);
      const bidBtn = m.querySelector(".bidBtn");
      if (bidBtn && !bidBtn.disabled) bidBtn.onclick = () => cb(true);
      m.querySelector(".passBtn").onclick = () => cb(false);
    },
    auctionEnd(game, w, result, done) {
      if (result.sold) sfx.coin(); if (result.sold) toast(`🔨 落札！ ${g.players[result.buyerIdx].pname} が ${wineName(w)} を ${result.price} で獲得`);
      else toast(`🔨 入札なし。${wineName(w)} は手元に残った`);
      fin(done);
    },

    /* ===== 道中マス ===== */
    slotResult(game, p, res, amt, done) {
      const m = M("slotModal");
      m.innerHTML = `<div class="slotBox">
        <div class="slotTitle">🎰 資源スロット</div>
        <div class="slotReel" id="slotReel">🍇</div>
        <button class="slotStop" id="slotStop">ストップ！</button>
        <div class="slotHint">タイミングよく止めよう</div></div>`;
      show(m);
      const reel = m.querySelector("#slotReel");
      const icons = CONFIG.slotResources.map(r => r.icon);
      let idx = 0, spinning = true;
      const timer = setInterval(() => { if (spinning) { idx = (idx + 1) % icons.length; reel.textContent = icons[idx]; sfx.tick(); } }, 90);
      const doStop = () => {
        if (!spinning) return; spinning = false; clearInterval(timer);
        reel.textContent = res.icon; sfx.coin();
        m.querySelector(".slotHint").textContent = `${res.name} +${amt} を獲得！`;
        const btn = m.querySelector("#slotStop"); btn.textContent = "続ける →";
        btn.onclick = () => { hide(m); toast(`🎰 ${res.name} +${amt}`); fin(done); };
        if (p.isNpc) setTimeout(() => { hide(m); toast(`🎰 ${p.pname}：${res.name}+${amt}`); fin(done); }, 700);
      };
      m.querySelector("#slotStop").onclick = doStop;
      if (p.isNpc) setTimeout(doStop, 600 + Math.random() * 500);
    },

    fundResult(game, p, amt, done) {
      if (p.isNpc) { toast(`💰 ${p.pname} 資金+${amt}`); setTimeout(() => fin(done), 500); return; }
      const m = M("fundModal");
      const amounts = CONFIG.fundRoulette;
      m.innerHTML = `<div class="slotBox">
        <div class="slotTitle">💰 資金ルーレット</div>
        <div class="slotReel" id="fundReel">3</div>
        <button class="slotStop" id="fundStop">ストップ！</button>
        <div class="slotHint">止めた金額がもらえる</div></div>`;
      show(m);
      let idx = 0, spinning = true;
      const reel = m.querySelector("#fundReel");
      const timer = setInterval(() => { if (spinning) { idx = (idx + 1) % amounts.length; reel.textContent = amounts[idx]; sfx.tick(); } }, 80);
      m.querySelector("#fundStop").onclick = () => {
        if (!spinning) return; spinning = false; clearInterval(timer);
        reel.textContent = amt; sfx.coin();
        m.querySelector(".slotHint").textContent = `資金 +${amt} を獲得！`;
        const btn = m.querySelector("#fundStop"); btn.textContent = "続ける →";
        btn.onclick = () => { hide(m); toast(`💰 資金+${amt}`); fin(done); };
      };
    },

    quiz(game, p, item, submit) {
      const m = M("quizModal");
      let html = `<div class="qzTitle">🔵 ソムリエクイズ</div><div class="qzQ">${item.q}</div>`;
      item.choices.forEach((o, i) => { html += `<button class="qzOpt" data-i="${i}">${o}</button>`; });
      m.innerHTML = html; show(m);
      m.querySelectorAll(".qzOpt").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        m.querySelectorAll(".qzOpt").forEach((x, xi) => {
          x.disabled = true;
          if (xi === item.answer) x.classList.add("ok");
          else if (xi === i) x.classList.add("ng");
        });
        submit(i);
      });
    },
    quizResult(game, p, r, done) {
      if (r.correct) { sfx.quizOk(); mapR.bubble(g.cur, pick(LINES.quizOk)); }
      else { sfx.quizNg(); mapR.bubble(g.cur, pick(LINES.quizNg)); }
      const m = M("quizModal");
      const rew = r.correct ? `<div class="qzR ok">正解！ 資金+${r.reward}</div>` : `<div class="qzR ng">不正解…</div>`;
      m.innerHTML += `${rew}<div class="qzExp">${r.item.explain}</div><button class="qzNext">続ける →</button>`;
      m.querySelector(".qzNext").onclick = () => { hide(m); fin(done); };
    },
    quizAutoPass(game, p, done) { toast(`📖 ソムリエの知恵で自動正解！ 資金+${CONFIG.quizReward}`); setTimeout(() => fin(done), 600); },
    quizNpc(game, p, ok, done) { if (ok) sfx.quizOk(); else sfx.quizNg(); mapR.bubble(g.cur, ok ? pick(LINES.quizOk) : pick(LINES.quizNg)); toast(ok ? `🔵 ${p.pname} がクイズ正解 資金+${CONFIG.quizReward}` : `🔵 ${p.pname} はクイズ不正解`); setTimeout(() => fin(done), 500); },

    resourceMarket(game, p, done) {
      const m = M("marketModal");
      const render = () => {
        const r = marketRates(g);
        const cardKey = g.market.cardOfDay;
        const cd = cardKey ? CARD_DEFS[cardKey] : null;
        m.innerHTML = `<div class="mkBox">
          <div class="mkTitle">🏪 市場（${seasonYear(g)}年の相場）</div>
          <div class="mkRes">手持ち 🍇${p.grapes} 🛢${p.barrels} 💰${p.money}</div>
          <button class="mkBtn" data-buy="grapes" ${p.money < r.grapes ? "disabled" : ""}>🍇 ぶどうを買う <span>💰${r.grapes}</span></button>
          <button class="mkBtn" data-buy="barrels" ${p.money < r.barrels ? "disabled" : ""}>🛢 樽を買う <span>💰${r.barrels}</span></button>
          ${cd ? `<button class="mkBtn card" data-buy="card" ${p.money < CONFIG.marketCardCost ? "disabled" : ""}>🃏 ${cd.name} <span>💰${CONFIG.marketCardCost}</span></button>
          <div class="mkCardDesc">${cd.desc}</div>` : ""}
          <button class="mkClose">市場を出る →</button></div>`;
        show(m);
        m.querySelectorAll(".mkBtn:not([disabled])").forEach(b => b.onclick = () => {
          const what = b.dataset.buy;
          if (what === "card") {
            const key = buyMarketCard(g, p);
            if (key) toast(`🏪 「${CARD_DEFS[key].name}」を購入`);
            hide(m); hudRender(); fin(done); return;
          }
          if (buyResource(g, p, what)) toast(`🏪 ${what === "grapes" ? "ぶどう" : "樽"}を購入`);
          hudRender(); render();
        });
        m.querySelector(".mkClose").onclick = () => { hide(m); fin(done); };
      };
      render();
    },

    cardDrawn(game, p, key, done) {
      const d = CARD_DEFS[key];
      if (p.isNpc) { toast(`🃏 ${p.pname} がカード獲得`); setTimeout(() => fin(done), 500); return; }
      const m = M("cardModal");
      m.innerHTML = `<div class="cardBox">
        <div class="cardTitle">🃏 カードスロット</div>
        <div class="cardReelName" id="reelName">？？？</div>
        <div class="cardReelDesc" id="reelDesc">タイミングよく止めよう</div>
        <button class="cardOk" id="cardStop">ストップ！</button></div>`;
      show(m);
      const keys = Object.keys(CARD_DEFS);
      let idx = 0, spinning = true;
      const name = m.querySelector("#reelName");
      const timer = setInterval(() => { if (spinning) { idx = (idx + 1) % keys.length; name.textContent = CARD_DEFS[keys[idx]].name; sfx.tick(); } }, 70);
      m.querySelector("#cardStop").onclick = () => {
        if (!spinning) return; spinning = false; clearInterval(timer);
        name.textContent = d.name; sfx.card();
        m.querySelector("#reelDesc").textContent = d.desc;
        const btn = m.querySelector("#cardStop"); btn.textContent = "手札に加える →";
        btn.onclick = () => { hide(m); toast(`🃏 「${d.name}」を手札に`); hudRender(); fin(done); };
      };
    },

    criticHitShow(game, p, line, done) {
      sfx.critic();
      const m = M("criticModal");
      const token = ++criticToken;
      m.innerHTML = `<div class="criticBox">
        <div class="criticFace">${criticImg()}</div>
        <div class="criticName">${g.country.flavor.criticName || "辛口評論家"}、登場</div>
        <div class="criticSlotLine" id="critLine">…</div>
        <div class="criticSlotEff" id="critEff">どんな評価が下る…？</div>
        <button class="criticOk" id="critStop">ストップ！</button></div>`;
      show(m);
      const lines = envCriticLines();
      let idx = 0, spinning = true;
      const lineEl = m.querySelector("#critLine"), effEl = m.querySelector("#critEff");
      const timer = setInterval(() => { if (spinning) { idx = (idx + 1) % lines.length; lineEl.textContent = lines[idx].t; effEl.textContent = lines[idx].msg; } }, 90);
      const stopBtn = m.querySelector("#critStop");
      const doStop = () => {
        if (!spinning) return; spinning = false; clearInterval(timer);
        lineEl.textContent = line.t; effEl.textContent = line.msg;
        hudRender();
        stopBtn.textContent = "ぐぬぬ…";
        stopBtn.onclick = () => { if (criticToken === token) hide(m); toast(`🧐 評論家：${line.msg}`); fin(done); };
        if (p.isNpc) setTimeout(() => { if (criticToken === token) hide(m); toast(`🧐 ${p.pname}：${line.msg}`); fin(done); }, 800);
      };
      stopBtn.onclick = doStop;
      if (p.isNpc) setTimeout(doStop, 700 + Math.random() * 400);
    },

    defended(game, p, done) { sfx.claim(); toast("🛡 防御！評論家を追い払った"); setTimeout(() => fin(done), 600); },

    /* ===== 憑依評論家 ===== */
    criticDamage(game, p, ce, done) {
      sfx.critic();
      const idx = g.players.indexOf(p);
      if (idx >= 0) mapR.bubble(idx, pick(LINES.critic));
      const m = M("criticModal");
      const chaos = ce.tier === "chaos";
      if (chaos) mapR.shake(10, 550);
      const harmless = (!ce.eff || Object.keys(ce.eff).length === 0) && !ce.special;
      const face = criticImg(chaos ? "angry" : "");
      const tierClass = chaos ? "chaos" : harmless ? "harmless" : "";
      const tierLabel = chaos ? "評論家 大暴走！" : harmless ? "評論家の気まぐれ" : "評論家の酷評";
      const token = ++criticToken;
      m.innerHTML = `<div class="criticBox dmg ${tierClass}">
        <div class="criticFace">${face}</div>
        <div class="criticName">${tierLabel}</div>
        <div class="criticVictim">${p.pname} に…</div>
        <div class="criticBigMsg">${ce.msg}</div>
        <button class="criticOk" id="criticOk">${chaos ? "ぎゃああ" : harmless ? "ホッ…" : "ぐぬぬ…"}</button></div>`;
      show(m);
      let closed = false;
      const close = () => {
        if (closed) return; closed = true;
        if (criticToken === token) hide(m);
        fin(done);
      };
      m.querySelector("#criticOk").onclick = close;
      // 人間はボタンで閉じるまで待つ。NPCのみ自動クローズ
      if (p.isNpc) setTimeout(() => { if (criticToken === token) close(); }, chaos ? 2600 : 1800);
    },

    criticAttach(game, leaderIdx, done) {
      sfx.critic();
      const lp = g.players[leaderIdx];
      const m = M("criticModal");
      const token = ++criticToken;
      m.innerHTML = `<div class="criticBox">
        <div class="criticFace">${criticImg()}</div>
        <div class="criticName">${g.country.flavor.criticName || "辛口評論家"}、現る</div>
        <div class="criticLine">「首位の ${lp.pname} …お手並み拝見といこう」</div>
        <div class="criticEff">憑いている間、毎ターン気まぐれな悪評を受ける。接触で他人に移る</div>
        <button class="criticOk" id="criticOk">ぐぬぬ…</button></div>`;
      show(m);
      let closed = false;
      const close = () => { if (closed) return; closed = true; if (criticToken === token) hide(m); fin(done); };
      m.querySelector("#criticOk").onclick = close;
      setTimeout(() => { if (criticToken === token && m.style.display === "flex") close(); }, 3500);
    },

    criticPassed(game, toIdx, done) {
      toast(`🧐 評論家が ${g.players[toIdx].pname} に乗り移った！`);
      hudRender(); fin(done);
    },

    bigCriticAnnounce(game, done) {
      sfx.critic();
      const m = M("criticModal");
      const token = ++criticToken;
      m.innerHTML = `<div class="criticBox">
        <div class="criticFace">${criticImg("big")}</div>
        <div class="criticName">大物評論家、来訪</div>
        <div class="criticLine">「今季は私が全ワイナリーを評価する。心して待て」</div>
        <div class="criticEff">今シーズンの評価は大きく変動する</div>
        <button class="criticOk" id="bigCriticOk">来たか…</button></div>`;
      show(m);
      let closed = false;
      const close = () => { if (closed) return; closed = true; if (criticToken === token) hide(m); fin(done); };
      m.querySelector("#bigCriticOk").onclick = close;
      setTimeout(() => { if (criticToken === token && m.style.display === "flex") close(); }, 3500);
    },

    /* ===== シーズン ===== */
    vintageAnnounce(game, done) {
      sfx.chime();
      mapR.punch(-0.32, 2800); // 新しい年＝ゆっくり引きの絵になって戻る
      const nodes = g.country.nodes;
      const gr = nodes[g.vintage.great], pr = nodes[g.vintage.poor];
      const m = M("vintageModal");
      m.innerHTML = `<div class="vtBox">
        <div class="vtYear">${seasonYear(g)}年</div>
        <div class="vtSub">第 ${g.season} シーズンの天候</div>
        <div class="vtGreat">⭐☀️ 注目＆当たり年：<b>${gr ? gr.name : "—"}</b><small>一番乗りでボーナス！プレミアムは価値2倍！</small></div>
        <div class="vtPoor">🌧 不作の年：<b>${pr ? pr.name : "—"}</b><small>この産地のプレミアムは価値半減…</small></div>
        <button class="vtOk" id="vtOk">シーズン開始 →</button></div>`;
      show(m);
      let closed = false;
      const close = () => { if (closed) return; closed = true; hide(m); fin(done); };
      m.querySelector("#vtOk").onclick = close;
      setTimeout(() => { if (m.style.display === "flex") close(); }, 4000);
    },

    wineSale(game, p, newWines, done) {
      const m = M("saleModal");
      const render = () => {
        const heldTotal = p.wines.length;
        const heldPrem = p.wines.filter(w => w.type === "prem").length;
        const heldStd = p.wines.filter(w => w.type === "std").length;
        const soldThis = newWines.filter(w => w._sold).length;
        const keepThis = newWines.filter(w => !w._sold).length;
        let html = `<div class="saleBox"><div class="saleTitle">🍷 ${p.pname}：今季のワイン</div>
          <div class="saleSub">売れば即資金（価値の${Math.round(CONFIG.sellRate * 100)}%）。持てば総資産＆コレクションに満額。</div>
          <div class="saleStats">
            <span>保有 計${heldTotal}本（⭐${heldPrem}・🍷${heldStd}）</span>
            <span>今季 持つ${keepThis}／売る${soldThis}</span>
            <span>💰${p.money}</span>
          </div>`;
        newWines.forEach((w, idx) => {
          html += `<div class="saleRow ${w._sold ? "sold" : ""}">
            <span class="sn">${w.type === "prem" ? "⭐" : "🍷"} ${wineName(w)}</span>
            <span class="sv">価値${w.value}</span>
            ${w._sold ? `<span class="sdone">売却済 +${w._soldFor}</span>` : `<button class="sbtn" data-i="${idx}">売る（+${sellPrice(w)}）</button>`}
          </div>`;
        });
        html += `<button class="saleClose">残り${keepThis}本を持つ →</button></div>`;
        m.innerHTML = html; show(m);
        m.querySelectorAll(".sbtn").forEach(b => b.onclick = () => {
          const w = newWines[+b.dataset.i];
          if (w && !w._sold) {
            const price = sellWine(g, p, w);
            w._sold = true; w._soldFor = price;
            sfx.coin();
            toast(`💰 ワインを売却 +${price}`);
            hudRender(); render();
          }
        });
        m.querySelector(".saleClose").onclick = () => { hide(m); hudRender(); fin(done); };
      };
      render();
    },

    /* ===== カードの対象選択 ===== */
    chooseWarp(game, p, cb) {
      const m = M("cardModal");
      let html = `<div class="cardBox"><div class="cardTitle">🌀 ワープ先を選ぶ</div><div class="warpList">`;
      g.country.regionKeys.forEach(k => { html += `<button class="warpBtn" data-k="${k}">${nodeName(k)}</button>`; });
      html += `</div><button class="cardOk" id="warpCancel">やめる</button></div>`;
      m.innerHTML = html; show(m);
      m.querySelectorAll(".warpBtn").forEach(b => b.onclick = () => { hide(m); toast(`🌀 ${nodeName(b.dataset.k)} へワープ！`); cb(b.dataset.k); });
      m.querySelector("#warpCancel").onclick = () => { hide(m); cb(null); };
    },
    chooseSabotage(game, p, cb) {
      const m = M("cardModal");
      const others = g.players.map((o, i) => ({ o, i })).filter(e => e.i !== g.cur);
      let html = `<div class="cardBox"><div class="cardTitle">💢 妨害する相手を選ぶ</div><div class="warpList">`;
      others.forEach(e => { html += `<button class="warpBtn" data-i="${e.i}">${e.o.pname}（💰${e.o.money}）</button>`; });
      html += `</div><button class="cardOk" id="sabCancel">やめる</button></div>`;
      m.innerHTML = html; show(m);
      m.querySelectorAll(".warpBtn").forEach(b => b.onclick = () => { hide(m); cb(+b.dataset.i); });
      m.querySelector("#sabCancel").onclick = () => { hide(m); cb(null); };
    },
    choosePassCritic(game, p, cb) {
      const m = M("cardModal");
      const others = g.players.map((o, i) => ({ o, i })).filter(e => e.i !== g.cur);
      let html = `<div class="cardBox"><div class="cardTitle">🧐 評論家を押し付ける相手を選ぶ</div><div class="warpList">`;
      others.forEach(e => { html += `<button class="warpBtn" data-i="${e.i}">${e.o.pname}（総資産 ${totalAssets(g, e.o)}）</button>`; });
      html += `</div><button class="cardOk" id="pcCancel">やめる</button></div>`;
      m.innerHTML = html; show(m);
      m.querySelectorAll(".warpBtn").forEach(b => b.onclick = () => { hide(m); toast(`🧐 評論家を ${g.players[+b.dataset.i].pname} に押し付けた！`); cb(+b.dataset.i); });
      m.querySelector("#pcCancel").onclick = () => { hide(m); cb(null); };
    },

    stole(game, p, r, done) {
      const icon = r.res === "money" ? "💰" : "🍇";
      toast(`${icon} ${r.victim.pname} から ${r.take} 奪った！`);
      hudRender(); fin(done);
    },
    foreseeShown(game, nextGreat, done) {
      toast(nextGreat ? `🔮 来季の当たり年は ${nodeName(nextGreat)}！` : "🔮 これが最終シーズン、来季はない");
      fin(done);
    },
  };

  /* 道中の評論家マス用の台詞（表示のみ・効果はエンジンから渡される line） */
  function envCriticLines() {
    return [
      { t: "「この畑のぶどうは凡庸だ」", msg: "資金-2" },
      { t: "「熟成が足りん、話にならん」", msg: "ぶどう-1" },
      { t: "「樽の香りが強すぎる」", msg: "樽-1" },
      { t: "「まあ…悪くはない、が」", msg: "資金-1" },
      { t: "「この価格設定は許せん」", msg: "資金-3" },
      { t: "「収穫が雑だな」", msg: "ぶどう-2" },
      { t: "「今日は…見逃してやろう」", msg: "無害！セーフ" },
      { t: "「テロワールが泣いている」", msg: "価値-3" },
    ];
  }

  /* 建設メニュー本体（ワープで産地が変わっても再帰的に描画） */
  function renderBuildMenu(k, warped, done) {
    const p = g.players[g.cur];
    const a = p.assets[k] || {};
    const m = M("buildModal");
    const opts = [
      { id: "vineyard", name: "畑", desc: `毎シーズン ぶどう+${CONFIG.produce.vineyardGrapes}`, cost: CONFIG.cost.vineyard, built: a.vineyard },
      { id: "winery_std", name: "醸造所", desc: `毎シーズン 量産ワイン(価値${CONFIG.produce.stdWineValue})`, cost: CONFIG.cost.winery_std, built: a.winery_std },
      { id: "winery_prem", name: "ワイナリー", desc: `プレミアムワイン(価値${CONFIG.produce.premWineValue})＋試飲料`, cost: CONFIG.cost.winery_prem, built: a.winery_prem },
    ];
    const builtCount = opts.filter(o => o.built).length;
    let html = `<div class="bmTitle">${nodeName(k)} で建設</div>
      <div class="bmRes">あなたの手持ち 🍇${p.grapes} 🛢${p.barrels} 💰${p.money}${builtCount === 3 ? "　👑あなたは独占済み" : ""}</div>`;
    opts.forEach(o => {
      const can = !o.built && canAfford(p, o.cost);
      const label = o.built ? "✓ 建設済み（あなた）" : can ? costText(o.cost) : costText(o.cost) + "（資源不足）";
      html += `<button class="bmBtn ${o.built ? "done" : ""}" ${can ? "" : "disabled"} data-a="${o.id}">
        <b>${o.name}</b> <span>${label}</span><small>${o.desc}</small></button>`;
    });
    [["winery_std", "醸造所"], ["winery_prem", "ワイナリー"]].forEach(([aid, nm]) => {
      if (!a[aid]) return;
      const lv = a[aid + "_lv"] || 1;
      const rc = CONFIG.reinvest[aid];
      if (lv >= CONFIG.reinvest.maxLevel) {
        html += `<button class="bmBtn done" disabled><b>${nm}を増産</b> <span>Lv${lv}（最大）</span><small>毎シーズン${lv}本生産中</small></button>`;
      } else {
        const can = canAfford(p, rc);
        html += `<button class="bmBtn reinvest" ${can ? "" : "disabled"} data-reinvest="${aid}">
          <b>${nm}を増産 Lv${lv}→${lv + 1}</b> <span>${costText(rc)}${can ? "" : "（資源不足）"}</span><small>生産量が${lv}本→${lv + 1}本に</small></button>`;
      }
    });
    const anyBuildable = opts.some(o => !o.built && canAfford(p, o.cost));
    const otherWineries = wineryRegionsOf(p).filter(rk => rk !== k);
    if (!warped && !p.warpedThisTurn && a.winery_prem && otherWineries.length > 0) {
      html += `<button class="bmWarp">🍷➡ 自分の別のワイナリーへ視察（1ターン1回）</button>`;
    }
    html += `<button class="bmClose">${anyBuildable ? "ここまでにして進む →" : "進む →"}</button>`;
    m.innerHTML = html; show(m);
    m.querySelectorAll(".bmBtn:not([disabled])").forEach(b => b.onclick = () => {
      if (b.dataset.reinvest) {
        const r = reinvest(g, p, k, b.dataset.reinvest);
        if (r.ok) sfx.build();
        if (r.ok) toast(`📈 ${nodeName(k)} を増産（Lv${r.level}）！`);
      } else {
        const aid = b.dataset.a;
        if (g.owned[k] === undefined || g.owned[k] === null) g.owned[k] = g.cur;
        const r = buildAsset(g, p, k, aid);
        if (r.ok) {
          sfx.build(); mapR.bubble(g.cur, pick(LINES.build));
          toast(`🏗 ${nodeName(k)} に ${aid === "vineyard" ? "畑" : aid === "winery_std" ? "醸造所" : "ワイナリー"} を建設！`);
          if (r.monopoly) { sfx.fanfare(); mapR.bubble(g.cur, pick(LINES.monopoly)); } if (r.monopoly) toast(`👑 ${nodeName(k)} を独占！ +${CONFIG.bonus.monopoly}`);
          (r.setEvents || []).forEach(e => toastSetEvent(e));
        }
      }
      hudRender();
      renderBuildMenu(k, warped, done);
    });
    const warpBtn = m.querySelector(".bmWarp");
    if (warpBtn) warpBtn.onclick = () => renderWarpMenu(k, done);
    m.querySelector(".bmClose").onclick = () => { hide(m); fin(done); };
  }

  function renderWarpMenu(fromK, done) {
    const p = g.players[g.cur];
    const dests = wineryRegionsOf(p).filter(rk => rk !== fromK);
    const m = M("buildModal");
    let html = `<div class="bmTitle">🍷 視察に向かうワイナリー</div>
      <div class="bmRes">自分のワイナリーがある産地へ飛べる</div>`;
    dests.forEach(rk => {
      const a = p.assets[rk];
      const rating = a.rating ? `（評価${a.rating}）` : "";
      html += `<button class="bmBtn" data-k="${rk}"><b>${nodeName(rk)}</b> <span>ワイナリー${rating}</span><small>ここへワープして建設・視察</small></button>`;
    });
    html += `<button class="bmClose">やめる（この産地に留まる）</button>`;
    m.innerHTML = html;
    m.querySelectorAll(".bmBtn").forEach(b => b.onclick = () => {
      const rk = b.dataset.k;
      if (wineryWarp(g, p, rk)) {
        toast(`🍷➡ ${nodeName(rk)} のワイナリーへ視察に来た`);
        renderBuildMenu(rk, true, done);
      } else renderBuildMenu(fromK, false, done);
    });
    m.querySelector(".bmClose").onclick = () => renderBuildMenu(fromK, false, done);
  }

  function toastSetEvent(e) {
    if (e.kind === "geoSet") toast(`🗺 地理セット「${e.set}」完成！（畑を制覇）+${e.bonus}`);
    else if (e.kind === "typeColl") toast(`🍷 タイプコレクション完成！+${e.bonus}`);
    else if (e.kind === "regionColl") toast(`🗺 産地コレクション ${e.tier}産地達成！ +${e.bonus}`);
    else if (e.kind === "regionComplete") toast(`🏆 全産地コンプリート！ +${e.bonus}`);
    else if (e.kind === "vintageColl") toast(`📅 ヴィンテージコレクション ${e.tier}年代！ +${e.bonus}`);
  }

  return io;
}
