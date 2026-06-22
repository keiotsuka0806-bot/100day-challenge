"use strict";

/* ============================================================
   AI乱入大喜利（各自デバイス版・リアルタイム同期）
   合言葉+QRで集合 → 各自のスマホでお題にボケる → 各自で投票 → 結果
   共有Firebase倉庫(Firestore)の ogiriRooms コレクションを使う。
   ホストが進行の主（人数が揃ったら自動で次フェーズへ）。AI不使用・コストゼロ。
   ============================================================ */

const $ = (id) => document.getElementById(id);
const screens = {
  top: $("screenTop"), create: $("screenCreate"), join: $("screenJoin"),
  lobby: $("screenLobby"), answer: $("screenAnswer"), wait: $("screenWait"),
  vote: $("screenVote"), reveal: $("screenReveal"), final: $("screenFinal"),
};
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("is-active"));
  screens[name].classList.add("is-active");
  window.scrollTo(0, 0);
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function msg(el, text, ok) {
  el.textContent = text;
  el.style.color = ok === false ? "#ffd23f" : "#fff";
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 3500);
}

/* ---------- 端末ID（匿名ログインのuidを使う） ---------- */
let PID = null;

/* ---------- Firebase ---------- */
let db = null, fbReady = false, authReady = false;
function initFirebase() {
  try {
    if (window.__noFirebaseConfig || !window.OGIRI_FIREBASE_CONFIG || !window.firebase) return false;
    firebase.initializeApp(window.OGIRI_FIREBASE_CONFIG);
    db = firebase.firestore();
    fbReady = true;
    firebase.auth().onAuthStateChanged((u) => { if (u) { PID = u.uid; authReady = true; } });
    firebase.auth().signInAnonymously().catch(() => {});
    return true;
  } catch (e) { return (fbReady = false); }
}

/* ---------- 状態 ---------- */
const S = {
  code: null, isHost: false, name: "",
  totalRounds: 3,
  room: null,            // 最新のroomデータ
  curRound: 0,
  answers: [],           // 現ラウンドの回答 [{pid,name,text}]
  votes: [],             // 現ラウンドの投票 [{voter,target}]
  roomUnsub: null, ansUnsub: null, voteUnsub: null,
  lastScreen: null, voteRendered: false, advancing: false,
};

function roomRef() { return db.collection("ogiriRooms").doc(S.code); }
function ansCol() { return roomRef().collection("answers"); }
function voteCol() { return roomRef().collection("votes"); }

/* ============================================================
   画面遷移ボタン
   ============================================================ */
$("toCreate").addEventListener("click", () => { ensureFb(() => showScreen("create")); });
$("toJoin").addEventListener("click", () => { ensureFb(() => { prefillCode(); showScreen("join"); }); });
$("createBack").addEventListener("click", () => showScreen("top"));
$("joinBack").addEventListener("click", () => showScreen("top"));

function ensureFb(then) {
  if (!fbReady) { alert("オンライン対戦には接続が必要です。電波のよい場所で開き直してください。"); return; }
  if (authReady && PID) return then();
  // 匿名ログインの完了を少し待つ
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (authReady && PID) { clearInterval(iv); then(); }
    else if (Date.now() - t0 > 6000) { clearInterval(iv); alert("接続に時間がかかっています。電波のよい場所で開き直してください。"); }
  }, 150);
}
function prefillCode() {
  const u = new URL(location.href);
  const c = (u.searchParams.get("room") || "").toUpperCase();
  if (c) $("joinCode").value = c;
}

/* ラウンド数カウンター */
function renderRounds() { $("roundCount").textContent = S.totalRounds; }
$("rMinus").addEventListener("click", () => { S.totalRounds = Math.max(1, S.totalRounds - 1); renderRounds(); });
$("rPlus").addEventListener("click", () => { S.totalRounds = Math.min(8, S.totalRounds + 1); renderRounds(); });

/* ============================================================
   部屋を作る
   ============================================================ */
function genCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 紛らわしいI/Oを除外
  let c = ""; for (let i = 0; i < 4; i++) c += letters[(Math.random() * letters.length) | 0];
  return c;
}

