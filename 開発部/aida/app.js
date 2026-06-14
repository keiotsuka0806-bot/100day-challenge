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
document.getElementById("btn-join").addEventListener("click", async () => {
  const input = document.getElementById("join-code");
  const code = (input.value || "").trim().toUpperCase();
  const hint = document.getElementById("home-hint");
  hint.classList.remove("error");
  if (code.length !== 6) {
    hint.textContent = "6文字のコードを入れてください。";
    hint.classList.add("error");
    return;
  }
  hint.textContent = "部屋を探しています…";
  try {
    const ref = rooms.doc(code);
    const snap = await ref.get();
    if (!snap.exists) {
      hint.textContent = "そのコードの部屋は見つかりませんでした。";
      hint.classList.add("error");
      return;
    }
    const data = snap.data();
    if (data.b && data.b.joined) {
      hint.textContent = "この部屋にはもう二人います。";
      hint.classList.add("error");
      return;
    }
    await ref.update({ "b.joined": true });
    currentCode = code;
    myRole = "b";
    enterQuestions(data.questions, false);
  } catch (e) {
    console.error(e);
    hint.textContent = "参加できませんでした。通信環境を確認してください。";
    hint.classList.add("error");
  }
});

// ───────────────────────────────────────────────
// 質問画面
// ───────────────────────────────────────────────
function enterQuestions(questions, isCreator) {
  const form = document.getElementById("q-form");
  form.innerHTML = "";
  questions.forEach((q, i) => {
    const wrap = document.createElement("div");
    wrap.className = "q-item";
    wrap.innerHTML = `
      <label for="q-${i}">${i + 1}. ${q}</label>
      <textarea id="q-${i}" rows="3" placeholder="思ったままで大丈夫"></textarea>`;
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

    // 結果が出ていれば表示
    if (d.result) {
      if (unsub) { unsub(); unsub = null; }
      renderResult(d);
      return;
    }
    if (d.error) {
      document.getElementById("wait-title").textContent = "通訳に失敗しました";
      document.getElementById("wait-sub").textContent = d.error;
      return;
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

  // 安全
  const safetyBox = document.getElementById("safety-box");
  if (r.safety && r.safety.concern && r.safety.message) {
    safetyBox.hidden = false;
    safetyBox.textContent = r.safety.message;
  } else {
    safetyBox.hidden = true;
  }

  // 共通点
  const list = document.getElementById("r-common-list");
  list.innerHTML = "";
  (r.commonGround || []).forEach((c) => {
    const li = document.createElement("li");
    li.textContent = c;
    list.appendChild(li);
  });

  document.getElementById("r-a-text").textContent = r.aTrueHeart || "";
  document.getElementById("r-b-text").textContent = r.bTrueHeart || "";
  document.getElementById("r-step-text").textContent = r.nextStep || "";

  show("result");
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
function copyCode() {
  if (!currentCode) return;
  navigator.clipboard?.writeText(currentCode);
}
document.getElementById("btn-copy").addEventListener("click", copyCode);
document.getElementById("btn-copy2").addEventListener("click", copyCode);

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
