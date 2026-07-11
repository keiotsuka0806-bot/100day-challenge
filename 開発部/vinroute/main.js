/* 起動・国選択・プレイヤー選択・ゲームループ配線 */
import { loadCountry } from "./engine/country.js";
import { createGame, startGame, rollDice } from "./engine/state.js";
import { CHARACTERS, charSprite } from "./ui/characters.js";
import { createMapRenderer } from "./ui/map.js";
import { createHUD } from "./ui/hud.js";
import { createIO } from "./ui/modals.js";
import { showEnding, loadRecords } from "./ui/ending.js";
import { armSoundOnGesture, toggleSound, soundEnabled, sfx } from "./ui/sound.js";

const $ = id => document.getElementById(id);
const dom = {};
["modeSelect", "countSelect", "select", "game", "cv", "avatarLayer", "hud", "pickHint", "toast",
  "actionLog", "rollBtn", "ovBtn", "dieFace", "movesLeft", "countBtns", "countTitle", "avatars",
  "pname", "goBtn", "buildModal", "quizModal", "slotModal", "criticModal", "vintageModal",
  "cardModal", "marketModal", "fundModal", "saleModal", "cityModal", "resultModal",
  "loreModal", "noteBtn",
  "countrySel", "recordsLink", "recordsBox"].forEach(id => dom[id] = $(id));

/* ===== サウンド：初回操作で起動＋ボタン音＋ミュートトグル ===== */
armSoundOnGesture();
document.addEventListener("click", ev => {
  if (ev.target.closest("button, .mbtn, .cbtn, .av")) sfx.click();
}, true);
const sndBtn = $("sndBtn");
if (sndBtn) {
  sndBtn.textContent = soundEnabled() ? "🔊" : "🔇";
  sndBtn.onclick = () => { sndBtn.textContent = toggleSound() ? "🔊" : "🔇"; };
}

/* ===== 国データ（国を足すには data/*.json を追加してここに並べるだけ） ===== */
const COUNTRIES = [
  { id: "france", file: "data/france.json", label: "🇫🇷 フランス" },
  { id: "italy", file: "data/italy.json", label: "🇮🇹 イタリア（体験版）" },
];
let selectedCountry = COUNTRIES[0];

function renderCountrySel() {
  dom.countrySel.innerHTML = "";
  COUNTRIES.forEach(c => {
    const b = document.createElement("button");
    b.className = "countryBtn" + (c === selectedCountry ? " sel" : "");
    b.textContent = c.label;
    b.onclick = () => { selectedCountry = c; renderCountrySel(); };
    dom.countrySel.appendChild(b);
  });
}
renderCountrySel();

/* 戦績一覧 */
dom.recordsLink.onclick = () => {
  const box = dom.recordsBox;
  if (box.style.display !== "none") { box.style.display = "none"; return; }
  const recs = loadRecords();
  if (!recs.length) box.innerHTML = `<h3>📜 戦績</h3><div>まだ記録がありません</div>`;
  else box.innerHTML = `<h3>📜 戦績（最新${Math.min(recs.length, 20)}件）</h3>` + recs.slice(0, 20).map(r => {
    const d = new Date(r.date);
    const ds = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const w = r.results[0];
    return `<div class="recRow"><span class="rd">${ds}</span><span class="rw">👑${w.name}（${w.total}）｜${r.results.map(x => `${x.rank}位${x.name}`).join(" ")}</span></div>`;
  }).join("");
  box.style.display = "block";
};