$("createRoom").addEventListener("click", async () => {
  const name = $("hostName").value.trim() || "ホスト";
  S.name = name; S.isHost = true; S.code = genCode();
  const players = {}; players[PID] = { name, score: 0, joinedAt: Date.now() };
  try {
    await roomRef().set({
      code: S.code, hostId: PID, state: "lobby",
      totalRounds: S.totalRounds, round: 0, roundPrompts: [], prompt: "",
      aiEnabled: $("aiToggle").checked, aiScore: 0,
      players, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    subscribeRoom();
  } catch (e) {
    msg($("createMsg"), "部屋を作れませんでした。少し待って再試行してください。", false);
  }
});

/* ============================================================
   部屋に参加
   ============================================================ */
$("joinRoom").addEventListener("click", async () => {
  const code = $("joinCode").value.trim().toUpperCase();
  const name = $("joinName").value.trim();
  if (code.length !== 4) return msg($("joinMsg"), "合言葉は4文字です", false);
  if (!name) return msg($("joinMsg"), "名前を入れてね", false);
  S.code = code; S.name = name; S.isHost = false;
  try {
    const snap = await roomRef().get();
    if (!snap.exists) return msg($("joinMsg"), "その合言葉の部屋は見つかりません", false);
    const data = snap.data();
    if (data.state !== "lobby") return msg($("joinMsg"), "そのゲームはもう始まっています", false);
    const upd = {}; upd[`players.${PID}`] = { name, score: 0, joinedAt: Date.now() };
    await roomRef().update(upd);
    subscribeRoom();
  } catch (e) {
    msg($("joinMsg"), "参加できませんでした。合言葉を確認してね", false);
  }
});

/* ============================================================
   購読
   ============================================================ */
function subscribeRoom() {
  if (S.roomUnsub) S.roomUnsub();
  S.roomUnsub = roomRef().onSnapshot((snap) => {
    if (!snap.exists) { alert("部屋が閉じられました。"); leave(); return; }
    S.room = snap.data();
    S.isHost = S.room.hostId === PID;
    if (S.room.round !== S.curRound) { S.curRound = S.room.round; subscribeRound(S.curRound); }
    render();
    hostTick();
  }, () => msg($("lobbyMsg"), "接続が不安定です…", false));
}

function subscribeRound(r) {
  if (S.ansUnsub) S.ansUnsub();
  if (S.voteUnsub) S.voteUnsub();
  S.answers = []; S.votes = []; S.voteRendered = false; S.lastScreen = null; // 再戦時に入力欄をクリアし直す
  if (!r) return;
  S.ansUnsub = ansCol().where("round", "==", r).onSnapshot((snap) => {
    S.answers = snap.docs.map((d) => d.data());
    render(); hostTick();
  });
  S.voteUnsub = voteCol().where("round", "==", r).onSnapshot((snap) => {
    S.votes = snap.docs.map((d) => d.data());
    render(); hostTick();
  });
}

/* ============================================================
   ホストによる進行
   ============================================================ */
$("startGame").addEventListener("click", () => {
  if (!S.isHost || !S.room) return;
  const total = S.room.totalRounds;
  const order = shuffle(window.OGIRI_PROMPTS.map((_, i) => i)).slice(0, total);
  const roundPrompts = order.map((i) => window.OGIRI_PROMPTS[i]);
  roomRef().update({ state: "answer", round: 1, roundPrompts, prompt: roundPrompts[0] });
});

function playerCount() { return Object.keys((S.room && S.room.players) || {}).length; }
function humanAnswers() { return S.answers.filter((a) => a.pid !== "AI"); }

/* ホストの定期処理：AIのボケ生成＋フェーズ進行 */
function hostTick() {
  if (!S.isHost || !S.room) return;
  hostAiEffect();
  maybeAdvance();
}

/* AIのボケ（各ラウンド1回だけ生成して書き込む） */
let aiGenRound = 0;
async function hostAiEffect() {
  if (!S.room.aiEnabled || S.room.state !== "answer") return;
  if (aiGenRound === S.curRound) return;
  if (S.answers.some((a) => a.pid === "AI")) { aiGenRound = S.curRound; return; }
  aiGenRound = S.curRound; // await前にロック（二重生成防止）
  const text = await generateAiBoke(S.room.prompt);
  try {
    await ansCol().doc(`${S.curRound}_AI`).set({ round: S.curRound, pid: "AI", name: "🤖 AI", text, ts: Date.now() });
  } catch (e) {}
}

async function generateAiBoke(prompt) {
  try {
    // 応答が遅い時に進行が止まらないよう8秒で打ち切ってモックに切替
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("/api/ai-boke", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }), signal: ctrl.signal,
    });
    clearTimeout(to);
    if (res.ok) { const d = await res.json(); if (d && d.text) return String(d.text).slice(0, 40); }
  } catch (e) {}
  return pick(AI_MOCK); // 鍵未設定/失敗/遅延時は「とぼけるAI」キャラで参加
}
const AI_MOCK = [
  "それは企業秘密です",
  "計算の結果、ノーコメント",
  "人間には早すぎる回答です",
  "ぴぽぱ…回答の生成に失敗しました(嘘)",
  "学習データに無かったので直感で",
  "それ、さっき私も考えてました",
  "倫理的配慮により伏せます",
  "深層学習の末、たどり着いた答えが「無」",
];

