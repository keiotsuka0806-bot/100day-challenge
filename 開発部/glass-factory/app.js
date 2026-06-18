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

  // ---- 画面遷移（イントロ / ロビー / 各部屋） ----
  const lobby = $("lobby");
  const museum = $("museum");
  const meeting = $("meeting");
  const build = $("build");
  const SCREENS = [intro, lobby, stage, museum, meeting, build];

  function showScreen(el) {
    SCREENS.forEach((s) => s.classList.toggle("hidden", s !== el));
    window.scrollTo(0, 0);
  }

  function goLobby() {
    stop();
    showScreen(lobby);
  }

  function enterReplay() {
    showScreen(stage);
    $("headDate").textContent = `${DATA.date} ・ ${DATA.title}`;
    restart();
    play();
  }

  function enterMuseum() {
    stop();
    showScreen(museum);
    renderMuseum();
  }

  function enterMeeting() {
    stop();
    showScreen(meeting);
    renderMeeting();
  }

  function enterBuild() {
    stop();
    showScreen(build);
  }

  // ---- ロビーの部屋カード ----
  const ROOMS = [
    { no: "①", name: "見学ステージ", tagline: "今日の一日リプレイ", desc: "朝会から本命プロダクトが生まれるまでの一日を、まるごと観戦する。", status: "open", go: enterReplay, c: "var(--c-開発部)" },
    { no: "③", name: "ボツ美術館", tagline: "世に出なかった企画たち", desc: "落とされた企画と、その却下理由を展示する地下展示室。", status: "open", go: enterMuseum, c: "var(--c-記憶庫)" },
    { no: "②", name: "企画会議室", tagline: "10案が3案に絞られるまで", desc: "提出された10案を審査基準にかけ、その場で3案へ絞る。", status: "open", go: enterMeeting, c: "var(--c-企画部)" },
    { no: "④", name: "会社を建てる", tagline: "あなた自身のAI会社を建てる", desc: "目的・掟・部署を選んで、自分の工場を3ステップで建てる。", status: "open", go: enterBuild, c: "var(--c-社長)" },
  ];

  const roomsEl = $("rooms");
  ROOMS.forEach((r) => {
    const card = document.createElement(r.status === "open" ? "button" : "div");
    card.className = "room-card" + (r.status === "soon" ? " soon" : "");
    card.style.setProperty("--c", r.c);
    card.innerHTML = `
      <span class="room-card-no">${r.no}</span>
      <div class="room-card-body">
        <h2>${r.name}${r.status === "soon" ? '<span class="soon-tag">準備中</span>' : ""}</h2>
        <p class="room-card-tag">${r.tagline}</p>
        <p class="room-card-desc">${r.desc}</p>
      </div>
      <span class="room-card-arrow">${r.status === "open" ? "→" : "🔒"}</span>
    `;
    if (r.status === "open") card.addEventListener("click", r.go);
    roomsEl.appendChild(card);
  });

  // ---- ボツ美術館を描画 ----
  function renderMuseum() {
    const M = window.GLASS_MUSEUM;
    if (museum.dataset.built) return;
    $("museumIntro").textContent = M.intro;
    $("museumFoot").textContent = M.foot;
    const gallery = $("gallery");
    M.exhibits.forEach((ex) => {
      const frame = document.createElement("button");
      frame.className = "frame";
      frame.style.setProperty("--hue", ex.hue);
      const works = ex.works
        ? `<div class="frame-works">${ex.works.map((w) => `<span>${esc(w)}</span>`).join("")}</div>`
        : `<p class="frame-solo">${esc(ex.caption)}</p>`;
      frame.innerHTML = `
        <div class="frame-canvas">
          <span class="frame-kind">${esc(ex.kind)}</span>
          <h3 class="frame-title">${esc(ex.title)}</h3>
          ${works}
        </div>
        <div class="plate">
          <span class="plate-cap">${esc(ex.caption)}</span>
          <span class="plate-date">却下: ${esc(ex.by)} ・ ${esc(ex.date)}</span>
        </div>
      `;
      frame.addEventListener("click", () => openExhibit(ex));
      gallery.appendChild(frame);
    });
    museum.dataset.built = "1";
  }

  function openExhibit(ex) {
    const worksHtml = ex.works
      ? `<div class="ex-works">${ex.works.map((w) => `<span>${esc(w)}</span>`).join("")}</div>`
      : "";
    const html = `
      ${worksHtml}
      <div class="ex-row"><span class="ex-k">これは何だった?</span><p>${esc(ex.what)}</p></div>
      <div class="ex-row ex-verdict"><span class="ex-k">却下票 ・ ${esc(ex.by)}</span><p>${esc(ex.verdict)}</p></div>
      <div class="ex-row"><span class="ex-k">なぜ落ちた?</span><p>${esc(ex.reason)}</p></div>
      <div class="ex-row ex-lesson"><span class="ex-k">💡 この没から得た学び</span><p>${esc(ex.lesson)}</p></div>
    `;
    openPanel({
      color: `hsl(${ex.hue} 70% 70%)`,
      badge: "🖼 収蔵品 ・ " + ex.kind,
      title: ex.title,
      role: ex.caption,
      html,
    });
  }

  // ---- ② 企画会議室 ----
  const MTG = window.GLASS_MEETING;
  let mtgRound = 0;

  function renderMeeting() {
    $("meetingIntro").textContent = MTG.intro;
    $("meetingFoot").textContent = MTG.outro;
    const tabs = $("roundTabs");
    if (!tabs.dataset.built) {
      MTG.rounds.forEach((r, i) => {
        const b = document.createElement("button");
        b.className = "round-tab";
        b.innerHTML = `<b>${r.label}</b><span>${r.theme}</span>`;
        b.addEventListener("click", () => { mtgRound = i; renderRound(); });
        tabs.appendChild(b);
      });
      tabs.dataset.built = "1";
    }
    renderRound();
  }

  function renderRound() {
    const r = MTG.rounds[mtgRound];
    $("roundTabs").querySelectorAll(".round-tab").forEach((t, i) =>
      t.classList.toggle("active", i === mtgRound));

    const keep = new Set(r.keep);
    const chips = r.all.map((name) => {
      const isKeep = keep.has(name);
      return `<div class="idea ${isKeep ? "is-keep" : "is-drop"}" data-keep="${isKeep}">${esc(name)}</div>`;
    }).join("");

    $("meetingStage").innerHTML = `
      <div class="board" data-phase="all">
        <div class="board-row board-meta">
          <span class="submit-count">提出 <b>${r.all.length}</b> 案</span>
          <button class="btn-sift" id="siftBtn">⚙️ 会議にかけて3案に絞る →</button>
        </div>
        <div class="ideas" id="ideas">${chips}</div>
        <div class="sift-result" id="siftResult">
          <div class="keep-head">✓ 最終3案 <span>${esc(r.keepReason)}</span></div>
          <div class="drop-note">見送り ${r.all.length - r.keep.length} 案 — ${esc(r.dropNote)}</div>
          <div class="verdict-card">
            <span class="verdict-by">👤 社長の最終判定</span>
            <span class="verdict-stamp">${esc(r.result)}</span>
            <p>${esc(r.verdict)}</p>
            <a class="verdict-link" data-go-museum>→ 落選作は「③ ボツ美術館」に収蔵</a>
          </div>
        </div>
      </div>
    `;

    $("siftBtn").addEventListener("click", siftRound);
    $("meetingStage").querySelector("[data-go-museum]").addEventListener("click", enterMuseum);
  }

  function siftRound() {
    const board = $("meetingStage").querySelector(".board");
    if (board.dataset.phase === "sifted") return;
    board.dataset.phase = "sifted";
    // 落選を先に沈め、残った3案を浮かせる
    $("ideas").querySelectorAll(".idea").forEach((el, i) => {
      const keep = el.dataset.keep === "true";
      setTimeout(() => el.classList.add(keep ? "sift-keep" : "sift-drop"), i * 70);
    });
    setTimeout(() => $("siftResult").classList.add("show"), 700);
    $("siftBtn").disabled = true;
    $("siftBtn").textContent = "絞り込み完了";
  }

  function openGates() {
    const html = MTG.gates.map((g, i) =>
      `<div class="rule-item"><span class="num">${i + 1}</span><span><b>${esc(g.h)}</b><br>${esc(g.t)}</span></div>`
    ).join("");
    openPanel({
      color: "var(--c-企画部)",
      badge: "📋 企画部",
      title: "企画会議の審査基準",
      role: "提出された案は、この基準にかけて絞られます。",
      html,
    });
  }

  // ---- イベント配線 ----
  $("gatesBtn").addEventListener("click", openGates);
  $("startBtn").addEventListener("click", goLobby);
  $("lobbyRulebook").addEventListener("click", openCompany);
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", goLobby));

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
