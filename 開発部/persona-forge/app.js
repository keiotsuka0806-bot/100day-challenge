// PersonaForge — 記事/プロダクトのテーマ → 想定読者N=1を3人生成
// 完全クライアントサイド。ユーザー自身のAnthropic APIキーでブラウザから直接呼ぶ。

const MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";
const KEY_STORE = "personaforge_api_key";
const FAV_STORE = "personaforge_saved";

const $ = (id) => document.getElementById(id);

// ---- APIキーの保存/復元 -------------------------------------------------
function loadKey() {
  const k = localStorage.getItem(KEY_STORE) || "";
  if (k) {
    $("apiKey").value = k;
    setKeyStatus("保存済み", true);
  }
}
function setKeyStatus(text, ok) {
  const el = $("keyStatus");
  el.textContent = text;
  el.classList.toggle("ok", !!ok);
}
$("saveKey").addEventListener("click", () => {
  const k = $("apiKey").value.trim();
  if (!k) { setKeyStatus("キーが空です", false); return; }
  localStorage.setItem(KEY_STORE, k);
  setKeyStatus("保存しました", true);
});

// ---- プロンプト組み立て -------------------------------------------------
function buildPrompt({ theme, goal, medium }) {
  return `あなたはコンテンツマーケティングのプロで、「N=1ペルソナ(たった一人の具体的な読者像)」設計が得意です。
以下のテーマについて、届けるべき想定読者を【3人】、それぞれ別タイプで具体的に作ってください。

- テーマ: ${theme}
- 媒体: ${medium}
- 狙い: ${goal || "指定なし(テーマから適切に判断)"}

「全員向け」ではなく、一人の生活が目に浮かぶレベルまで具体化してください(年齢層・職業・状況など)。
各ペルソナは次の項目を含めること:
- name: ニックネーム的な短い呼び名(例:「夜ふかしの企画者ミナ」)
- situation: その人の状況を1〜2文で(年代・仕事・生活)
- pain: いま抱えている悩み・不満を1〜2文で
- quotes: その人が言いそうな口ぐせ(2〜3個の短い言葉、配列)
- hooks: この人に刺さる切り口・言葉(2〜3個、配列)
- turnoffs: 逆に響かない/避けるべき言葉や切り口(1〜2個、配列)
- lead: この人に向けた、媒体に合う「冒頭の一行リード案」(その人が続きを読みたくなる1〜2文)

出力は必ず次のJSON配列のみ(前後に説明文やマークダウンのコードブロックを付けない):
[
  {"name":"...","situation":"...","pain":"...","quotes":["...","..."],"hooks":["...","..."],"turnoffs":["..."],"lead":"..."},
  {"name":"...","situation":"...","pain":"...","quotes":["...","..."],"hooks":["...","..."],"turnoffs":["..."],"lead":"..."},
  {"name":"...","situation":"...","pain":"...","quotes":["...","..."],"hooks":["...","..."],"turnoffs":["..."],"lead":"..."}
]`;
}

// ---- Claude API 呼び出し ------------------------------------------------
async function callClaude(promptText, apiKey) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: "user", content: promptText }],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch (_) {}
    throw new Error(httpErrorMessage(res.status, detail));
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("応答にテキストが含まれていませんでした。");
  return textBlock.text;
}

function httpErrorMessage(status, detail) {
  const base = {
    401: "APIキーが正しくないようです。キーを確認してください。",
    403: "このキーではアクセスできません(権限・残高をご確認ください)。",
    429: "リクエストが多すぎます。少し待って再実行してください。",
    529: "Anthropic側が混雑しています。少し待って再実行してください。",
  }[status];
  const msg = base || `エラーが発生しました (HTTP ${status})。`;
  return detail ? `${msg}\n${detail}` : msg;
}

// ---- 応答JSONの安全な抽出 -----------------------------------------------
function parsePersonas(text) {
  let jsonStr = text.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  const start = jsonStr.indexOf("[");
  const end = jsonStr.lastIndexOf("]");
  if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1);

  const arr = JSON.parse(jsonStr);
  if (!Array.isArray(arr)) throw new Error("形式が配列ではありません");
  return arr.filter((p) => p && p.name);
}