function maybeAdvance() {
  if (!S.isHost || !S.room || S.advancing) return;
  const n = playerCount();
  if (S.room.state === "answer") {
    const humansDone = humanAnswers().length >= n && n > 0;
    const aiReady = !S.room.aiEnabled || S.answers.some((a) => a.pid === "AI");
    if (humansDone && aiReady) {
      S.advancing = true;
      roomRef().update({ state: "vote" }).finally(() => { S.advancing = false; });
    }
  } else if (S.room.state === "vote" && S.votes.length >= n && n > 0) {
    S.advancing = true;
    tallyAndReveal().finally(() => { S.advancing = false; });
  }
}

function hostForce() {
  if (!S.isHost || !S.room) return;
  if (S.room.state === "answer") roomRef().update({ state: "vote" });
  else if (S.room.state === "vote") tallyAndReveal();
}
$("hostSkip").addEventListener("click", hostForce);

async function tallyAndReveal() {
  const players = { ...(S.room.players || {}) };
  const counts = {};
  S.votes.forEach((v) => { counts[v.target] = (counts[v.target] || 0) + 1; });
  Object.keys(counts).forEach((pid) => {
    if (pid === "AI") return;
    if (players[pid]) players[pid] = { ...players[pid], score: (players[pid].score || 0) + counts[pid] };
  });
  const aiScore = (S.room.aiScore || 0) + (counts["AI"] || 0);
  await roomRef().update({ players, aiScore, state: "reveal" });
}

$("revealNext").addEventListener("click", () => {
  if (!S.isHost || !S.room) return;
  if (S.room.round < S.room.totalRounds) {
    const next = S.room.round + 1;
    roomRef().update({ round: next, prompt: S.room.roundPrompts[next - 1], state: "answer" });
  } else {
    roomRef().update({ state: "final" });
  }
});

$("playAgain").addEventListener("click", () => {
  if (!S.isHost || !S.room) return;
  // ロビーに戻す（得点リセット）
  const players = {};
  Object.entries(S.room.players || {}).forEach(([pid, p]) => { players[pid] = { ...p, score: 0 }; });
  aiGenRound = 0;
  roomRef().update({ state: "lobby", round: 0, prompt: "", roundPrompts: [], players, aiScore: 0 });
});

/* ============================================================
   入力・投票
   ============================================================ */
$("answerInput").addEventListener("input", (e) => { $("answerCount").textContent = [...e.target.value].length; });
$("submitAnswer").addEventListener("click", async () => {
  const text = $("answerInput").value.trim();
  if ([...text].length < 1) return msg($("answerMsg"), "ひと言だけでも書いてね", false);
  if (hasNG(text)) return msg($("answerMsg"), "その言葉はやめておこう。別のボケで！", false);
  try {
    await ansCol().doc(`${S.curRound}_${PID}`).set({ round: S.curRound, pid: PID, name: S.name, text, ts: Date.now() });
  } catch (e) { msg($("answerMsg"), "送信に失敗。もう一度試してね", false); }
});

