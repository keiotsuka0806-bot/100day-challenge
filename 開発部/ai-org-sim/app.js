// AIOrgSim フロントエンド。仮説を /api/simulate に投げ、寸劇を描画する。
const HISTORY_KEY = "aiorgsim_history_v1";

const $ = (id) => document.getElementById(id);
const elInput = $("hypothesis");
const elRun = $("run");
const elStatus = $("status");
const elResult = $("result");
const elScenes = $("scenes");
const elGood = $("good");
const elRisk = $("risk");
const elSummary = $("summary");
const elHistoryWrap = $("history-wrap");
const elHistory = $("history");

// 例チップ → 入力欄へ
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    elInput.value = chip.textContent.trim();
    elInput.focus();
  });
});

elRun.addEventListener("click", run);

async function run() {
  const hypothesis = elInput.value.trim();
  if (!hypothesis) {
    elInput.focus();
    return;
  }

  setLoading(true);
  elResult.hidden = true;
  showStatus("5つの部署が会議室に集まっています…");

  try {
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hypothesis }),
    });
    const data = await res.json();

    if (data.error) {
      showStatus("⚠️ " + data.error);
      return;
    }

    render(data);
    saveHistory(hypothesis);
    hideStatus();
  } catch (e) {
    showStatus("⚠️ 通信に失敗しました。少し待って再試行してください。");
  } finally {
    setLoading(false);
  }
}

function render(data) {
  elScenes.innerHTML = "";
  (data.scenes || []).forEach((s) => {
    const div = document.createElement("div");
    div.className = "scene";
    const sp = document.createElement("div");
    sp.className = "speaker";
    sp.textContent = s.speaker;
    const tx = document.createElement("p");
    tx.className = "text";
    tx.textContent = s.text;
    div.append(sp, tx);
    elScenes.appendChild(div);
  });

  fillList(elGood, data.good_changes);
  fillList(elRisk, data.risks);
  elSummary.textContent = data.summary || "";

  elResult.hidden = false;
  elResult.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillList(ul, items) {
  ul.innerHTML = "";
  (items || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    ul.appendChild(li);
  });
}

function setLoading(on) {
  elRun.disabled = on;
  elRun.textContent = on ? "演じています…" : "寸劇をはじめる";
}
function showStatus(msg) {
  elStatus.textContent = msg;
  elStatus.hidden = false;
}
function hideStatus() {
  elStatus.hidden = true;
}

// 履歴(localStorage)
function saveHistory(hypothesis) {
  const list = loadHistory().filter((h) => h !== hypothesis);
  list.unshift(hypothesis);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
  renderHistory();
}
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}
function renderHistory() {
  const list = loadHistory();
  if (!list.length) {
    elHistoryWrap.hidden = true;
    return;
  }
  elHistory.innerHTML = "";
  list.forEach((h) => {
    const li = document.createElement("li");
    li.textContent = h;
    li.addEventListener("click", () => {
      elInput.value = h;
      window.scrollTo({ top: 0, behavior: "smooth" });
      elInput.focus();
    });
    elHistory.appendChild(li);
  });
  elHistoryWrap.hidden = false;
}
renderHistory();

// PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