/* ===== モード・人数・アバター選択（プロトタイプの流れを踏襲） ===== */
let soloMode = false, numPlayers = 2;
dom.modeSolo = $("modeSolo"); dom.modeFriends = $("modeFriends");
$("modeSolo").onclick = () => {
  soloMode = true;
  dom.modeSelect.style.display = "none";
  dom.countTitle.textContent = "あなたを含めて何人で戦う？（NPCと対戦）";
  buildCountButtons();
  dom.countSelect.style.display = "flex";
};
$("modeFriends").onclick = () => {
  soloMode = false;
  dom.modeSelect.style.display = "none";
  dom.countTitle.textContent = "何人で遊ぶ？（全員プレイヤー）";
  buildCountButtons();
  dom.countSelect.style.display = "flex";
};
function buildCountButtons() {
  dom.countBtns.innerHTML = "";
  [2, 3, 4].forEach(n => {
    const b = document.createElement("div");
    b.className = "cbtn";
    const sub = soloMode ? `あなた + NPC${n - 1}` : `プレイヤー${n}人`;
    b.innerHTML = `<div class="big">${n}</div><div class="sm">${sub}</div>`;
    b.onclick = () => {
      numPlayers = n;
      dom.countSelect.style.display = "none";
      dom.select.style.display = "flex";
      startSelection();
    };
    dom.countBtns.appendChild(b);
  });
}

let chosen = null, humanPicks = [], pickIndex = 0, usedIds = new Set();
const selTitle = document.querySelector("#select p");
function humanCount() { return soloMode ? 1 : numPlayers; }
function buildAvatarGrid() {
  dom.avatars.innerHTML = "";
  CHARACTERS.forEach(a => {
    const taken = usedIds.has(a.id);
    const d = document.createElement("div");
    d.className = "av" + (taken ? " taken" : "");
    d.innerHTML = `<img src="${charSprite(a.id)}" style="display:block;margin:0 auto;height:96px">` + `<div class="nm">${a.name}</div><div class="ds">${taken ? "選択済み" : a.desc}</div>`;
    if (!taken) d.onclick = () => {
      document.querySelectorAll(".av").forEach(x => x.classList.remove("sel"));
      d.classList.add("sel");
      chosen = a;
      if (!dom.pname.value) dom.pname.value = a.name;
      checkReady();
    };
    dom.avatars.appendChild(d);
  });
}
function refreshSelectTitle() {
  const total = humanCount();
  if (total === 1) selTitle.textContent = "あなたの相棒を選ぼう。";
  else selTitle.textContent = `プレイヤー${pickIndex + 1} のキャラを選ぼう（${pickIndex + 1}/${total}人目）`;
  dom.goBtn.textContent = (pickIndex + 1 >= total) ? "旅に出る →" : "次のプレイヤーへ →";
}
function startSelection() {
  humanPicks = []; pickIndex = 0; usedIds = new Set(); chosen = null;
  dom.pname.value = "";
  buildAvatarGrid(); refreshSelectTitle(); checkReady();
}
dom.pname.oninput = checkReady;
function checkReady() { dom.goBtn.disabled = !(chosen && dom.pname.value.trim()); }
dom.goBtn.onclick = () => {
  humanPicks.push({ palette: chosen, name: dom.pname.value.trim() });
  usedIds.add(chosen.id);
  if (pickIndex + 1 < humanCount()) {
    pickIndex++; chosen = null; dom.pname.value = "";
    buildAvatarGrid(); refreshSelectTitle(); checkReady();
  } else {
    launchGame();
  }
};

/* ===== デモ／動作確認モード：?demo=1 で全員NPCの自動進行（&country=italy 可） ===== */
const params = new URLSearchParams(location.search);
if (params.get("demo")) {
  const cid = params.get("country") || "france";
  selectedCountry = COUNTRIES.find(c => c.id === cid) || COUNTRIES[0];
  soloMode = true; numPlayers = 3;
  humanPicks = [];
  dom.modeSelect.style.display = "none";
  launchGame();
}

/* ===== ゲーム起動 ===== */
let toTimer = null;
function toast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add("show");
  clearTimeout(toTimer);
  toTimer = setTimeout(() => dom.toast.classList.remove("show"), 1800);
  const log = dom.actionLog;
  const e = document.createElement("div");
  e.className = "le"; e.textContent = msg;
  log.prepend(e);
  while (log.children.length > 4) log.removeChild(log.lastChild);
}