async function castVote(targetPid) {
  try {
    await voteCol().doc(`${S.curRound}_${PID}`).set({ round: S.curRound, voter: PID, target: targetPid, ts: Date.now() });
  } catch (e) { msg($("voteMsg"), "投票に失敗。もう一度試してね", false); }
}

/* ============================================================
   描画
   ============================================================ */
function render() {
  if (!S.room) return;
  const st = S.room.state;

  if (st === "lobby") return renderLobby();
  if (st === "answer") {
    const mine = S.answers.some((a) => a.pid === PID);
    if (mine) return renderWait("answer");
    return renderAnswer();
  }
  if (st === "vote") {
    const mine = S.votes.some((v) => v.voter === PID);
    if (mine) return renderWait("vote");
    return renderVote();
  }
  if (st === "reveal") return renderReveal();
  if (st === "final") return renderFinal();
}

function renderLobby() {
  showScreen("lobby");
  $("lobbyCode").textContent = S.code;
  // QR
  const qrEl = $("qr");
  const url = `${location.origin}${location.pathname}?room=${S.code}`;
  if (qrEl && qrEl.dataset.code !== S.code) {
    try {
      const qr = qrcode(0, "M"); qr.addData(url); qr.make();
      qrEl.innerHTML = qr.createImgTag(8, 12); // 大きめセルで生成→CSSでくっきり表示
      qrEl.dataset.code = S.code;
    } catch (e) { qrEl.innerHTML = ""; }
  }
  const urlEl = $("lobbyUrl");
  if (urlEl) urlEl.textContent = url;
  const players = S.room.players || {};
  const list = $("lobbyPlayers");
  list.innerHTML = Object.values(players)
    .map((p) => `<span class="playerChip">${escapeHtml(p.name)}</span>`).join("");
  const count = Object.keys(players).length;
  const enough = count >= 2;
  $("playersCount").textContent = `参加者 ${count}人`;
  $("lobbyHostArea").hidden = !S.isHost;
  $("startGame").disabled = !enough;
  $("startGame").textContent = enough ? "ゲーム開始（あとから参加もOK）" : "あと" + (2 - count) + "人で開始できます";
  $("lobbyWait").style.display = S.isHost ? "none" : "block";
}

function renderAnswer() {
  if (S.lastScreen !== "answer" + S.curRound) {
    $("answerInput").value = ""; $("answerCount").textContent = "0"; $("answerMsg").textContent = "";
    S.lastScreen = "answer" + S.curRound;
  }
  $("answerRound").textContent = `第${S.room.round}問`;
  $("answerPrompt").textContent = S.room.prompt;
  showScreen("answer");
}

function renderWait(kind) {
  showScreen("wait");
  const n = playerCount();
  if (kind === "answer") {
    $("waitText").textContent = "みんながボケ中…";
    $("waitCount").textContent = `${humanAnswers().length} / ${n} 人 回答`;
  } else {
    $("waitText").textContent = "みんなが投票中…";
    $("waitCount").textContent = `${S.votes.length} / ${n} 人 投票`;
  }
  $("hostSkip").hidden = !S.isHost;
}

function renderVote() {
  $("voteRound").textContent = `第${S.room.round}問`;
  $("votePrompt").textContent = S.room.prompt;
  // 同ラウンドの回答が変わらない限り作り直さない
  const sig = S.curRound + ":" + S.answers.map((a) => a.pid).sort().join(",");
  if (S.voteRendered !== sig) {
    const list = $("voteList");
    list.innerHTML = "";
    const shuffled = shuffle(S.answers);
    shuffled.forEach((a, idx) => {
      const btn = document.createElement("button");
      btn.className = "voteItem";
      btn.innerHTML = `<span class="voteItem__mark">${String.fromCharCode(65 + idx)}</span><span class="voteItem__text">${escapeHtml(a.text)}</span>`;
      if (a.pid === PID) {
        btn.disabled = true; btn.classList.add("is-own");
        btn.innerHTML += `<span class="voteItem__own">あなた</span>`;
      } else {
        btn.addEventListener("click", () => castVote(a.pid));
      }
      list.appendChild(btn);
    });
    $("voteMsg").textContent = "";
    S.voteRendered = sig;
  }
  showScreen("vote");
}

