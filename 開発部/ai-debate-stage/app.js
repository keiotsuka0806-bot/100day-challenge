'use strict';

// ─── 定数 ─────────────────────────────────────────
const TOTAL_TURNS = 6; // 推進派×3 + 懐疑派×3（交互）
const TURN_LABELS = {
  pro: ['最初の主張', '反論', '最終弁論'],
  con: ['最初の反論', '再反論', '最終弁論'],
};

// ─── 状態 ─────────────────────────────────────────
let topic   = '';
let history = []; // [{side:'pro'|'con', text:string}]
let running = false;

// ─── DOM取得 ───────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── 画面切替 ──────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ─── テーマ例ボタン ────────────────────────────────
document.querySelectorAll('.ex-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $('topic-input').value = btn.dataset.topic;
    $('topic-error').textContent = '';
    $('topic-input').focus();
  });
});

// ─── 前回テーマ復元 ────────────────────────────────
(function loadPrevTopic() {
  try {
    const last = JSON.parse(localStorage.getItem('lastDebate') || '{}');
    if (last.topic) {
      const btn = $('prev-topic-btn');
      btn.textContent = `前回：${last.topic}`;
      btn.style.display = 'inline-block';
      btn.addEventListener('click', () => {
        $('topic-input').value = last.topic;
        $('topic-error').textContent = '';
        $('topic-input').focus();
      });
    }
  } catch (_) {}
})();

// ─── 開始ボタン ────────────────────────────────────
$('start-btn').addEventListener('click', startDebate);
$('topic-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') startDebate();
});

async function startDebate() {
  const raw = $('topic-input').value.trim();
  if (!raw || running) return;

  // テーマが短すぎる場合はガイドを表示
  if (raw.length < 5) {
    $('topic-error').textContent = '5文字以上のテーマを入力してください（例：SNSは人を幸福にするか）';
    $('topic-input').focus();
    return;
  }
  $('topic-error').textContent = '';

  topic   = raw;
  history = [];
  running = true;

  // 討論画面を初期化（thinking-bar を先に見せてからページ遷移）
  $('header-topic').textContent = `「${topic}」`;
  $('debate-arena').innerHTML   = '';
  $('thinking-bar').classList.add('visible');
  $('thinking-label').textContent = '推進派（最初の主張）';
  updateProgress(0);

  showScreen('screen-debate');

  // 6ターン: pro→con→pro→con→pro→con
  for (let i = 0; i < TOTAL_TURNS; i++) {
    const side = i % 2 === 0 ? 'pro' : 'con';
    const ok = await runTurn(side, i);
    if (!ok) { running = false; return; } // API失敗で中断
  }

  // 結果画面へ
  $('result-topic').textContent = `テーマ：「${topic}」`;
  $('winner-panel').style.display = 'none';
  $('copied-msg').style.display   = 'none';
  document.querySelectorAll('.vote-btn').forEach(b => (b.disabled = false));
  renderDebateLog();
  showScreen('screen-result');
  running = false;
}

// ─── 1ターン実行 ───────────────────────────────────
async function runTurn(side, turnIndex) {
  const sideLabel = side === 'pro' ? '推進派' : '懐疑派';
  const turnNum   = Math.floor(turnIndex / 2); // 0,1,2
  const turnLabel = TURN_LABELS[side][turnNum];

  // 「考えています」表示
  $('thinking-label').textContent = `${sideLabel}（${turnLabel}）`;
  $('thinking-bar').classList.add('visible');

  try {
    const res = await fetch('/api/debate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ topic, side, history, turnIndex }),
    });

    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || 'API error');

    $('thinking-bar').classList.remove('visible');
    addBubble(side, json.text, turnLabel, turnIndex >= 4);
    history.push({ side, text: json.text });
    updateProgress(turnIndex + 1);

    await sleep(600);
    return true;
  } catch (err) {
    $('thinking-bar').classList.remove('visible');
    showApiError(err.message);
    return false;
  }
}