// ---- 描画ヘルパ ---------------------------------------------------------
function asList(arr) {
  const items = (Array.isArray(arr) ? arr : [arr]).filter(Boolean);
  return items.length ? "<ul>" + items.map((x) => `<li>${escapeHtml(x)}</li>`).join("") + "</ul>" : "";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function personaToText(p) {
  const lines = (a) => (Array.isArray(a) ? a : [a]).filter(Boolean).map((x) => "・" + x).join("\n");
  return [
    `【${p.name}】`,
    `状況: ${p.situation || ""}`,
    `悩み: ${p.pain || ""}`,
    `口ぐせ:\n${lines(p.quotes)}`,
    `刺さる切り口:\n${lines(p.hooks)}`,
    `避ける言葉:\n${lines(p.turnoffs)}`,
    `一行リード案: ${p.lead || ""}`,
  ].join("\n");
}

function renderPersonas(personas) {
  const root = $("results");
  root.innerHTML = "";
  personas.forEach((p) => {
    const card = document.createElement("div");
    card.className = "persona";
    card.innerHTML = `
      <h3>${escapeHtml(p.name)}</h3>
      <p class="situation">${escapeHtml(p.situation || "")}</p>
      <div class="p-block"><span class="p-label">悩み</span><div class="p-body">${escapeHtml(p.pain || "")}</div></div>
      <div class="p-block"><span class="p-label">口ぐせ</span>${asList(p.quotes)}</div>
      <div class="p-block"><span class="p-label">刺さる切り口</span>${asList(p.hooks)}</div>
      <div class="p-block"><span class="p-label">避ける言葉</span>${asList(p.turnoffs)}</div>
      <div class="lead"><span class="p-label">この人への一行リード案</span>${escapeHtml(p.lead || "")}</div>
      <div class="persona-actions">
        <button class="btn btn-ghost act-lead">リードをコピー</button>
        <button class="btn btn-ghost act-all">全文をコピー</button>
        <button class="btn btn-ghost act-fav">★ 保存</button>
      </div>`;
    card.querySelector(".act-lead").addEventListener("click", (e) => copy(p.lead || "", e.target));
    card.querySelector(".act-all").addEventListener("click", (e) => copy(personaToText(p), e.target));
    card.querySelector(".act-fav").addEventListener("click", () => addFavorite(p));
    root.appendChild(card);
  });
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const old = btn.textContent;
    btn.textContent = "コピーしました ✓";
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = old; btn.classList.remove("copied"); }, 1400);
  } catch (_) {
    alert("コピーに失敗しました。手動で選択してください。");
  }
}

// ---- 保存したペルソナ ---------------------------------------------------
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_STORE)) || []; }
  catch (_) { return []; }
}
function saveFavorites(list) { localStorage.setItem(FAV_STORE, JSON.stringify(list)); }
function addFavorite(p) {
  const list = getFavorites();
  list.unshift({ ...p, savedAt: Date.now() });
  saveFavorites(list);
  renderFavorites();
}
function renderFavorites() {
  const list = getFavorites();
  $("favSection").hidden = list.length === 0;
  const root = $("favList");
  root.innerHTML = "";
  list.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "fav-item";
    row.innerHTML = `<span class="fav-title"></span>
      <span>
        <button class="btn btn-ghost fav-copy">コピー</button>
        <button class="fav-del">削除</button>
      </span>`;
    row.querySelector(".fav-title").textContent = p.name;
    row.querySelector(".fav-copy").addEventListener("click", (e) => copy(personaToText(p), e.target));
    row.querySelector(".fav-del").addEventListener("click", () => {
      const cur = getFavorites();
      cur.splice(i, 1);
      saveFavorites(cur);
      renderFavorites();
    });
    root.appendChild(row);
  });
}

// ---- 生成フロー ---------------------------------------------------------
$("generate").addEventListener("click", async () => {
  $("error").hidden = true;

  const apiKey = (localStorage.getItem(KEY_STORE) || $("apiKey").value).trim();
  const theme = $("theme").value.trim();
  if (!apiKey) { showError("先にAnthropic APIキーを保存してください。"); return; }
  if (!theme) { showError("テーマを入力してください。"); return; }

  const params = {
    theme,
    goal: $("goal").value.trim(),
    medium: $("medium").value,
  };

  const btn = $("generate");
  btn.disabled = true;
  btn.textContent = "生成中…";
  $("results").innerHTML = `<div class="loading dots">読者を想像しています</div>`;

  try {
    const text = await callClaude(buildPrompt(params), apiKey);
    const personas = parsePersonas(text);
    if (personas.length === 0) throw new Error("ペルソナを取り出せませんでした。もう一度試してください。");
    renderPersonas(personas);
  } catch (e) {
    $("results").innerHTML = "";
    showError(e.message || String(e));
  } finally {
    btn.disabled = false;
    btn.textContent = "読者を3人つくる";
  }
});

function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.hidden = false;
}

// ---- 起動 ---------------------------------------------------------------
loadKey();
renderFavorites();
