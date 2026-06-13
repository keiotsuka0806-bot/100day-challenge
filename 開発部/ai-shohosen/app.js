// AI処方箋 — 仕事の「面倒」を選ぶと、ChatGPTに貼れる効くプロンプトが出る。
// 完全クライアントサイド・APIキー不要・費用ゼロ。AIは呼ばない(プロンプトを渡すだけ)。

// ---- 処方箋データ -------------------------------------------------------
// template内の {key} は fields の key と対応。埋めると自動で差し替わる。
const CATS = [
  { id: "all", label: "すべて" },
  { id: "work", label: "📋 仕事を片づける" },
  { id: "write", label: "✍️ うまく伝える" },
  { id: "future", label: "🌱 将来の不安に効く" },
  { id: "money", label: "💰 副業・お金の不安" },
];

const RX = [
  {
    cat: "work", emoji: "✉️", title: "メールの下書きをまかせる",
    desc: "用件を入れるだけで、感じのいいビジネスメールに。",
    fields: [
      { key: "to", label: "誰に送る?", placeholder: "例：取引先の田中さん / 社内の上司" },
      { key: "yo", label: "伝えたいこと(ざっくりでOK)", type: "textarea", placeholder: "例：来週の打ち合わせを水曜から金曜に変えてほしい。先方の都合で。" },
      { key: "tone", label: "トーン", type: "select", options: ["丁寧でかための", "やわらかく親しみのある", "簡潔でビジネスライクな"] },
    ],
    template:
`あなたは日本語のビジネスメール作成のプロです。
以下の用件を、{tone}メールに仕上げてください。

- 宛先: {to}
- 用件: {yo}

条件:
- 件名も付ける
- 失礼のない自然な敬語で、長すぎないこと
- 相手が次に何をすればいいか分かるようにする
まず完成メールを出し、そのあとに「もう少し○○にしたい時はこう言ってください」と調整のヒントを1行添えてください。`,
    tip: "出てきたメールが固ければ「もっとやわらかく」、長ければ「半分の長さで」と追加で打てばOK。",
  },
  {
    cat: "work", emoji: "📝", title: "会議メモをタスクに変える",
    desc: "走り書きのメモを、要点＋やることリストに整理。",
    fields: [
      { key: "memo", label: "会議のメモ(箇条書き・乱雑でOK)", type: "textarea", placeholder: "ここに会議中のメモをそのまま貼る" },
    ],
    template:
`あなたは優秀なアシスタントです。以下の会議メモを整理してください。

会議メモ:
"""
{memo}
"""

次の3つに分けて出力してください。
1. 【決まったこと】箇条書き
2. 【やること(ToDo)】「誰が・何を・いつまでに」が分かる形で。担当や期限がメモに無ければ「(担当未定)」と書く
3. 【次回までの宿題・論点】

最後に、メモから読み取れない重要そうな抜けがあれば「確認した方がいい点」として挙げてください。`,
    tip: "ToDoだけ欲しい時は、出力後に「2のToDoだけ、コピーしやすい形で」と打つと便利。",
  },
  {
    cat: "work", emoji: "🗂️", title: "やることの優先順位づけ",
    desc: "あれもこれも…を、今日やる順番にしてくれる。",
    fields: [
      { key: "tasks", label: "今日やること(思いつくまま箇条書き)", type: "textarea", placeholder: "例：\n・資料作成\n・メール返信3件\n・経費精算\n・企画を考える" },
      { key: "time", label: "今日使える時間", placeholder: "例：午後の3時間くらい" },
    ],
    template:
`あなたは生産性コーチです。私の「今日やること」を、限られた時間で成果が出る順番に並べ直してください。

やること:
"""
{tasks}
"""
使える時間: {time}

出力:
1. おすすめの実行順(理由を一言ずつ)
2. 今日はやらなくていい/後回しでいいもの(あれば)
3. 最初の1個を、今すぐ始められるよう「最初の5分でやること」に分解
疲れている前提で、頑張りすぎない現実的な提案にしてください。`,
    tip: "「最初の5分」を読んだら、考えずにそれだけ始めるのがコツ。",
  },
  {
    cat: "work", emoji: "📄", title: "長い文章を3行で",
    desc: "読む気が起きない資料・記事を、要点だけに。",
    fields: [
      { key: "text", label: "要約したい文章を貼る", type: "textarea", placeholder: "ここに長い文章・記事・資料を貼る" },
    ],
    template:
`次の文章を読んで、忙しい人向けにまとめてください。

文章:
"""
{text}
"""

出力:
1. ひとことで言うと(1行)
2. 要点3つ(箇条書き)
3. 自分に関係しそうなら「私が取るべき行動」を1つ
専門用語は中学生にも分かる言葉に言い換えてください。`,
    tip: "もっと短く／もっと詳しく、は後から「2行で」「もう少し詳しく」と打てば調整できる。",
  },
  {
    cat: "write", emoji: "🙇", title: "角を立てずに断る・お願いする",
    desc: "言いにくいことを、相手を不快にさせず伝える。",
    fields: [
      { key: "situation", label: "どんな状況?", placeholder: "例：先輩に頼まれた仕事を、今は引き受けられない" },
      { key: "say", label: "本当に言いたいこと(本音でOK)", type: "textarea", placeholder: "例：今週は手一杯なので無理。来週なら少し手伝える。" },
    ],
    template:
`あなたは人間関係のコミュニケーションが得意なアドバイザーです。
以下を、角が立たず、でも言いたいことはちゃんと伝わる言い方にしてください。

- 状況: {situation}
- 私の本音: {say}

出力:
1. そのまま使える文例(2パターン：少し丁寧め / さらっと軽め)
2. 言い方のポイントを一言
相手を立てつつ、自分が我慢しすぎない、対等な言い方にしてください。`,
    tip: "口頭で言う時は、2パターンのうち「軽め」を声に出して練習すると自然になる。",
  },
  {
    cat: "write", emoji: "🪄", title: "自分の文章を読みやすく",
    desc: "ダラダラ書いた文を、伝わる文に整える。",
    fields: [
      { key: "text", label: "整えたい自分の文章", type: "textarea", placeholder: "ここに自分が書いた文章を貼る" },
    ],
    template:
`次の私の文章を、意味は変えずに読みやすく整えてください。

文章:
"""
{text}
"""

条件:
- 一文を短く、回りくどさを取る
- 元の自分らしさ・トーンは残す(別人のような硬さにしない)
- 直したあと、「どこをなぜ直したか」を2〜3点だけ教えてください(次から自分で書けるように)`,
    tip: "「自分らしさは残して」と入れているので、AIっぽい無機質な文になりにくい。",
  },
  {
    cat: "write", emoji: "🎤", title: "プレゼン・企画の骨子を作る",
    desc: "ゼロから考えるのがしんどい時の、たたき台。",
    fields: [
      { key: "theme", label: "テーマ・伝えたいこと", placeholder: "例：新しい勤怠アプリの社内提案" },
      { key: "who", label: "聞く相手は誰?", placeholder: "例：忙しい部長クラス" },
      { key: "goal", label: "相手にどうなってほしい?", placeholder: "例：導入を承認してもらう" },
    ],
    template:
`あなたはプレゼン設計のプロです。以下の骨子(構成案)を作ってください。

- テーマ: {theme}
- 聞く相手: {who}
- ゴール: {goal}

出力:
1. 全体の流れ(見出しレベルで5〜7ステップ)
2. 各ステップで言うべき要点を一言ずつ
3. 相手({who})が最も気にしそうな点と、それへの答え
4. 冒頭のつかみの一言(案)
たたき台なので、私が直しやすいように簡潔にしてください。`,
    tip: "骨子が出たら「3番を詳しく」「スライド枚数の目安は?」と掘り下げられる。",
  },
  {
    cat: "future", emoji: "💪", title: "自分の強みを言語化する",
    desc: "「強みなんてない」を、棚卸しでほどく。",
    fields: [
      { key: "exp", label: "これまでやってきたこと(仕事・趣味・なんでも)", type: "textarea", placeholder: "例：5年接客 → 事務に異動。人の話を聞くのは得意。地味な作業も苦じゃない。など箇条書きでOK" },
    ],
    template:
`あなたはキャリアカウンセラーです。私の経験から「強み」を一緒に言語化してください。

私の経験:
"""
{exp}
"""

出力:
1. ここから見える強み3つ(なぜそう言えるか、経験を根拠に)
2. その強みが活きる場面・仕事の例
3. 職務経歴書やプロフィールに書くなら、という一文(各強み)
「大したことない」と私が思っている部分にも、価値を見つけてください。`,
    tip: "出てきた強みにピンと来なければ「もっと地味な強みも」「自分では気づきにくいものを」と頼むと深掘りできる。",
  },
  {
    cat: "future", emoji: "🌙", title: "キャリアのもやもや壁打ち",
    desc: "答えより先に、考えを整理する問いをくれる。",
    fields: [
      { key: "moya", label: "いま感じているもやもや(まとまってなくてOK)", type: "textarea", placeholder: "例：今の仕事を続けていいのか不安。でも何がしたいかも分からない。" },
    ],
    template:
`あなたは聞き上手なキャリアコーチです。いきなり結論を出さず、私の考えの整理を手伝ってください。

私のもやもや:
"""
{moya}
"""

進め方:
1. まず、私の気持ちを否定せずに一度受け止めてください
2. もやもやを「事実」「感情」「思い込みかもしれないこと」に分けて整理
3. 私が自分で気づけるように、深掘りの質問を3つだけ投げかけてください(一気に聞かず、1問ずつでもOK)
励ましすぎず、でも冷たくならない、対等な相談相手として接してください。`,
    tip: "質問が来たら、考えながらそのまま返信していけばOK。会話を続けるのが目的。",
  },
  {
    cat: "future", emoji: "🗺️", title: "学びの最初の一歩マップ",
    desc: "「何から始めれば」を、現実的な順番に。",
    fields: [
      { key: "want", label: "学びたいこと・なりたい姿", placeholder: "例：AIを仕事に使えるようになりたい" },
      { key: "now", label: "今のレベル・使える時間", placeholder: "例：完全な初心者。平日30分くらい" },
    ],
    template:
`あなたは学習設計のプロです。挫折しない最初のロードマップを作ってください。

- 学びたいこと: {want}
- 今のレベル・使える時間: {now}

出力:
1. 最初の2週間でやること(小さすぎるくらい具体的に。1日分が短時間で終わる単位)
2. つまずきやすいポイントと対処
3. 「これができたら一歩前進」という小さなゴール3段階
やる気に頼らず、疲れていても続けられる現実的な分量にしてください。`,
    tip: "重く感じたら「もっと小さく」「1日10分版で」と頼むと、ハードルを下げてくれる。",
  },
  {
    cat: "money", emoji: "🧭", title: "自分に合う副業を見つける",
    desc: "スキルと使える時間から、現実的な候補を出す。",
    fields: [
      { key: "skill", label: "できること・経験・好きなこと", type: "textarea", placeholder: "例：事務5年、Excelは得意、文章を書くのは好き、人と話すのは苦手" },
      { key: "time", label: "副業に使える時間・体力", placeholder: "例：平日夜に1時間、土日少し。疲れててもできる範囲で" },
      { key: "money", label: "増やしたい金額の目安(任意)", placeholder: "例：まず月+1〜3万円くらい" },
    ],
    template:
`あなたは現実的なキャリア・副業アドバイザーです。煽らず、誠実に提案してください。

私の状況:
- できること/経験: {skill}
- 使える時間・体力: {time}
- 増やしたい金額の目安: {money}

条件(重要):
- 一発逆転・情報商材・「簡単に月◯万」のような誇張は絶対にしない
- 私のスキルと時間で「現実的に続けられる」ものだけを挙げる
- 初期費用やリスクが高いものは正直にそう書く

出力:
1. 私に合いそうな副業の候補を3つ。それぞれ
   - どんな仕事か / なぜ私に合うか
   - 始め方の「最初の一歩」
   - 軌道に乗った場合に現実的な収入の目安(誇張せず、幅で)
   - 向いていない人・つまずきやすい点
2. 3つの中で、まず試すなら?という一押しを理由つきで
疲れている前提で、小さく始められる順に並べてください。`,
    tip: "ピンと来なければ「もっと地味でもいい」「在宅だけで」「人と話さないもの」など条件を足して再度。",
  },
  {
    cat: "money", emoji: "👣", title: "副業の最初の一歩を決める",
    desc: "気になってるけど動けない…を、今週末の行動に。",
    fields: [
      { key: "kibun", label: "気になっている副業", placeholder: "例：クラウドソーシングでライティング" },
      { key: "tomaru", label: "踏み出せない理由(正直に)", type: "textarea", placeholder: "例：自分にできる気がしない。何から登録すればいいか分からない。失敗が怖い。" },
    ],
    template:
`あなたは行動を後押しするコーチです。私の「やってみたいけど動けない」を解きほぐしてください。

- 気になっている副業: {kibun}
- 踏み出せない理由: {tomaru}

出力:
1. 私の不安をまず受け止め、その不安が現実的にどれくらいのリスクか冷静に整理
2. リスクを最小にした「お試しの第一歩」を1つだけ提案(失敗しても痛くない規模で)
3. それを「今週末にできる具体的な行動」に分解(1ステップ15分以内)
4. 最初のステップを、今すぐ始められる形にもう一段細かく
やる気に頼らず、考えなくても手が動く粒度にしてください。`,
    tip: "出てきた「最初の15分」だけ、考えずにやってみる。それで十分一歩前進。",
  },
  {
    cat: "money", emoji: "🛠️", title: "自分のスキルを売ってみる",
    desc: "クラウドソーシングで最初の1件を取る準備。",
    fields: [
      { key: "uri", label: "売れそうなこと・提供できること", placeholder: "例：資料作成、文字起こし、簡単なデータ入力、SNS運用の手伝い" },
      { key: "keiken", label: "関連する経験・実績(少しでOK)", type: "textarea", placeholder: "例：本業で毎週プレゼン資料を作っている。前にブログを書いていた。" },
    ],
    template:
`あなたはクラウドソーシング(ランサーズ・クラウドワークス・ココナラ等)で稼ぐ人を支援するアドバイザーです。

私が売れそうなこと: {uri}
関連する経験: {keiken}

出力:
1. この内容で「最初の1件」を取りやすい案件タイプ・サービス例
2. プロフィール文のたたき台(実績が少なくても信頼される書き方で)
3. 案件への提案文(応募メッセージ)のテンプレ。コピーして少し直せば使える形で
4. 最初は単価より「評価・実績を1件作る」ことを優先すべき理由を一言
誇張や嘘の実績は書かず、正直で誠実なトーンにしてください。`,
    tip: "最初の1件は単価より「評価をもらうこと」が目的。終わったら次から強くなる。",
  },
];