function renderReveal() {
  $("revealTitle").textContent = `第${S.room.round}問の結果`;
  const counts = {};
  S.votes.forEach((v) => { counts[v.target] = (counts[v.target] || 0) + 1; });
  const ranked = S.answers
    .map((a) => ({ ...a, votes: counts[a.pid] || 0 }))
    .sort((x, y) => y.votes - x.votes);
  const list = $("revealList");
  list.innerHTML = "";
  ranked.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "rrRow" + (i === 0 && a.votes > 0 ? " is-top" : "");
    row.innerHTML =
      `<div class="rrRow__head"><span class="rrRow__rank">${i === 0 && a.votes > 0 ? "🏆" : i + 1}</span>` +
      `<span class="rrRow__votes">${a.votes}票</span></div>` +
      `<p class="rrRow__text">${escapeHtml(a.text)}</p>` +
      `<span class="rrRow__author">${escapeHtml(a.name)}</span>`;
    list.appendChild(row);
  });
  const top = ranked[0];
  $("revealMc").textContent = top && top.votes > 0
    ? `${escapeHtml(top.name)}「${escapeHtml(top.text)}」 — ${pick(window.MC_LINES)}`
    : "今回は票が割れました。次いきましょう！";
  $("revealNext").hidden = !S.isHost;
  $("revealNext").textContent = S.room.round < S.room.totalRounds ? "次の問題へ" : "優勝者を発表！";
  $("revealWait").style.display = S.isHost ? "none" : "block";
  showScreen("reveal");
}

function renderFinal() {
  const board = Object.values(S.room.players || {})
    .map((p) => ({ name: p.name, score: p.score || 0 }));
  if (S.room.aiEnabled) board.push({ name: "🤖 AI", score: S.room.aiScore || 0 });
  board.sort((a, b) => b.score - a.score);
  const champ = board[0];
  $("finalChamp").textContent = champ ? champ.name : "—";
  $("finalMc").textContent = pick(window.CHAMP_LINES);
  const el = $("finalBoard");
  el.innerHTML = "";
  board.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "boardRow" + (i === 0 ? " is-champ" : "");
    row.innerHTML =
      `<span class="boardRow__rank">${["🥇", "🥈", "🥉"][i] || (i + 1)}</span>` +
      `<span class="boardRow__name">${escapeHtml(b.name)}</span>` +
      `<span class="boardRow__score">${b.score}票</span>`;
    el.appendChild(row);
  });
  S._board = board;
  $("playAgain").hidden = !S.isHost;
  showScreen("final");
}

$("copyFinal").addEventListener("click", async () => {
  const board = S._board || [];
  const lines = board.map((b, i) => `${["🥇", "🥈", "🥉"][i] || (i + 1) + "位"} ${b.name}：${b.score}票`).join("\n");
  const text = `【AI乱入大喜利】結果\n\n${lines}\n\n#AI乱入大喜利`;
  try { await navigator.clipboard.writeText(text); msg($("finalMsg"), "コピーしました！"); }
  catch { msg($("finalMsg"), "コピーできませんでした。長押しで選択してね", false); }
});

$("copyInvite").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}?room=${S.code}`;
  const text = `AI乱入大喜利やろう！\n合言葉「${S.code}」\n${url}`;
  try { await navigator.clipboard.writeText(text); msg($("lobbyMsg"), "招待をコピーしました！"); }
  catch { msg($("lobbyMsg"), "コピーできませんでした", false); }
});

$("leaveRoom").addEventListener("click", leave);
function leave() {
  if (S.roomUnsub) S.roomUnsub();
  if (S.ansUnsub) S.ansUnsub();
  if (S.voteUnsub) S.voteUnsub();
  Object.assign(S, { code: null, isHost: false, room: null, curRound: 0, answers: [], votes: [], roomUnsub: null, ansUnsub: null, voteUnsub: null });
  showScreen("top");
}

/* ---------- NG ---------- */
const NG = ["死ね", "殺す", "ぶっ殺", "氏ね", "fuck", "shit", "レイプ"];
function hasNG(t) { const s = t.toLowerCase(); return NG.some((w) => s.includes(w.toLowerCase())); }

/* ---------- 起動 ---------- */
initFirebase();
renderRounds();
prefillCode();
if (new URL(location.href).searchParams.get("room")) showScreen("join");
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
