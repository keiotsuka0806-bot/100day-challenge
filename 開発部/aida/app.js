/* あいだ — 二人の本当の対話を、AIが通訳する
 * フロント: Vanilla JS / Firestore(部屋同期) / /api/translate(Claude をサーバ側で呼ぶ)
 */

// ───────────────────────────────────────────────
// Firebase 設定（要変更：自分の Firebase プロジェクトの値に差し替える）
// Firestore を有効化し、下の config を貼り替えてください。
// ───────────────────────────────────────────────
// あいだ専用の Firebase プロジェクト(aida-3cc6f)。WhiskyNoteとは完全分離。
const firebaseConfig = {
  apiKey: "AIzaSyAWkXrtPU_u6ih2IEDS_AgORz5PdlhJNmo",
  authDomain: "aida-3cc6f.firebaseapp.com",
  projectId: "aida-3cc6f",
  storageBucket: "aida-3cc6f.firebasestorage.app",
  messagingSenderId: "53691443876",
  appId: "1:53691443876:web:49dbc2486ee0a550259431",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const rooms = db.collection("aidaRooms");

// ───────────────────────────────────────────────
// 関係ごとの問い（言い回しを変えてある）
// ───────────────────────────────────────────────
// ラベルと絵文字のみ。問いの本体は questions.js の AIDA_QUESTIONS（各50問以上）から
// 毎回ランダムで5問選ぶ。
const RELATIONS = {
  partner: { label: "恋人・パートナー", emo: "💞" },
  family: { label: "親子・家族", emo: "🏠" },
  friend: { label: "友人", emo: "🤝" },
  distant: { label: "距離ができた人", emo: "🌉" },
  colleague: { label: "仕事仲間", emo: "💼" },
};

// プールから重複なくn問ランダムに選ぶ（Fisher–Yates）
function pickN(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ───────────────────────────────────────────────
// 状態
// ───────────────────────────────────────────────
let selectedRelation = null;
let currentCode = null;
let myRole = null; // 'a' | 'b'
let unsub = null;
let staleTimer = null; // 翻訳が固まったときの復帰用

// ───────────────────────────────────────────────
// 画面切り替え
// ───────────────────────────────────────────────
const screens = {
  home: document.getElementById("screen-home"),
  questions: document.getElementById("screen-questions"),
  waiting: document.getElementById("screen-waiting"),
  result: document.getElementById("screen-result"),
};
function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo(0, 0);
}

// ───────────────────────────────────────────────
// ホーム：関係の選択
// ───────────────────────────────────────────────
const relEl = document.getElementById("relations");
const btnCreate = document.getElementById("btn-create");
Object.entries(RELATIONS).forEach(([key, rel]) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "rel";
  b.dataset.key = key;
  b.innerHTML = `<span class="emo">${rel.emo}</span>${rel.label}`;
  b.addEventListener("click", () => {
    selectedRelation = key;
    document.querySelectorAll(".rel").forEach((x) => x.classList.toggle("selected", x === b));
    btnCreate.disabled = false;
  });
  relEl.appendChild(b);
});