async function launchGame() {
  // cache:"no-cache"＝毎回サーバーに更新確認（データ更新が古いキャッシュに負けないように）
  const countryJson = await (await fetch(selectedCountry.file, { cache: "no-cache" })).json();
  const country = loadCountry(countryJson);
  let quizzes = [];
  if (countryJson.quizFile) {
    try { quizzes = (await (await fetch("data/" + countryJson.quizFile, { cache: "no-cache" })).json()).quiz || []; } catch {}
  }

  // プレイヤー編成
  const specs = [];
  const chars = [];
  const used = new Set();
  humanPicks.forEach(hp => {
    used.add(hp.palette.id);
    specs.push({ name: hp.name || hp.palette.name, isNpc: false });
    chars.push(hp.palette);
  });
  if (soloMode) {
    for (let i = humanPicks.length; i < numPlayers; i++) {
      const pick = CHARACTERS.find(a => !used.has(a.id));
      used.add(pick.id);
      specs.push({ name: pick.name, isNpc: true });
      chars.push(pick);
    }
  }

  const seed = Math.floor(Math.random() * 1e9);
  const g = createGame(country, { seed, players: specs, quizzes });

  const uiState = { awaitingPick: false, pickOptions: [], moving: false, onPick: () => {} };
  const mapR = createMapRenderer(g, { canvas: dom.cv, avatarLayer: dom.avatarLayer, gameEl: dom.game }, uiState);
  const hud = createHUD(g, { hud: dom.hud }, chars);
  const io = createIO(g, { dom, uiState, mapR, toast, hudRender: hud.render });
  io.gameEnd = (game, ranked, done) => {
    // エンディング前に、旅した土地をカメラで振り返る（人間プレイヤー優先）
    const traveler = g.players.find(p => !p.isNpc) || g.players[0];
    toast("🧳 旅の記憶をたどっています…");
    mapR.flyover(traveler.visitedNodes, () => { showEnding(g, ranked, dom); if (done) done(); });
  };
  g.io = io;

  dom.select.style.display = "none";
  dom.game.style.display = "block";
  await mapR.ready;   // 画像ロード完了を待ってから開始
  mapR.buildAvatars(chars);
  mapR.start();
  addEventListener("resize", () => { if (dom.game.style.display === "block") mapR.resize(); });

  let overview = false;
  dom.ovBtn.onclick = () => {
    overview = !overview;
    mapR.setOverview(overview);
    dom.ovBtn.textContent = overview ? "▲ クロースアップ" : "🗺 全体マップ";
  };

  /* サイコロ＋手詰まり復帰の安全網（学び6） */
  let recoverArmed = false;
  dom.rollBtn.onclick = () => {
    const p = g.players[g.cur];
    if (p.isNpc || g.ended) return;
    if (g.phase === "idle") { recoverArmed = false; mapR.recenter(); if (overview) { overview = false; mapR.setOverview(false); dom.ovBtn.textContent = "🗺 全体マップ"; } rollDice(g); return; }
    // 固まっている？ モーダルが開いていなければフラグ復帰、開いていれば2度目で強制クローズ
    const anyOpen = ["buildModal", "criticModal", "vintageModal", "marketModal", "fundModal", "saleModal", "cityModal", "cardModal", "quizModal", "slotModal"]
      .some(id => dom[id].style.display === "flex");
    if (!anyOpen && (g.phase === "rolling" || g.phase === "moving")) {
      // アニメ待ちの可能性が高いので一度は待つ
      if (recoverArmed) { g.phase = "idle"; g.movesLeft = 0; toast("↻ 進行を再開しました"); recoverArmed = false; }
      else { recoverArmed = true; toast("固まっていたら もう一度サイコロを押してください"); }
    }
  };

  // デバッグ・動作確認用ハンドル（本番挙動には影響しない）
  window.__vinroute = { g, uiState, mapR };

  startGame(g);
}