// ─── 吹き出しを追加 ────────────────────────────────
function addBubble(side, text, label, isFinal = false) {
  const arena  = $('debate-arena');
  const bubble = document.createElement('div');
  bubble.className = `bubble bubble-${side}${isFinal ? ' is-final' : ''}`;

  bubble.innerHTML = `
    <div class="bubble-meta">${side === 'pro' ? '推進派' : '懐疑派'} · ${label}</div>
    <div class="bubble-body">${escHtml(text)}</div>
    <button class="nrh-btn" title="なるほど！">👍</button>
  `;

  bubble.querySelector('.nrh-btn').addEventListener('click', function () {
    const b = this.closest('.bubble');
    b.classList.toggle('lit');
    this.textContent = b.classList.contains('lit') ? '⭐' : '👍';
  });

  arena.appendChild(bubble);
  requestAnimationFrame(() => bubble.classList.add('in'));
  arena.scrollTo({ top: arena.scrollHeight, behavior: 'smooth' });
}

// ─── 進捗バー更新 ─────────────────────────────────
function updateProgress(done) {
  const pct = Math.round((done / TOTAL_TURNS) * 100);
  $('progress-fill').style.width   = `${pct}%`;
  $('progress-label').textContent  = `ターン ${done} / ${TOTAL_TURNS}`;
}

// ─── 結果画面に討論ログを描画 ──────────────────────
function renderDebateLog() {
  const log = $('debate-log-content');
  log.innerHTML = history.map((h, i) => {
    const sideLabel = h.side === 'pro' ? '推進派' : '懐疑派';
    const turnNum   = Math.floor(i / 2);
    const turnLabel = TURN_LABELS[h.side][turnNum];
    return `<div class="log-bubble log-${h.side}">
      <span class="log-meta">${sideLabel} · ${turnLabel}</span>
      <p class="log-text">${escHtml(h.text)}</p>
    </div>`;
  }).join('');
}

$('debate-log-toggle').addEventListener('click', () => {
  const content = $('debate-log-content');
  const btn     = $('debate-log-toggle');
  const open    = content.classList.toggle('open');
  btn.textContent = open ? '討論を閉じる ▲' : '討論を振り返る ▼';
});

// ─── 投票ボタン ────────────────────────────────────
document.querySelectorAll('.vote-btn').forEach(btn => {
  btn.addEventListener('click', () => vote(btn.dataset.result));
});

function vote(result) {
  document.querySelectorAll('.vote-btn').forEach(b => (b.disabled = true));

  const labels = {
    pro:  '推進派の勝利！ 🏆',
    con:  '懐疑派の勝利！ 🏆',
    draw: '引き分け！ 🤝',
  };

  $('winner-text').textContent    = labels[result];
  const panel = $('winner-panel');
  panel.style.display = 'block';
  panel.classList.remove('pulse');
  requestAnimationFrame(() => panel.classList.add('pulse'));

  localStorage.setItem('lastDebate', JSON.stringify({
    topic, result, date: new Date().toISOString(),
  }));
}

// ─── シェアボタン ─────────────────────────────────
$('share-btn').addEventListener('click', () => {
  const winner = $('winner-text').textContent;
  const url    = window.location.href;
  const proArg = history[0] ? `推進派：「${history[0].text.slice(0, 55)}…」` : '';
  const conArg = history[1] ? `懐疑派：「${history[1].text.slice(0, 55)}…」` : '';
  const shareText =
    `「${topic}」でAI討論した結果…\n${winner}\n\n${proArg}\n${conArg}\n\nAI Debate Stage で試してみよう 👉 ${url}`;

  navigator.clipboard.writeText(shareText).then(() => {
    const msg = $('copied-msg');
    msg.style.display = 'block';
    setTimeout(() => (msg.style.display = 'none'), 2000);
  });
});

// ─── API エラー表示 ────────────────────────────────
function showApiError(msg) {
  const arena = $('debate-arena');
  const el = document.createElement('div');
  el.className = 'api-error';
  el.innerHTML = `
    <p class="api-error-title">⚠️ API 接続エラー</p>
    <p class="api-error-msg">${escHtml(msg)}</p>
    <p class="api-error-hint">Vercel に <code>OPENAI_API_KEY</code> が設定されているか確認してください。<br>ローカルでの確認には <code>vercel dev</code> が必要です。</p>
    <button class="api-error-back" onclick="resetApp()">← 最初に戻る</button>
  `;
  arena.appendChild(el);
  arena.scrollTo({ top: arena.scrollHeight, behavior: 'smooth' });
}

// ─── リセット（エラー戻り・リトライ共通） ─────────────
function resetApp() {
  $('topic-input').value = '';
  showScreen('screen-intro');
}

// ─── リトライボタン ───────────────────────────────
$('retry-btn').addEventListener('click', resetApp);

// ─── ユーティリティ ───────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}