// ───────────────────────────────────────────────
// 部屋を作る（自分 = A）
// ───────────────────────────────────────────────
btnCreate.addEventListener("click", async () => {
  if (!selectedRelation) return;
  btnCreate.disabled = true;
  const hint = document.getElementById("home-hint");
  hint.textContent = "部屋を作っています…";
  try {
    const code = genCode();
    const rel = RELATIONS[selectedRelation];
    const picked = pickN(AIDA_QUESTIONS[selectedRelation], 5);
    await rooms.doc(code).set({
      relation: selectedRelation,
      relationLabel: rel.label,
      questions: picked,
      a: { joined: true, answers: null },
      b: { joined: false, answers: null },
      translating: false,
      result: null,
      error: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    currentCode = code;
    myRole = "a";
    localStorage.setItem(`aida_role_${code}`, "a");
    enterQuestions(picked, true);
  } catch (e) {
    console.error(e);
    hint.textContent = "部屋を作れませんでした。Firebaseの設定を確認してください。";
    hint.classList.add("error");
    btnCreate.disabled = false;
  }
});

// ───────────────────────────────────────────────
// 参加する（自分 = B）
// ───────────────────────────────────────────────
document.getElementById("btn-join").addEventListener("click", () => {
  const input = document.getElementById("join-code");
  const code = (input.value || "").trim().toUpperCase();
  const hint = document.getElementById("home-hint");
  hint.classList.remove("error");
  if (code.length !== 6) {
    hint.textContent = "6文字のコードを入れてください。";
    hint.classList.add("error");
    return;
  }
  enterRoom(code);
});

// コードで部屋に入る/戻る。コードを知っていれば入れる＝退出後の再入室・別ブラウザでの再開もできる。
async function enterRoom(code) {
  const hint = document.getElementById("home-hint");
  hint.classList.remove("error");
  hint.textContent = "部屋を探しています…";
  let snap;
  try {
    snap = await rooms.doc(code).get();
  } catch (e) {
    console.error(e);
    hint.textContent = "参加できませんでした。通信環境を確認してください。";
    hint.classList.add("error");
    return;
  }
  if (!snap.exists) {
    hint.textContent = "そのコードの部屋は見つかりませんでした。";
    hint.classList.add("error");
    return;
  }
  const data = snap.data();
  currentCode = code;
  const stored = localStorage.getItem(`aida_role_${code}`);
  if (stored === "a") {
    myRole = "a"; // 作成者として再入室
  } else {
    myRole = "b"; // 参加者(再入室・別ブラウザ含む)。コードが入室の鍵
    localStorage.setItem(`aida_role_${code}`, "b");
    if (!(data.b && data.b.joined)) {
      try { await rooms.doc(code).update({ "b.joined": true }); } catch (e) { console.error(e); }
    }
  }
  resumeByState(data);
}

// 部屋の状態に応じて画面を出し分ける(未回答→質問 / 回答済み・結果あり→待機/結果)
function resumeByState(d) {
  document.getElementById("home-hint").textContent = "";
  if (d.result || (d[myRole] && d[myRole].answers)) {
    enterWaiting();
  } else {
    enterQuestions(d.questions, myRole === "a");
  }
}

// ───────────────────────────────────────────────
// 質問画面
// ───────────────────────────────────────────────
function enterQuestions(questions, isCreator) {
  const form = document.getElementById("q-form");
  form.innerHTML = "";
  questions.forEach((q, i) => {
    const wrap = document.createElement("div");
    wrap.className = "q-item";
    const label = document.createElement("label");
    label.setAttribute("for", `q-${i}`);
    label.textContent = `${i + 1}. ${q}`; // textContentでHTMLとして解釈させない(XSS対策)
    const ta = document.createElement("textarea");
    ta.id = `q-${i}`;
    ta.rows = 3;
    ta.placeholder = "思ったままで大丈夫";
    wrap.appendChild(label);
    wrap.appendChild(ta);
    form.appendChild(wrap);
  });

  // 作成者にはコードを表示
  const banner = document.getElementById("code-banner");
  if (isCreator) {
    banner.hidden = false;
    document.getElementById("code-text").textContent = currentCode;
  } else {
    banner.hidden = true;
  }
  document.getElementById("q-title").textContent = "あなたの番です";
  show("questions");
}

document.getElementById("btn-submit").addEventListener("click", async () => {
  const form = document.getElementById("q-form");
  const answers = [...form.querySelectorAll("textarea")].map((t) => t.value.trim());
  const filled = answers.filter(Boolean).length;
  const hint = document.getElementById("q-hint");
  if (filled === 0) {
    hint.textContent = "ひとつでも答えてから送ってください。";
    hint.classList.add("error");
    return;
  }
  hint.classList.remove("error");
  hint.textContent = "送っています…";
  try {
    await rooms.doc(currentCode).update({ [`${myRole}.answers`]: answers });
    enterWaiting();
  } catch (e) {
    console.error(e);
    hint.textContent = "送信に失敗しました。もう一度試してください。";
    hint.classList.add("error");
  }
});

// ───────────────────────────────────────────────
// 待機 + 同期。両者完了したら片方が翻訳を呼ぶ。
// ───────────────────────────────────────────────
function enterWaiting() {
  show("waiting");
  // 作成者なら待機画面にもコードを出す
  if (myRole === "a") {
    document.getElementById("wait-code-banner").hidden = false;
    document.getElementById("wait-code-text").textContent = currentCode;
  }
  if (unsub) unsub();
  unsub = rooms.doc(currentCode).onSnapshot(async (snap) => {
    if (!snap.exists) return;
    const d = snap.data();
    const aDone = !!(d.a && d.a.answers);
    const bDone = !!(d.b && d.b.answers);
    document.getElementById("btn-retry").hidden = true;
    clearTimeout(staleTimer);

    // 結果が出ていれば表示
    if (d.result) {
      if (unsub) { unsub(); unsub = null; }
      renderResult(d);
      return;
    }
    if (d.error) {
      document.getElementById("wait-title").textContent = "通訳に失敗しました";
      document.getElementById("wait-sub").textContent = d.error;
      document.getElementById("btn-retry").hidden = false;
      return;
    }

    // 両者回答済みなのに結果が出ない状態が30秒続いたら、固まり対策で再試行を出す
    if (aDone && bDone) {
      staleTimer = setTimeout(() => {
        document.getElementById("btn-retry").hidden = false;
      }, 30000);
    }

    // 進捗メッセージ
    const waitSub = document.getElementById("wait-sub");
    if (!aDone || !bDone) {
      waitSub.textContent =
        (myRole === "a" && bDone) || (myRole === "b" && aDone)
          ? "あなたの答えを待っています…"
          : "二人の答えがそろうのを待っています…";
    }

    // 両者完了 & まだ翻訳していない → トランザクションで担当を1人に決める
    if (aDone && bDone && !d.translating) {
      document.getElementById("wait-title").textContent = "ふたりの『あいだ』を読み解いています";
      waitSub.textContent = "少しだけ時間をください…";
      const claimed = await claimTranslation(currentCode);
      if (claimed) runTranslation(currentCode, d);
    } else if (aDone && bDone && d.translating) {
      document.getElementById("wait-title").textContent = "ふたりの『あいだ』を読み解いています";
      waitSub.textContent = "少しだけ時間をください…";
    }
  });
}

// トランザクションで「翻訳を担当する権利」を1人だけが取る
async function claimTranslation(code) {
  const ref = rooms.doc(code);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data();
      if (!d || d.result || d.translating) return false;
      if (!(d.a && d.a.answers && d.b && d.b.answers)) return false;
      tx.update(ref, { translating: true });
      return true;
    });
  } catch (e) {
    console.error("claim failed:", e);
    return false;
  }
}

