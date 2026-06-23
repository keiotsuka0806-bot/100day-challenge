/* 段取り（Dandori）— アプリ本体（複数ライフイベント対応） */
(function () {
  'use strict';

  var STORE_KEY = 'dandori_v2';

  // ---- 状態 ----
  // byEvent[eventId] = { answers:{}, done:{}, started:bool }
  var state = {
    eventId: null,
    byEvent: {},
    hideDone: false,
  };

  // ---- DOM ----
  var screens = {
    intro: document.getElementById('introScreen'),
    quiz: document.getElementById('quizScreen'),
    list: document.getElementById('listScreen'),
  };
  var el = {
    eventCards: document.getElementById('eventCards'),
    homeBtn: document.getElementById('homeBtn'),
    quizTitle: document.getElementById('quizTitle'),
    quizForm: document.getElementById('quizForm'),
    buildBtn: document.getElementById('buildBtn'),
    editBtn: document.getElementById('editBtn'),
    shareBtn: document.getElementById('shareBtn'),
    printBtn: document.getElementById('printBtn'),
    tasks: document.getElementById('tasks'),
    legend: document.getElementById('legend'),
    progressLabel: document.getElementById('progressLabel'),
    progressFill: document.getElementById('progressFill'),
    hideDone: document.getElementById('hideDone'),
    listIntro: document.getElementById('listIntro'),
  };

  // ---- 永続化 ----
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* 保存できなくても継続 */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        state.eventId = data.eventId || null;
        state.byEvent = data.byEvent || {};
        state.hideDone = !!data.hideDone;
      }
    } catch (e) { /* 壊れていたら無視 */ }
  }

  // ---- ヘルパ ----
  function currentEvent() {
    return EVENTS.filter(function (e) { return e.id === state.eventId; })[0] || null;
  }
  function eventData() {
    if (!state.byEvent[state.eventId]) {
      state.byEvent[state.eventId] = { answers: {}, done: {}, started: false };
    }
    return state.byEvent[state.eventId];
  }
  function ensureDefaults(ev) {
    var d = eventData();
    ev.questions.forEach(function (q) {
      if (!(q.id in d.answers)) d.answers[q.id] = q.default;
    });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- 画面遷移 ----
  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('active', k === name);
    });
    el.homeBtn.hidden = (name === 'intro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- イベント選択カード ----
  function renderEventCards() {
    el.eventCards.innerHTML = '';
    EVENTS.forEach(function (ev) {
      var card = document.createElement(ev.ready ? 'button' : 'div');
      card.className = 'event-card' + (ev.ready ? '' : ' disabled');
      var started = ev.ready && state.byEvent[ev.id] && state.byEvent[ev.id].started;
      var inner = '<span class="ev-emoji" aria-hidden="true">' + ev.emoji + '</span>' +
        '<span class="ev-text"><span class="ev-label">' + esc(ev.label) + '</span>' +
        '<span class="ev-sub">' + esc(ev.sub) + '</span></span>';
      if (!ev.ready) {
        inner += '<span class="ev-soon">準備中</span>';
      } else if (started) {
        inner += '<span class="ev-resume">続きから</span>';
      } else {
        inner += '<span class="ev-go" aria-hidden="true">→</span>';
      }
      card.innerHTML = inner;
      if (ev.ready) {
        card.type = 'button';
        card.addEventListener('click', function () { openEvent(ev.id); });
      } else {
        card.title = ev.comingNote || '準備中';
      }
      el.eventCards.appendChild(card);
    });
  }

  function openEvent(id) {
    state.eventId = id;
    var ev = currentEvent();
    if (!ev) return;
    ensureDefaults(ev);
    save();
    var d = eventData();
    if (d.started) {
      el.hideDone.checked = state.hideDone;
      render();
      show('list');
    } else {
      renderQuiz();
      show('quiz');
    }
  }

  // ---- 質問フォーム ----
  function renderQuiz() {
    var ev = currentEvent();
    if (!ev) return;
    var d = eventData();
    el.quizTitle.textContent = ev.emoji + ' ' + ev.label + '：あなたの状況を教えてください';
    el.quizForm.innerHTML = '';
    ev.questions.forEach(function (q) {
      var card = document.createElement('div');
      card.className = 'q';
      var label = document.createElement('div');
      label.className = 'q-label';
      label.textContent = q.label;
      card.appendChild(label);

      var opts = document.createElement('div');
      opts.className = 'q-options';
      var choices = q.type === 'bool'
        ? [{ value: true, label: 'はい' }, { value: false, label: 'いいえ' }]
        : q.options;

      choices.forEach(function (c) {
        var optLabel = document.createElement('label');
        optLabel.className = 'opt';
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = q.id;
        input.value = String(c.value);
        if (String(d.answers[q.id]) === String(c.value)) input.checked = true;
        input.addEventListener('change', function () {
          d.answers[q.id] = (q.type === 'bool') ? (c.value === true) : c.value;
          save();
        });
        var span = document.createElement('span');
        span.textContent = c.label;
        optLabel.appendChild(input);
        optLabel.appendChild(span);
        opts.appendChild(optLabel);
      });
      card.appendChild(opts);
      el.quizForm.appendChild(card);
    });
  }

  // ---- タスク ----
  function visibleTasks() {
    var ev = currentEvent();
    var d = eventData();
    return ev.tasks.filter(function (t) {
      try { return t.show(d.answers); } catch (e) { return true; }
    });
  }

  function updateProgress(tasks) {
    var d = eventData();
    var total = tasks.length;
    var done = tasks.filter(function (t) { return d.done[t.id]; }).length;
    el.progressLabel.textContent = done + ' / ' + total + ' 完了';
    el.progressFill.style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
  }

  function metaRow(key, val) {
    if (!val || val === '—') return '';
    return '<div class="meta-row"><span class="meta-key">' + esc(key) +
      '</span><span class="meta-val">' + esc(val) + '</span></div>';
  }

  function taskNode(t) {
    var d = eventData();
    var node = document.createElement('div');
    node.className = 'task' + (d.done[t.id] ? ' done' : '');

    var main = document.createElement('div');
    main.className = 'task-main';

    var check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task-check';
    check.checked = !!d.done[t.id];
    check.setAttribute('aria-label', t.title + ' を完了にする');
    check.addEventListener('change', function () {
      if (check.checked) d.done[t.id] = true;
      else delete d.done[t.id];
      save();
      render();
    });

    var body = document.createElement('div');
    body.className = 'task-body';
    var html = '<div class="task-title">' + esc(t.title) + '</div>';
    html += '<div class="task-chips">';
    if (t.place && PLACE_LABELS[t.place]) {
      html += '<span class="place-badge place-' + t.place + '">' + esc(PLACE_LABELS[t.place]) + '</span>';
    }
    if (t.gov) html += '<span class="gov-badge">役所/窓口</span>';
    html += '</div>';
    html += '<div class="task-meta">';
    html += metaRow('いつ', t.when);
    html += metaRow('どこで', t.where);
    if (t.bring && t.bring.length) html += metaRow('持ち物', t.bring.join('・'));
    html += '</div>';
    if (t.note) html += '<div class="task-note">' + esc(t.note) + '</div>';
    if (t.link && t.link.url) {
      html += '<a class="task-link" href="' + esc(t.link.url) +
        '" target="_blank" rel="noopener noreferrer">' + esc(t.link.label) + '</a>';
    }
    body.innerHTML = html;

    main.appendChild(check);
    main.appendChild(body);
    node.appendChild(main);
    return node;
  }

  function render() {
    var ev = currentEvent();
    var d = eventData();
    var tasks = visibleTasks();
    updateProgress(tasks);

    // 凡例は place を使うイベント（引越し）だけ表示
    el.legend.style.display = ev.usePlace ? 'flex' : 'none';

    if (el.listIntro) {
      el.listIntro.textContent = ev.emoji + ' ' + ev.label + 'の手続きを ' + tasks.length +
        ' 件ご用意しました。上から順にチェックしていけば漏れません。';
    }
    el.tasks.innerHTML = '';

    var anyShown = false;
    ev.phases.forEach(function (phase) {
      var inPhase = tasks.filter(function (t) { return t.phase === phase.id; });
      if (!inPhase.length) return;
      var shown = state.hideDone ? inPhase.filter(function (t) { return !d.done[t.id]; }) : inPhase;
      if (!shown.length) return;
      anyShown = true;

      var doneCount = inPhase.filter(function (t) { return d.done[t.id]; }).length;
      var section = document.createElement('section');
      section.className = 'phase';
      var head = document.createElement('div');
      head.className = 'phase-head';
      head.innerHTML = '<h3 class="phase-title">' + esc(phase.label) + '</h3>' +
        '<span class="phase-count">' + doneCount + '/' + inPhase.length + '</span>';
      section.appendChild(head);
      var hint = document.createElement('p');
      hint.className = 'phase-hint';
      hint.textContent = phase.hint;
      section.appendChild(hint);
      shown.forEach(function (t) { section.appendChild(taskNode(t)); });
      el.tasks.appendChild(section);
    });

    if (!anyShown) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = state.hideDone
        ? 'すべて完了しました！おつかれさまでした 🎉'
        : '表示できる手続きがありません。条件を変えてみてください。';
      el.tasks.appendChild(empty);
    }
  }

  // ---- 共有 ----
  function buildShareText() {
    var ev = currentEvent();
    var d = eventData();
    var tasks = visibleTasks();
    var lines = ['【' + ev.label + 'の手続き 段取りリスト】'];
    ev.phases.forEach(function (phase) {
      var inPhase = tasks.filter(function (t) { return t.phase === phase.id; });
      if (!inPhase.length) return;
      lines.push('');
      lines.push('■ ' + phase.label);
      inPhase.forEach(function (t) {
        lines.push((d.done[t.id] ? '✅' : '⬜') + ' ' + t.title + '（' + t.when + ' / ' + t.where + '）');
      });
    });
    lines.push('');
    lines.push('※自治体・契約で細部は異なります。公式で最終確認を。');
    lines.push('作成: 段取り #100DayChallenge');
    return lines.join('\n');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 250);
    }, 1900);
  }

  async function doShare() {
    var text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: currentEvent().label + 'の段取りリスト', text: text });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('リストをコピーしました');
    } catch (e) {
      toast('コピーできませんでした');
    }
  }

  // ---- イベント束ね ----
  function bind() {
    el.buildBtn.addEventListener('click', function () {
      eventData().started = true;
      save();
      render();
      el.hideDone.checked = state.hideDone;
      show('list');
    });
    el.editBtn.addEventListener('click', function () {
      renderQuiz();
      show('quiz');
    });
    el.homeBtn.addEventListener('click', function () {
      renderEventCards();
      show('intro');
    });
    el.shareBtn.addEventListener('click', doShare);
    el.printBtn.addEventListener('click', function () { window.print(); });
    el.hideDone.addEventListener('change', function () {
      state.hideDone = el.hideDone.checked;
      save();
      render();
    });
  }

  // ---- 初期化 ----
  function init() {
    load();
    renderEventCards();
    bind();
    show('intro');
  }

  document.addEventListener('DOMContentLoaded', init);

  // ---- Service Worker（network-first）----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js').catch(function () {});
    });
  }
})();
