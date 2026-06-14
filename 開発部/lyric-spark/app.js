// LyricSpark — テーマ/気分 → Suno用「歌詞＋スタイルプロンプト」を3案生成
// 完全クライアントサイド。ユーザー自身のAnthropic APIキーでブラウザから直接呼ぶ。

const MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";
const KEY_STORE = "lyricspark_api_key";
const FAV_STORE = "lyricspark_favorites";

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
function buildPrompt({ theme, mood, genre, lang }) {
  return `あなたはプロの作詞家であり、AI作曲ツール「Suno」のプロンプト設計に精通しています。
以下の条件で、Sunoにそのまま貼って使える楽曲案を【3案】作ってください。

条件:
- テーマ: ${theme}
- 気分・雰囲気: ${mood || "指定なし(テーマから適切に判断)"}
- ジャンルのヒント: ${genre || "指定なし(テーマに合うものを提案)"}
- 歌詞の言語: ${lang}

各案は次の3要素を含めること:
1. title: 曲のタイトル(短く印象的に)
2. style: Sunoの「Style of Music」欄に貼るスタイルプロンプト。ジャンル・楽器・テンポ・ボーカルの質感などを英語のタグ風カンマ区切りで(例: "city pop, warm electric piano, 90 bpm, female vocal, nostalgic")
3. lyrics: セクションタグ付きの歌詞。各セクションは [Verse] [Pre-Chorus] [Chorus] [Bridge] [Outro] のように角括弧タグで始めること。Sunoにそのまま貼れる形にすること。

3案はジャンルや切り口を少しずつ変えて、選ぶ楽しさがあるようにしてください。

出力は必ず次のJSON配列のみ(前後に説明文やマークダウンのコードブロックを付けない):
[
  {"title": "...", "style": "...", "lyrics": "..."},
  {"title": "...", "style": "...", "lyrics": "..."},
  {"title": "...", "style": "...", "lyrics": "..."}
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
      // ブラウザから直接叩くための明示的な許可ヘッダ
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
function parseVariants(text) {
  // 余計な前後テキストやコードブロックが付いても拾えるように配列部分を抽出
  let jsonStr = text.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  const start = jsonStr.indexOf("[");
  const end = jsonStr.lastIndexOf("]");
  if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1);

  const arr = JSON.parse(jsonStr);
  if (!Array.isArray(arr)) throw new Error("形式が配列ではありません");
  return arr.filter((v) => v && v.title && v.lyrics);
}

// ---- 描画 ---------------------------------------------------------------
function renderVariants(variants) {
  const root = $("results");
  root.innerHTML = "";
  variants.forEach((v) => {
    const card = document.createElement("div");
    card.className = "variant";
    card.innerHTML = `
      <h3></h3>
      <div class="style-line"><strong>style:</strong> <span class="v-style"></span></div>
      <pre class="lyrics"></pre>
      <div class="variant-actions">
        <button class="btn btn-ghost act-lyrics">歌詞をコピー</button>
        <button class="btn btn-ghost act-style">styleをコピー</button>
        <button class="btn btn-ghost act-both">両方コピー</button>
        <button class="btn btn-ghost act-fav">★ お気に入り</button>
      </div>`;
    card.querySelector("h3").textContent = v.title;
    card.querySelector(".v-style").textContent = v.style || "(なし)";
    card.querySelector(".lyrics").textContent = v.lyrics;

    const both = `${v.style ? "Style: " + v.style + "\n\n" : ""}${v.lyrics}`;
    card.querySelector(".act-lyrics").addEventListener("click", (e) => copy(v.lyrics, e.target));
    card.querySelector(".act-style").addEventListener("click", (e) => copy(v.style || "", e.target));
    card.querySelector(".act-both").addEventListener("click", (e) => copy(both, e.target));
    card.querySelector(".act-fav").addEventListener("click", () => addFavorite(v));

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

// ---- お気に入り ---------------------------------------------------------
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_STORE)) || []; }
  catch (_) { return []; }
}
function saveFavorites(list) { localStorage.setItem(FAV_STORE, JSON.stringify(list)); }
function addFavorite(v) {
  const list = getFavorites();
  list.unshift({ ...v, savedAt: Date.now() });
  saveFavorites(list);
  renderFavorites();
}
function renderFavorites() {
  const list = getFavorites();
  const section = $("favSection");
  const root = $("favList");
  section.hidden = list.length === 0;
  root.innerHTML = "";
  list.forEach((v, i) => {
    const row = document.createElement("div");
    row.className = "fav-item";
    row.innerHTML = `<span class="fav-title"></span>
      <span>
        <button class="btn btn-ghost fav-copy">コピー</button>
        <button class="fav-del">削除</button>
      </span>`;
    row.querySelector(".fav-title").textContent = v.title;
    const both = `${v.style ? "Style: " + v.style + "\n\n" : ""}${v.lyrics}`;
    row.querySelector(".fav-copy").addEventListener("click", (e) => copy(both, e.target));
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
  const errEl = $("error");
  errEl.hidden = true;

  const apiKey = (localStorage.getItem(KEY_STORE) || $("apiKey").value).trim();
  const theme = $("theme").value.trim();

  if (!apiKey) { showError("先にAnthropic APIキーを保存してください。"); return; }
  if (!theme) { showError("テーマを入力してください。"); return; }

  const params = {
    theme,
    mood: $("mood").value.trim(),
    genre: $("genre").value.trim(),
    lang: $("lang").value,
  };

  const btn = $("generate");
  btn.disabled = true;
  btn.textContent = "生成中…";
  $("results").innerHTML = `<div class="loading dots">歌詞を考えています</div>`;

  try {
    const text = await callClaude(buildPrompt(params), apiKey);
    const variants = parseVariants(text);
    if (variants.length === 0) throw new Error("案を取り出せませんでした。もう一度試してください。");
    renderVariants(variants);
  } catch (e) {
    $("results").innerHTML = "";
    showError(e.message || String(e));
  } finally {
    btn.disabled = false;
    btn.textContent = "3案つくる";
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