// 担当者がサーバ関数を呼び、結果を Firestore に書く（両者に届く）
async function runTranslation(code, d) {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationLabel: d.relationLabel,
        aName: "Aさん",
        bName: "Bさん",
        questions: d.questions,
        a: d.a.answers,
        b: d.b.answers,
      }),
    });
    const json = await res.json();
    if (json.result) {
      await rooms.doc(code).update({ result: json.result, translating: false });
    } else {
      await rooms.doc(code).update({
        error: json.message || "通訳の生成に失敗しました。",
        translating: false,
      });
    }
  } catch (e) {
    console.error("translate call failed:", e);
    await rooms.doc(code).update({ error: "通信に失敗しました。", translating: false });
  }
}

// ───────────────────────────────────────────────
// 結果表示
// ───────────────────────────────────────────────
function renderResult(d) {
  const r = d.result;
  const questions = d.questions || [];

  // 安全
  const safetyBox = document.getElementById("safety-box");
  if (r.safety && r.safety.concern && r.safety.message) {
    safetyBox.hidden = false;
    safetyBox.textContent = r.safety.message;
  } else {
    safetyBox.hidden = true;
  }

  // 問いごとの対話:「あなたの答え / 相手の答え / あいだの通訳」
  const wrap = document.getElementById("r-exchanges");
  wrap.innerHTML = "";
  const exchanges = r.exchanges || [];
  // 生の回答は表示しない。問いと「あいだ」の通訳だけを見せる。
  questions.forEach((q, i) => {
    const bridge = (exchanges[i] && exchanges[i].bridge) || "";
    const card = document.createElement("div");
    card.className = "exchange";
    card.appendChild(el("p", "q", `Q${i + 1}. ${q}`));
    const br = el("div", "bridge");
    br.appendChild(el("span", "label", "あいだ"));
    br.appendChild(el("p", "b-text", bridge || "（この問いの通訳は生成されませんでした）"));
    card.appendChild(br);
    wrap.appendChild(card);
  });

  // 共通点
  const list = document.getElementById("r-common-list");
  list.innerHTML = "";
  (r.commonGround || []).forEach((c) => {
    const li = document.createElement("li");
    li.textContent = c;
    list.appendChild(li);
  });

  // 締めくくり
  document.getElementById("r-closing-text").textContent = r.closing || "";

  show("result");
}