// ---- 状態 ---------------------------------------------------------------
let activeCat = "all";
let current = null;          // 開いている処方箋
let values = {};             // 入力中の値

const $ = (id) => document.getElementById(id);

// ---- カテゴリ描画 -------------------------------------------------------
function renderFilters() {
  const nav = $("filters");
  nav.innerHTML = "";
  CATS.forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip" + (c.id === activeCat ? " active" : "");
    b.textContent = c.label;
    b.addEventListener("click", () => { activeCat = c.id; renderFilters(); renderGrid(); });
    nav.appendChild(b);
  });
}

// ---- 一覧描画 -----------------------------------------------------------
function catLabel(id) {
  const c = CATS.find((x) => x.id === id);
  return c ? c.label : "";
}
function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  const list = RX.filter((r) => activeCat === "all" || r.cat === activeCat);
  list.forEach((r) => {
    const card = document.createElement("div");
    card.className = "rx";
    card.innerHTML = `
      <span class="rx-emoji">${r.emoji}</span>
      <span class="rx-title"></span>
      <span class="rx-desc"></span>
      <span class="rx-cat"></span>`;
    card.querySelector(".rx-title").textContent = r.title;
    card.querySelector(".rx-desc").textContent = r.desc;
    card.querySelector(".rx-cat").textContent = catLabel(r.cat);
    card.addEventListener("click", () => openModal(r));
    grid.appendChild(card);
  });
}

