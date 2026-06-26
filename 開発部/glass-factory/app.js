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
    if (typeof dStop === "function") dStop();
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
    { no: "②", name: "企画会議室", tagline: "本命が決まるまでの議論", desc: "10案→ボツ→方針転換→本命採用。部署同士の議論を再現する。", status: "open", go: enterMeeting, c: "var(--c-企画部)" },
    { no: "④", name: "会社を建てる", tagline: "別棟で、自分のAI会社を建てる", desc: "部署を組み立てて1日をシミュレート。設計ツール AIOrgSim に引き継ぐ別棟。", status: "open", go: enterBuild, c: "var(--c-社長)" },
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

  // ---- ③ ボツ美術館（1案ずつ金額縁・スワイプ移動） ----
  const MUS = window.GLASS_MUSEUM;
  let musIdx = 0;

  const groupLabel = (gid) => (MUS.groups.find((g) => g.id === gid) || {}).label || "";

  function renderMuseum() {
    if (!museum.dataset.built) {
      $("museumIntro").textContent = MUS.intro;
      $("museumFoot").textContent = MUS.foot;
      const dots = $("exDots");
      dots.innerHTML = MUS.groups.map((g) => {
        const first = MUS.exhibits.findIndex((e) => e.g === g.id);
        return `<button class="grp-jump" data-i="${first}">${esc(g.label.split(" ・ ")[0])}</button>`;
      }).join("");
      dots.querySelectorAll(".grp-jump").forEach((d) =>
        d.addEventListener("click", () => goExhibit(+d.dataset.i)));
      $("exPrev").addEventListener("click", () => stepExhibit(-1));
      $("exNext").addEventListener("click", () => stepExhibit(1));
      wireSwipe($("frameStage"));
      museum.dataset.built = "1";
    }
    musIdx = 0;
    paintExhibit(0);
  }

  function stepExhibit(dir) { goExhibit(musIdx + dir, dir); }

  function goExhibit(i, dir) {
    const n = MUS.exhibits.length;
    const next = (i + n) % n;
    const d = dir || (next > musIdx ? 1 : -1);
    musIdx = next;
    paintExhibit(d);
  }

  function paintExhibit(dir) {
    const ex = MUS.exhibits[musIdx];
    const kindLine = ex.kind
      ? esc(ex.kind)
      : (ex.axis ? `軸：${esc(ex.axis)}` : "") + (ex.en ? `<span class="art-en">${esc(ex.en)}</span>` : "");
    const estBadge = ex.estimated ? `<span class="art-est">※当時の詳細記録なし／名前からの推定</span>` : "";
    const finalBadge = ex.finalist ? `<span class="art-final">★ 最終3案</span>` : "";
    const lesson = ex.lesson
      ? `<div class="art-sec art-lesson"><span class="art-k">💡 学び</span><p>${esc(ex.lesson)}</p></div>` : "";
    const stage = $("frameStage");
    stage.innerHTML = `
      <p class="art-group">${esc(groupLabel(ex.g))}</p>
      <figure class="art" style="--hue:${ex.hue}">
        <div class="art-frame">
          <div class="art-mat">
            <span class="art-kind">${kindLine}${finalBadge}</span>
            <h3 class="art-title">${esc(ex.title)}</h3>
            ${estBadge}
            <div class="art-sec"><span class="art-k">どんな企画案?</span><p>${esc(ex.what)}</p></div>
            <div class="art-sec art-why"><span class="art-k">なぜ没になったか</span><p>${esc(ex.reason)}</p></div>
            ${lesson}
          </div>
        </div>
        <figcaption class="art-plate">
          <span class="plate-date">収蔵 No.${musIdx + 1} ／ ${MUS.exhibits.length}</span>
        </figcaption>
      </figure>
    `;
    const art = stage.querySelector(".art");
    art.classList.add(dir < 0 ? "in-left" : "in-right");
    $("exDots").querySelectorAll(".grp-jump").forEach((d) =>
      d.classList.toggle("on", MUS.exhibits[+d.dataset.i].g === ex.g));
  }

  function wireSwipe(el) {
    let x0 = null;
    el.addEventListener("touchstart", (e) => { x0 = e.changedTouches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) stepExhibit(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  // ---- ② 企画会議室（AI同士の議論を“再現”・自動再生） ----
  const MTG = window.GLASS_MEETING;
  const dFeed = $("debateFeed");
  const dPlayBtn = $("dPlay");
  let dIdx = 0, dPlaying = false, dTimer = null;
  const D_DELAY = 2600;

  function renderMeeting() {
    $("meetingIntro").textContent = MTG.intro;
    $("meetingLabel").textContent = "🎬 " + MTG.label;
    $("meetingFoot").textContent = "";
    dRestartDebate();
    dPlay();
  }

  function renderTurn(t) {
    const right = !!t.human;
    const ideas = t.ideas
      ? `<div class="bubble-ideas">${t.ideas.map((n) => `<span>${esc(n)}</span>`).join("")}</div>`
      : "";
    const note = t.note ? `<div class="bubble-note">⚙️ ${esc(t.note)}</div>` : "";
    const tag = t.tag ? `<span class="bubble-tag">★ ${esc(t.tag)}</span>` : "";
    const b = document.createElement("div");
    b.className = "bubble type-" + t.type + (right ? " right" : "") + (t.human ? " human" : "");
    b.style.setProperty("--c", `var(--c-${t.who})`);
    const whoLabel = t.role ? `${esc(t.who)} ・ ${esc(t.role)}` : esc(t.who) + (t.human ? " ・ 人間" : "");
    b.innerHTML = `
      <div class="bubble-head">
        <span class="b-who">${whoLabel}</span>
        <span class="b-type">${esc(t.type)}</span>
      </div>
      <p class="bubble-text">${esc(t.text)}</p>
      ${ideas}${tag}${note}
    `;
    dFeed.appendChild(b);
    requestAnimationFrame(() => b.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  function dStep() {
    if (dIdx >= MTG.debate.length) { dStop(); return; }
    renderTurn(MTG.debate[dIdx]);
    dIdx += 1;
    if (dIdx >= MTG.debate.length) {
      $("meetingFoot").textContent = MTG.closing;
      dStop();
    }
  }

  function dSchedule() {
    clearTimeout(dTimer);
    if (!dPlaying || dIdx >= MTG.debate.length) return;
    dTimer = setTimeout(() => { dStep(); dSchedule(); }, D_DELAY);
  }

  function dPlay() {
    if (dIdx >= MTG.debate.length) dRestartDebate();
    dPlaying = true;
    dPlayBtn.textContent = "⏸";
    if (dIdx === 0) dStep();
    dSchedule();
  }

  function dStop() {
    dPlaying = false;
    dPlayBtn.textContent = dIdx >= MTG.debate.length ? "⟲" : "▶";
    clearTimeout(dTimer);
  }

  function dRestartDebate() {
    clearTimeout(dTimer);
    dFeed.innerHTML = "";
    dIdx = 0;
    $("meetingFoot").textContent = "";
  }

  dPlayBtn.addEventListener("click", () => { if (dPlaying) dStop(); else dPlay(); });
  $("dRestart").addEventListener("click", () => { dRestartDebate(); dPlay(); });
  $("dNext").addEventListener("click", () => { dStop(); dStep(); });

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
  document.addEventListener("keydown", (e) => {
    if (museum.classList.contains("hidden") || !panel.classList.contains("hidden")) return;
    if (e.key === "ArrowRight") stepExhibit(1);
    else if (e.key === "ArrowLeft") stepExhibit(-1);
  });

  // イントロのヒント（日付）
  $("introHint").textContent = `${DATA.subtitle}`;
})();