// 小さなDOMヘルパー
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// ───────────────────────────────────────────────
// もう一度
// ───────────────────────────────────────────────
document.getElementById("btn-again").addEventListener("click", () => {
  if (unsub) { unsub(); unsub = null; }
  selectedRelation = null;
  currentCode = null;
  myRole = null;
  document.querySelectorAll(".rel").forEach((x) => x.classList.remove("selected"));
  btnCreate.disabled = true;
  document.getElementById("join-code").value = "";
  document.getElementById("home-hint").textContent = "";
  show("home");
});

// ───────────────────────────────────────────────
// コピー
// ───────────────────────────────────────────────
function copyShareLink(btn) {
  if (!currentCode) return;
  const url = `${location.origin}/?room=${currentCode}`;
  navigator.clipboard?.writeText(url);
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "コピー済み✓";
    setTimeout(() => { btn.textContent = orig; }, 1600);
  }
}
document.getElementById("btn-copy").addEventListener("click", (e) => copyShareLink(e.currentTarget));
document.getElementById("btn-copy2").addEventListener("click", (e) => copyShareLink(e.currentTarget));

// 通訳に失敗したときの再試行(errorをクリアすると、onSnapshotが再び翻訳を試みる)
document.getElementById("btn-retry").addEventListener("click", async () => {
  if (!currentCode) return;
  document.getElementById("btn-retry").hidden = true;
  document.getElementById("wait-title").textContent = "もう一度試しています";
  document.getElementById("wait-sub").textContent = "少しだけ時間をください…";
  try {
    await rooms.doc(currentCode).update({ error: null, translating: false });
  } catch (e) {
    console.error(e);
    document.getElementById("btn-retry").hidden = false;
  }
});

// 招待リンク(?room=CODE)で来たら、参加コードを自動入力する
(function initFromUrl() {
  const raw = new URLSearchParams(location.search).get("room");
  if (!raw) return;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const input = document.getElementById("join-code");
  input.value = code;
  // 同じ端末で既に参加済みのリンクを開き直した→自動で再入室
  if (code.length === 6 && localStorage.getItem(`aida_role_${code}`)) {
    enterRoom(code);
    return;
  }
  const hint = document.getElementById("home-hint");
  if (hint) hint.textContent = "招待コードが入りました。「参加する」を押してください。";
  input.scrollIntoView({ behavior: "smooth", block: "center" });
})();

// ───────────────────────────────────────────────
// ユーティリティ
// ───────────────────────────────────────────────
function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