// ---- モーダル -----------------------------------------------------------
function openModal(rx) {
  current = rx;
  values = {};
  $("mCat").textContent = catLabel(rx.cat);
  $("mTitle").textContent = rx.title;
  $("mDesc").textContent = rx.desc;
  $("mTip").textContent = "💡 " + rx.tip;

  const wrap = $("mFields");
  wrap.innerHTML = "";
  rx.fields.forEach((f) => {
    const id = "f_" + f.key;
    const block = document.createElement("div");
    let control;
    if (f.type === "textarea") {
      control = `<textarea id="${id}" placeholder="${f.placeholder || ""}"></textarea>`;
    } else if (f.type === "select") {
      const opts = f.options.map((o) => `<option value="${o}">${o}</option>`).join("");
      control = `<select id="${id}">${opts}</select>`;
    } else {
      control = `<input type="text" id="${id}" placeholder="${f.placeholder || ""}" />`;
    }
    block.innerHTML = `<label for="${id}">${f.label}</label>${control}`;
    wrap.appendChild(block);
    // selectは初期値をvaluesに入れておく
    if (f.type === "select") values[f.key] = f.options[0];
  });

  // 入力イベント
  rx.fields.forEach((f) => {
    const el = $("f_" + f.key);
    el.addEventListener("input", () => { values[f.key] = el.value; updatePreview(); });
    el.addEventListener("change", () => { values[f.key] = el.value; updatePreview(); });
  });

  updatePreview();
  $("copyBtn").textContent = "この文をコピー";
  $("copyBtn").classList.remove("copied");
  $("modal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("modal").hidden = true;
  document.body.style.overflow = "";
  current = null;
}

// プレビュー(未入力の{key}は【ラベル】で目立たせる)
function buildText(forCopy) {
  let t = current.template;
  current.fields.forEach((f) => {
    const v = (values[f.key] || "").trim();
    const token = "{" + f.key + "}";
    if (v) {
      t = t.split(token).join(v);
    } else if (forCopy) {
      t = t.split(token).join("【" + f.label + "】");
    } else {
      t = t.split(token).join("[[PH]]【" + f.label + "】[[/PH]]");
    }
  });
  return t;
}
function updatePreview() {
  const raw = buildText(false);
  const html = escapeHtml(raw)
    .split("[[PH]]").join('<span class="ph">')
    .split("[[/PH]]").join("</span>");
  $("mPreview").innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

async function copyPrompt() {
  const text = buildText(true);
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("copyBtn");
    btn.textContent = "コピーしました ✓ ChatGPTに貼ってね";
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = "この文をコピー"; btn.classList.remove("copied"); }, 2200);
  } catch (_) {
    alert("コピーに失敗しました。プレビューを長押し/選択してコピーしてください。");
  }
}

// ---- イベント -----------------------------------------------------------
$("modalBg").addEventListener("click", closeModal);
$("modalClose").addEventListener("click", closeModal);
$("copyBtn").addEventListener("click", copyPrompt);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal").hidden) closeModal(); });

// ---- 起動 ---------------------------------------------------------------
renderFilters();
renderGrid();
