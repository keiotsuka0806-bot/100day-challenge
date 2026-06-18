/* GlassFactory v1 — 「今日の一日」リプレイ */
(function () {
  "use strict";
  const DATA = window.GLASS_DATA;
  const DEPTS = ["運用部", "記憶庫", "企画部", "開発部", "社長"];

  const $ = (id) => document.getElementById(id);
  const intro = $("intro");
  const stage = $("stage");
  const feed = $("feed");
  const lanesEl = $("lanes");
  const trackFill = $("trackFill");
  const counter = $("counter");
  const playBtn = $("playBtn");
  const speedBtn = $("speedBtn");

  // 状態
  let idx = 0;               // 次に出すイベント番号
  let playing = false;
  let timer = null;
  const SPEEDS = [1, 1.5, 2, 0.5];
  let speedI = 0;
  const BASE_DELAY = 2600;   // 1イベントあたりの基本間隔(ms)

  // ---- 凡例(レーン)を作る ----
  DEPTS.forEach((d) => {
    const el = document.createElement("div");
    el.className = "lane";
    el.dataset.dept = d;
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.style.setProperty("--c", `var(--c-${d})`);
    el.innerHTML = `<span class="dot"></span>${d}`;
    el.addEventListener("click", () => openDept(d));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDept(d); } });
    lanesEl.appendChild(el);
  });

  function highlightLane(dept) {
    lanesEl.querySelectorAll(".lane").forEach((l) => {
      l.classList.toggle("active", l.dataset.dept === dept);
    });
  }

  function updateProgress() {
    const total = DATA.events.length;
    trackFill.style.width = `${(idx / total) * 100}%`;
    counter.textContent = `${Math.min(idx, total)} / ${total}`;
  }

  // ---- 1イベントを描画 ----
  function renderEvent(ev) {
    const card = document.createElement("article");
    card.className = "card type-" + ev.type;
    if (ev.human) card.classList.add("human");
    if (ev.finale) card.classList.add("finale");
    card.style.setProperty("--c", `var(--c-${ev.dept})`);

    const tag = ev.tag ? `<span class="tag">${ev.tag === "本命" ? "★ 本命" : ev.tag}</span>` : "";
    const rule = ev.rule
      ? `<div class="rule">
           <div class="rule-label">⚙️ このとき効いていた社内ルール</div>
           <div class="rule-src">${ev.rule.src}</div>
           <p class="rule-text">${ev.rule.text}</p>
         </div>`
      : "";
    card.innerHTML = `
      <div class="card-head">
        <span class="badge">${ev.dept}</span>
        <span class="type">${ev.type}</span>
        <span class="time">${ev.t}</span>
      </div>
      <h3>${ev.title}</h3>
      <p>${ev.body}</p>
      ${tag}
      ${rule}
    `;
    feed.appendChild(card);
    highlightLane(ev.dept);

    // 新しいカードへスクロール
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    if (ev.finale) {
      burst();
    }
  }

  // ---- 1ステップ進める ----
  function step() {
    if (idx >= DATA.events.length) {
      stop();
      return;
    }
    renderEvent(DATA.events[idx]);
    idx += 1;
    updateProgress();

    if (idx >= DATA.events.length) {
      stop(); // 最後まで来たら停止
    }
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (!playing || idx >= DATA.events.length) return;
    const delay = BASE_DELAY / SPEEDS[speedI];
    timer = setTimeout(() => {
      step();
      scheduleNext();
    }, delay);
  }

  function play() {
    if (idx >= DATA.events.length) restart();
    playing = true;
    playBtn.textContent = "⏸";
    if (idx === 0) step();      // 最初のカードを即時表示
    scheduleNext();
  }

  function stop() {
    playing = false;
    playBtn.textContent = idx >= DATA.events.length ? "⟲" : "▶";
    clearTimeout(timer);
  }

  function togglePlay() {
    if (playing) stop();
    else play();
  }

  function restart() {
    clearTimeout(timer);
    feed.innerHTML = "";
    idx = 0;
    updateProgress();
    highlightLane(null);
  }

  // ---- フィナーレの光の粒 ----
  function burst() {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      const size = 4 + Math.random() * 6;
      const hue = [210, 260, 45][i % 3];
      Object.assign(p.style, {
        position: "fixed",
        left: "50%",
        top: "40%",
        width: size + "px",
        height: size + "px",
        borderRadius: "50%",
        background: `hsl(${hue} 90% 70%)`,
        boxShadow: `0 0 12px hsl(${hue} 90% 70%)`,
        pointerEvents: "none",
        zIndex: 50,
      });
      document.body.appendChild(p);
      const ang = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 220;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist - 60;
      p.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0)`, opacity: 0 },
        ],
        { duration: 1100 + Math.random() * 700, easing: "cubic-bezier(.2,.7,.2,1)" }
      ).onfinish = () => p.remove();
    }
  }

  // ---- イベント配線 ----
  $("startBtn").addEventListener("click", () => {
    intro.classList.add("hidden");
    stage.classList.remove("hidden");
    $("headDate").textContent = `${DATA.date} ・ ${DATA.title}`;
    updateProgress();
    play();
  });

  playBtn.addEventListener("click", togglePlay);
  $("restartBtn").addEventListener("click", () => { restart(); play(); });
  $("nextBtn").addEventListener("click", () => {
    stop();
    step();
  });
  speedBtn.addEventListener("click", () => {
    speedI = (speedI + 1) % SPEEDS.length;
    speedBtn.textContent = "×" + SPEEDS[speedI];
    if (playing) scheduleNext();
  });

  // ---- ルールパネル ----
  const RULES = window.GLASS_RULES;
  const panel = $("panel");
  const wasPlaying = { v: false };

  function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

  function openPanel({ color, badge, title, role, html }) {
    const box = $("panelBox");
    box.style.setProperty("--c", color);
    $("panelBadge").textContent = badge;
    $("panelTitle").textContent = title;
    $("panelRole").textContent = role || "";
    $("panelBody").innerHTML = html;
    panel.classList.remove("hidden");
    // 見学中ならパネルを開いている間は一時停止
    wasPlaying.v = playing;
    if (playing) stop();
  }

  function closePanel() {
    panel.classList.add("hidden");
    if (wasPlaying.v && idx < DATA.events.length) play();
  }

  function openDept(dept) {
    const d = RULES.depts[dept];
    if (!d) return;
    const items = d.rules.map((r, i) =>
      `<div class="rule-item"><span class="num">${i + 1}</span><span>${esc(r)}</span></div>`
    ).join("");
    openPanel({
      color: `var(--c-${dept})`,
      badge: dept === "社長" ? "社長 ・ 人間" : dept,
      title: dept + " の規程",
      role: d.role,
      html: items,
    });
  }

  function openCompany() {
    const c = RULES.company;
    const html = c.sections.map((s) => {
      const items = s.items.map((it) =>
        `<div class="rule-item"><span class="num">§</span><span>${esc(it)}</span></div>`
      ).join("");
      return `<div class="panel-section"><h3>${esc(s.h)}</h3>${items}</div>`;
    }).join("");
    openPanel({
      color: "#ffd479",
      badge: "📖 会社全体",
      title: c.title,
      role: c.intro,
      html,
    });
  }

  $("rulebookBtn").addEventListener("click", openCompany);
  $("panelClose").addEventListener("click", closePanel);
  panel.addEventListener("click", (e) => { if (e.target === panel) closePanel(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.classList.contains("hidden")) closePanel(); });

  // イントロのヒント（日付）
  $("introHint").textContent = `${DATA.subtitle}`;
})();
