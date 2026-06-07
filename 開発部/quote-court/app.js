// ── Scoring ──
const SCORE = {
  normalCorrect: 10,
  sureCorrect:   20,
  sureWrong:    -15,
  normalWrong:    0,
};
// combo streak → multiplier (index = streak count, capped at 3)
const COMBO_MULT = [1, 1, 2, 3];

// ── Case bank（ランダム10件を選出して使用） ──
const CASE_BANK = [
  { quote: '狂気の定義とは、同じことを繰り返しながら、異なる結果を期待することだ。', author: 'アルベルト・アインシュタイン', context: '物理学者・ノーベル賞受賞者（1879–1955）', isReal: false, indictment: 'アインシュタインの著作・書簡を網羅的に調査した研究者たちが、この言葉を一切発見できていない。', truthHeader: '❌ フェイク — NAの文書が初出', truth: '最古の記録は1981年の薬物依存症更生プログラム「ナルコティクス・アノニマス（NA）」の文書。プリンストン大学のアインシュタイン文書プロジェクトも「彼の言葉である証拠はない」と明言している。' },
  { quote: 'あなたが世界に見たいと思う変化に、あなた自身がなりなさい。', author: 'マハトマ・ガンジー', context: '独立運動の指導者・非暴力の象徴（1869–1948）', isReal: false, indictment: 'ガンジーの演説・著作を専門に研究する学者たちが、グジャラート語・英語のいずれの原文も発見できていない。', truthHeader: '❌ フェイク — 2000年代SNS起源', truth: 'ガンジーの著作に類似した思想はあるが、この形の言葉は存在しない。New York Times（2011年）でも「誤引用」として指摘された。' },
  { quote: '智に働けば角が立つ。情に棹させば流される。意地を通せば窮屈だ。とかくに人の世は住みにくい。', author: '夏目漱石', context: '小説家・英文学者（1867–1916）', isReal: true, indictment: 'あまりに洗練された表現で、後世の編集者が創作したという説が一部で囁かれている。', truthHeader: '✅ 本物 — 草枕（1906年）に記載', truth: '1906年（明治39年）発表の小説『草枕』の冒頭。漱石自身の直筆原稿が現存しており、疑いの余地はない。' },
  { quote: '敵がいないなら、人生で一度も真実を語ったことも、正義のために立ち上がったこともないということだ。', author: 'ウィンストン・チャーチル', context: '英国首相・第二次世界大戦を指導（1874–1965）', isReal: false, indictment: 'チャーチルセンター（公式研究機関）は「チャーチルの名を冠した名言の多くは創作か誤引用」と公式に警告している。', truthHeader: '❌ フェイク — チャーチルセンターが否定', truth: 'チャーチルセンターの研究員は「彼に帰属される言葉の3割以上は出典不明か別人の言葉」と指摘している。' },
  { quote: '神は死んだ。神は死んだままだ。そして我々が神を殺したのだ。', author: 'フリードリヒ・ニーチェ', context: '哲学者・「権力への意志」を説いた（1844–1900）', isReal: true, indictment: '過激すぎる内容から、後世の研究者が哲学的効果のために創作したという説もある。', truthHeader: '✅ 本物 — 悦ばしき知識（1882年）に記載', truth: '1882年の著作『悦ばしき知識』第125節「狂人」に記載。「神の死」は近代における伝統的価値観の崩壊を指す比喩的表現。' },
  { quote: '我思う、ゆえに我あり。', author: 'ルネ・デカルト', context: '哲学者・近代哲学の父（1596–1650）', isReal: true, indictment: '有名すぎるラテン語「Cogito, ergo sum」は実は『方法序説』には書かれていないという説がある。', truthHeader: '✅ 本物 — 方法序説（1637年）ほかに記載', truth: '1637年の『方法序説』ではフランス語で、1644年の『哲学原理』ではラテン語で記されている。近代哲学の出発点となった言葉。' },
  { quote: '20年後、あなたはやったことよりも、やらなかったことを後悔するだろう。', author: 'マーク・トウェイン', context: '小説家・『トム・ソーヤーの冒険』著者（1835–1910）', isReal: false, indictment: 'マーク・トウェインプロジェクトが著作・書簡・日記を全て調査したが出典を確認できていない。', truthHeader: '❌ フェイク — H・J・ブラウンJrの母の言葉', truth: '作家H・ジャクソン・ブラウン・Jr.が1990年の著書で「私の母が言った言葉」として引用したもの。それがトウェインに誤帰属されてSNSで広まった。' },
  { quote: '人生は自転車に乗るようなものだ。バランスを保つには走り続けなければならない。', author: 'アルベルト・アインシュタイン', context: '物理学者・ノーベル賞受賞者（1879–1955）', isReal: true, indictment: 'アインシュタインに誤帰属される名言があまりに多いため、本物の言葉まで疑わしく見える。', truthHeader: '✅ 本物 — 1930年の息子への手紙に記載', truth: '1930年2月5日、息子エドゥアルトへ送った手紙にドイツ語で記されている。アインシュタイン文書プロジェクトで原本が確認されている。' },
  { quote: 'すべての人をいつまでも騙すことはできない。一部の人をいつまでも騙すことはできる。しかしすべての人をいつまでも騙すことは誰にもできない。', author: 'エイブラハム・リンカーン', context: '第16代アメリカ大統領・奴隷解放宣言（1809–1865）', isReal: false, indictment: 'リンカーンの演説・書簡を専門に管理する研究者が、この言葉の出典を確認できていない。', truthHeader: '❌ フェイク — 死後30年以上後に初出', truth: 'リンカーン文書のどこにも出典が見当たらない。最初に記録されたのは彼の死後30年以上経った1887年の新聞記事。' },
  { quote: '世界がぜんたい幸福にならないうちは、個人の幸福はあり得ない。', author: '宮沢賢治', context: '詩人・童話作家・『銀河鉄道の夜』著者（1896–1933）', isReal: true, indictment: '宮沢賢治は詩や童話で知られるが、このような社会哲学的な宣言を書いたとは考えにくいという見方もある。', truthHeader: '✅ 本物 — 農民芸術概論綱要（1926年）に記載', truth: '1926年（大正15年）に執筆した『農民芸術概論綱要』の序論冒頭に記された言葉。賢治の芸術・人生哲学の核心を表している。' },

  // ── 追加10件 ──
  { quote: '最も強い者が生き残るのではなく、最も賢い者が生き残るのでもない。唯一生き残ることができるのは、変化できる者だ。', author: 'チャールズ・ダーウィン', context: '生物学者・「種の起源」著者（1809–1882）', isReal: false, indictment: '「進化論の父」ダーウィンが言いそうな言葉だが、彼の著作を調査した研究者がこの表現を発見できていない。', truthHeader: '❌ フェイク — メギンソン（1963年）の解釈が起源', truth: '経営学者レオン・C・メギンソンが1963年の論文でダーウィンの進化論を「解釈」した言葉。ダーウィン自身の著作にはなく、SNSを経由してダーウィンの言葉として世界中に広まった。' },
  { quote: 'あなたの意見には反対だ。だがあなたがその意見を述べる権利は、命をかけて守る。', author: 'ヴォルテール', context: '哲学者・啓蒙思想家（1694–1778）', isReal: false, indictment: 'ヴォルテールの著作・書簡を専門に研究する学者たちが、この言葉の原文を発見できていない。', truthHeader: '❌ フェイク — エヴリン・ホールの創作（1906年）', truth: '作家エヴリン・ビアトリス・ホールが1906年の著書『ヴォルテールの友人たち』でヴォルテールの「精神」を表現するために創作した文章。ヴォルテール自身の言葉ではない。' },
  { quote: '優れた芸術家は模倣し、偉大な芸術家は盗む。', author: 'パブロ・ピカソ', context: '画家・「ゲルニカ」などで知られる（1881–1973）', isReal: false, indictment: 'ピカソの言葉として世界中で引用されるが、彼の発言記録・インタビュー・著作にこの表現が見当たらない。', truthHeader: '❌ フェイク — T・S・エリオットの言葉が混同された可能性', truth: '詩人T・S・エリオットが1920年の評論で書いた「未熟な詩人は模倣し、成熟した詩人は盗む」という表現との混同とされる。スティーブ・ジョブズがピカソの言葉として引用したことで広まった。' },
  { quote: '若い頃に保守主義者でなければ心がない。年老いて自由主義者でなければ頭がない。', author: 'ウィンストン・チャーチル', context: '英国首相・第二次世界大戦を指導（1874–1965）', isReal: false, indictment: 'チャーチルセンターが「この言葉がチャーチルの著作・演説に存在する証拠はない」と公式に否定している。', truthHeader: '❌ フェイク — 19世紀から存在する格言にチャーチルを誤引用', truth: '類似の格言は19世紀から複数の形で存在しており、フランスの政治家ギゾーやバーナード・ショーにも帰属されてきた。チャーチルセンターの研究員が徹底調査したが、彼の言葉である証拠はない。' },
  { quote: '不可能という言葉は愚か者の辞書にしか存在しない。', author: 'ナポレオン・ボナパルト', context: '軍人・フランス皇帝（1769–1821）', isReal: false, indictment: 'ナポレオンの書簡・演説を収録した歴史的資料を調査した研究者が、この言葉の出典を確認できていない。', truthHeader: '❌ フェイク — 出典不明、19世紀以降に創作された可能性が高い', truth: 'ナポレオンの言葉を収録した史料のどこにも見当たらない。彼のイメージ（強意志・戦略家）に合う言葉として後世に創作・帰属されたと考えられている。類似表現は複数の別人物にも帰属される。' },
  { quote: '生きるべきか、死ぬべきか、それが問題だ。', author: 'ウィリアム・シェイクスピア', context: '劇作家・詩人（1564–1616）', isReal: true, indictment: 'あまりに有名なセリフだが、シェイクスピア自身の言葉ではなく、劇中の登場人物の台詞という指摘がある。', truthHeader: '✅ 本物 — ハムレット第3幕第1場（1603年頃）に記載', truth: '戯曲『ハムレット』第3幕第1場の冒頭でハムレットが語る独白の出だし。原文は英語で"To be, or not to be, that is the question."。シェイクスピアが創作した登場人物の言葉であることは事実だが、作者の作品として本物。' },
  { quote: '彼を知り己を知れば百戦殆からず。', author: '孫子', context: '中国の兵法家・『孫子兵法』著者（紀元前544頃–紀元前496頃）', isReal: true, indictment: '孫子は実在したか自体が議論されており、「孫子兵法」は後世の人物が編纂した可能性があると指摘されている。', truthHeader: '✅ 本物 — 孫子兵法「謀攻篇」に記載', truth: '孫子兵法「謀攻篇」の一節。原文は「知彼知己、百戦不殆」。著者の実在性に関する議論はあるものの、この言葉が書物に記載されていること自体は古代から確認されている。' },
  { quote: 'ハングリーであれ。愚かであれ。', author: 'スティーブ・ジョブズ', context: 'Apple共同創業者（1955–2011）', isReal: true, indictment: 'スティーブ・ジョブズの言葉として広まっているが、彼が創作した言葉ではなく別の出典があるという説がある。', truthHeader: '✅ 本物 — スタンフォード大学卒業式スピーチ（2005年）で引用', truth: '2005年のスタンフォード大学卒業式でジョブズが述べた言葉。正確には、カウンターカルチャー雑誌「Whole Earth Catalog」最終号の裏表紙に書かれていた言葉を引用したもので、ジョブズ自身も出典を明かしている。' },
  { quote: '万国の労働者よ、団結せよ！', author: 'カール・マルクス', context: '経済学者・哲学者・『資本論』著者（1818–1883）', isReal: true, indictment: 'マルクス一人の言葉として知られるが、実際は共著者がいるという指摘がある。', truthHeader: '✅ 本物 — 共産党宣言（1848年）の結びの言葉', truth: '1848年にマルクスとフリードリヒ・エンゲルスが共著した『共産党宣言』の結びの一節。原文はドイツ語で「Proletarier aller Länder, vereinigt euch!」。マルクスとエンゲルスの共著であるが、マルクスの言葉として広く引用される。' },
  { quote: '天は人の上に人を造らず、人の下に人を造らず。', author: '福沢諭吉', context: '思想家・慶應義塾創設者（1835–1901）', isReal: true, indictment: 'あまりに有名な一節だが、福沢諭吉が書いた文章には「天は〜造らず」の後に続く文脈があり、現代の解釈とは意味が異なるという説がある。', truthHeader: '✅ 本物 — 学問のすすめ（1872年）冒頭に記載', truth: '1872年（明治5年）発表の『学問のすすめ』冒頭の言葉。この後に「されども今広く此人間世界を見渡すに〜」と続き、人は生まれながらに平等でも実際には差がある、だから学問が必要だという論旨へ展開する。' },
];

// case-bank-extra.js で定義された EXTRA_CASES をマージ
const ALL_CASES = typeof EXTRA_CASES !== 'undefined' ? [...CASE_BANK, ...EXTRA_CASES] : CASE_BANK;

const RANKS = [
  { min: 200, label: '⚖️ 最高裁判事',  msg: '完璧な判決。名言鑑定士の称号を授与する。' },
  { min: 120, label: '🏛️ 敏腕弁護士',  msg: '鋭い洞察力と大胆な賭けで高得点を叩き出した。' },
  { min: 60,  label: '📋 陪審員',        msg: '堅実な判決。コンボと確信をもっと活かせ。' },
  { min: 0,   label: '🔍 見習い探偵',   msg: '名言の世界は奥深い。もう一度挑戦しよう。' },
  { min: -99, label: '📚 歴史の被告',   msg: '確信あり連発で大失点…知識は武器だ。' },
];

const FIXED_EXCLUSIONS = 'アインシュタイン「狂気の定義」、ガンジー「世界に見たい変化」、夏目漱石「智に働けば」、チャーチル「敵がいない」、ニーチェ「神は死んだ」、デカルト「我思う」、マーク・トウェイン「20年後」、アインシュタイン「自転車」、リンカーン「すべての人を騙せない」、宮沢賢治「世界がぜんたい幸福に」';

const FIGURE_POOL = [
  // 東洋思想
  '老子', '荘子', '墨子', '韓非子', '孟子', '王陽明', '朱熹',
  // 日本
  '松尾芭蕉', '坂本龍馬', '西郷隆盛', '渋沢栄一', '松下幸之助', '本田宗一郎',
  '芥川龍之介', '太宰治', '川端康成', '三島由紀夫', '宮本武蔵', '二宮金次郎',
  // ヨーロッパ哲学
  'イマヌエル・カント', 'ゲオルク・ヘーゲル', 'アルトゥル・ショーペンハウアー',
  'セーレン・キルケゴール', 'ルートヴィヒ・ウィトゲンシュタイン',
  'ジャン＝ポール・サルトル', 'アルベール・カミュ', 'シモーヌ・ド・ボーヴォワール',
  'バールーフ・スピノザ', 'ゴットフリート・ライプニッツ', 'デイヴィッド・ヒューム',
  'ジョン・ロック', 'ジャン＝ジャック・ルソー', 'フランシス・ベーコン',
  // 文学
  'ヨハン・ヴォルフガング・フォン・ゲーテ', 'レフ・トルストイ',
  'フョードル・ドストエフスキー', 'フランツ・カフカ', 'アーネスト・ヘミングウェイ',
  'ホルヘ・ルイス・ボルヘス', '魯迅', 'シャルル・ボードレール',
  'ライナー・マリア・リルケ', 'アントン・チェーホフ', 'オスカー・ワイルド',
  'ヴィクトル・ユゴー', 'ハンス・クリスチャン・アンデルセン',
  // 女性・芸術
  'マリー・キュリー', 'フリーダ・カーロ', 'フィンセント・ファン・ゴッホ',
  'サルバドール・ダリ', 'クロード・モネ', '葛飾北斎', 'グスタフ・クリムト',
  'ポール・セザンヌ', 'エドガー・ドガ',
  // 科学・発明
  'アイザック・ニュートン', 'ニコラ・テスラ', 'トーマス・エジソン',
  'スティーブン・ホーキング', 'リチャード・ファインマン', 'ルイ・パスツール',
  'ベンジャミン・フランクリン', '湯川秀樹', 'ジェームズ・ワット',
  // 政治・思想
  'オットー・フォン・ビスマルク', 'ネルソン・マンデラ', '孫文',
  'ニッコロ・マキャヴェリ', 'アダム・スミス', 'ジョン・スチュアート・ミル',
  'ピーター・ドラッカー', 'マックス・ウェーバー',
];

function pickFiguresForGame() {
  const used = new Set(getUsedAuthors());
  const available = FIGURE_POOL.filter(name => !used.has(name));
  const pool = available.length >= 10 ? available : FIGURE_POOL;
  return pool.sort(() => Math.random() - 0.5).slice(0, 10);
}

function getUsedAuthors() {
  try {
    const parsed = JSON.parse(localStorage.getItem('quoteCourt_usedAuthors') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getUsedQuotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem('quoteCourt_usedQuotes') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsedAuthors(cases) {
  const prev = getUsedAuthors();
  const newAuthors = cases.map(c => c.author);
  const merged = [...new Set([...prev, ...newAuthors])].slice(-50);
  localStorage.setItem('quoteCourt_usedAuthors', JSON.stringify(merged));
}

function saveUsedQuotes(cases) {
  const prev = getUsedQuotes();
  const newQuotes = cases.map(c => `${c.author}「${c.quote.substring(0, 25)}」`);
  const merged = [...new Set([...prev, ...newQuotes])].slice(-100);
  localStorage.setItem('quoteCourt_usedQuotes', JSON.stringify(merged));
}

function buildPrompt() {
  const figures = pickFiguresForGame();

  return `あなたは「名言法廷」というゲームのコンテンツクリエイターです。
歴史的な名言の真偽を判定するゲーム用に、10件の「事件」を生成してください。

【絶対条件】以下の10人について、1人1件ずつ必ず生成すること。この10人以外の人物を使うことは禁止：
${figures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

以下のJSON配列のみを返してください（前後の説明文・コードブロック記号不要）：

[
  {
    "quote": "名言のテキスト（日本語）",
    "author": "上記リストの人物名をそのまま使う",
    "context": "人物説明（職業・代表作・生没年など25字以内）",
    "isReal": true,
    "indictment": "疑惑のヒントや注目すべき点（70字以内）",
    "truthHeader": "✅ 本物 — ひとことで真実を（30字以内）",
    "truth": "詳しい解説。出典・背景を含む（150〜250字）"
  }
]

【ルール】
1. 本物5件・フェイク5件を厳密に含める
2. フェイクのtruthHeaderは「❌ フェイク — 〇〇の言葉ではない」形式
3. 本物のtruthHeaderは「✅ 本物 — 〇〇に記載」形式
4. 本物には必ず著作名と年代を含める
5. フェイクは実際にSNS等で誤帰属されている事例、または別人の言葉を提示する形式`;
}

// ── Audio ──
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.3, vol = 0.25) {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playGavel() {
  try {
    const ctx = getAudio();
    const bufLen = Math.floor(ctx.sampleRate * 0.15);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.5, ctx.currentTime);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch {}
}

function playCorrect(sure) {
  if (sure) {
    playTone(523, 'sine', 0.12, 0.3);
    setTimeout(() => playTone(659, 'sine', 0.12, 0.3), 120);
    setTimeout(() => playTone(784, 'sine', 0.25, 0.3), 240);
  } else {
    playTone(523, 'sine', 0.12, 0.2);
    setTimeout(() => playTone(659, 'sine', 0.2, 0.2), 120);
  }
}

function playWrong(sure) {
  if (sure) {
    playTone(220, 'sawtooth', 0.4, 0.35);
    setTimeout(() => playTone(180, 'sawtooth', 0.3, 0.3), 200);
  } else {
    playTone(250, 'sawtooth', 0.3, 0.25);
  }
}

function playComboUp(streak) {
  const notes = [659, 784, 1047];
  const note = notes[Math.min(streak - 2, notes.length - 1)];
  playTone(note, 'sine', 0.2, 0.3);
}

// ── Effects ──
function shakeScreen() {
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 500);
}

function showFloat(text, type) {
  const el = document.createElement('div');
  el.className = `float-score float-${type}`;
  el.textContent = text;
  // position near verdict buttons area
  el.style.left = '50%';
  el.style.top = '60%';
  document.getElementById('floatContainer').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ── State ──
let currentCases = [];
let currentIndex = 0;
let totalScore = 0;
let streak = 0;
let maxStreak = 0;
let confidence = 'normal';
let answers = [];
let typewriterTimer = null;
let gameStarting = false;

const $ = id => document.getElementById(id);

// ── Start screen ──
function showStartSection(id) {
  ['setupSection', 'readySection', 'staticSection', 'loadingSection'].forEach(s => {
    const el = $(s); if (el) el.classList.add('hidden');
  });
  const target = $(id); if (target) target.classList.remove('hidden');
}

function initStartScreen() {
  const best = localStorage.getItem('quoteCourt_best');
  const bestCombo = localStorage.getItem('quoteCourt_bestCombo');
  $('highScore').textContent = best ? `${best}pts` : '—';
  $('highCombo').textContent = bestCombo ? `×${bestCombo}` : '—';
  showStartSection('readySection');
}

// ── Case generation via Vercel Function ──
function pickRandomCases(n = 10) {
  const usedAuthors = new Set(getUsedAuthors());
  const shuffled = [...ALL_CASES].sort(() => Math.random() - 0.5);
  const seen = new Set();
  const result = [];
  // まず使用済み人物を除外して選ぶ
  for (const c of shuffled) {
    if (!seen.has(c.author) && !usedAuthors.has(c.author) && result.length < n) {
      seen.add(c.author);
      result.push(c);
    }
  }
  // 足りない場合は使用済みからも補充（重複なしで）
  if (result.length < n) {
    for (const c of shuffled) {
      if (!seen.has(c.author) && result.length < n) {
        seen.add(c.author);
        result.push(c);
      }
    }
  }
  return result;
}

async function fetchAndFilterCases() {
  const usedAuthors = new Set(getUsedAuthors());
  const res = await fetch('/api/generateCases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildPrompt() }),
  });
  if (!res.ok) throw new Error(`サーバーエラー (${res.status})`);
  const data = await res.json();
  if (!data.content?.[0]?.text) throw new Error(data.error?.message || '不正なレスポンス形式');
  const raw = data.content[0].text;
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const cases = JSON.parse(jsonStr);
  if (!Array.isArray(cases) || cases.length === 0) throw new Error('不正なレスポンス');
  const seen = new Set();
  const deduped = cases.filter(c => {
    if (!c.author || seen.has(c.author) || usedAuthors.has(c.author)) return false;
    seen.add(c.author);
    return true;
  });
  return deduped;
}

async function generateCases() {
  showStartSection('loadingSection');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const deduped = await fetchAndFilterCases();
      if (deduped.length >= 8) return deduped;
    } catch (e) {
      console.warn(`生成失敗（試行${attempt + 1}/3）:`, e.message);
    }
  }
  return pickRandomCases();
}

// ── Game rendering ──
function getMultiplier() {
  return COMBO_MULT[Math.min(streak, COMBO_MULT.length - 1)];
}

function updateComboDisplay() {
  const combo = $('comboDisplay');
  if (streak >= 2) {
    combo.classList.remove('hidden');
    $('comboFire').textContent = streak >= 4 ? '🔥🔥' : '🔥';
    $('comboText').textContent = `×${getMultiplier()} COMBO`;
    combo.classList.toggle('combo-max', streak >= 4);
  } else {
    combo.classList.add('hidden');
  }
}

function showIndictmentToast() {
  const existing = document.querySelector('.indictment-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'indictment-toast';
  el.textContent = '📋　起訴状が届きました';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}

function typewriterText(el, text, delay = 30) {
  if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
  el.textContent = '';
  if (!text) return;
  let i = 0;
  typewriterTimer = setInterval(() => {
    el.textContent += text[i];
    i++;
    if (i >= text.length) { clearInterval(typewriterTimer); typewriterTimer = null; }
  }, delay);
}

async function fetchWikipediaImage(name) {
  for (const lang of ['ja', 'en']) {
    try {
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`
      );
      const data = await res.json();
      if (data.thumbnail?.source) return data.thumbnail.source;
    } catch {}
  }
  return null;
}

function renderCase() {
  const c = currentCases[currentIndex];
  $('caseNumber').textContent = `第${currentIndex + 1}事件`;
  $('caseProgress').textContent = `${currentIndex + 1}/${currentCases.length}`;
  $('progressFill').style.width = `${((currentIndex + 1) / currentCases.length) * 100}%`;
  $('ptsDisplay').textContent = totalScore;
  $('quoteText').textContent = `「${c.quote}」`;
  $('authorName').textContent = c.author;
  $('authorContext').textContent = c.context;
  // 起訴状アニメーション
  const strip = document.querySelector('.indictment-strip');
  $('indictmentText').textContent = '';
  strip.classList.remove('dropping');
  void strip.offsetWidth;
  showIndictmentToast();
  setTimeout(() => {
    strip.classList.add('dropping');
    playTone(300, 'sine', 0.2, 0.2);
  }, 1000);
  setTimeout(() => typewriterText($('indictmentText'), c.indictment, 45), 1500);

  // 著者画像をWikipediaから非同期取得
  const portrait = $('authorPortrait');
  const placeholder = $('portraitPlaceholder');
  portrait.src = '';
  portrait.classList.add('hidden');
  if (placeholder) placeholder.style.display = 'flex';
  const caseIndex = currentIndex;
  fetchWikipediaImage(c.author).then(url => {
    if (currentIndex !== caseIndex) return;
    if (url) {
      portrait.src = url;
      portrait.classList.remove('hidden');
      if (placeholder) placeholder.style.display = 'none';
    }
  });

  // reset confidence
  confidence = 'normal';
  $('confNormal').classList.add('active');
  $('confSure').classList.remove('active');

  $('realBtn').disabled = false;
  $('fakeBtn').disabled = false;

  updateComboDisplay();
}

function handleVerdict(choice) {
  const c = currentCases[currentIndex];
  const isSure = confidence === 'sure';
  const correct = (choice === 'real') === c.isReal;

  let pts = 0;
  let mult = 1;
  if (correct) {
    const base = isSure ? SCORE.sureCorrect : SCORE.normalCorrect;
    mult = getMultiplier();
    pts = base * mult;
    streak++;
    maxStreak = Math.max(maxStreak, streak);
  } else {
    pts = isSure ? SCORE.sureWrong : SCORE.normalWrong;
    streak = 0;
  }

  totalScore += pts;
  answers.push({ author: c.author, correct, pts, isSure });

  $('realBtn').disabled = true;
  $('fakeBtn').disabled = true;

  // sound + visual
  playGavel();
  setTimeout(() => {
    if (correct) {
      playCorrect(isSure);
      if (streak >= 2) playComboUp(streak);
    } else {
      playWrong(isSure);
      if (isSure) shakeScreen();
    }
  }, 100);

  // floating score
  if (pts !== 0) {
    const floatType = pts > 0 ? 'positive' : 'negative';
    const multStr = correct && mult > 1 ? ` ×${mult}` : '';
    showFloat(`${pts > 0 ? '+' : ''}${pts}点${multStr}`, floatType);
  }

  // 判決パネル（overlayなし）
  const panel = $('verdictPanel');
  if (correct) {
    panel.className = 'verdict-panel verdict-correct';
    $('verdictStamp').textContent = '◎';
    $('verdictLabel').textContent = isSure ? '確　信　的　中' : '判　決　正　当';
  } else {
    panel.className = 'verdict-panel verdict-wrong';
    $('verdictStamp').textContent = '✕';
    $('verdictLabel').textContent = isSure ? '確　信　失　当' : '判　決　誤　謬';
  }

  const scoreReveal = $('scoreReveal');
  scoreReveal.textContent = pts !== 0 ? `${pts > 0 ? '+' : ''}${pts}点` : '';
  scoreReveal.className = `score-reveal ${pts > 0 ? 'pts-positive' : pts < 0 ? 'pts-negative' : ''}`;

  const comboReveal = $('comboReveal');
  if (correct && streak >= 2) {
    comboReveal.textContent = `🔥 ${streak}連続！ ×${mult} COMBO`;
    comboReveal.className = 'combo-reveal combo-on';
  } else {
    comboReveal.textContent = '';
    comboReveal.className = 'combo-reveal';
  }

  $('truthHeader').textContent = c.truthHeader;
  $('truthText').textContent = c.truth;
  $('ptsDisplay').textContent = totalScore;

  panel.classList.remove('hidden');
  updateComboDisplay();
}

function nextCase() {
  $('verdictPanel').classList.add('hidden');
  currentIndex++;
  if (currentIndex >= currentCases.length) {
    showResult();
  } else {
    renderCase();
  }
}

function showResult() {
  saveUsedAuthors(currentCases);
  saveUsedQuotes(currentCases);
  showScreen('resultScreen');
  $('finalScore').textContent = totalScore;

  const rank = RANKS.find(r => totalScore >= r.min) || RANKS[RANKS.length - 1];
  $('resultRank').textContent = rank.label;
  $('resultMessage').textContent = rank.msg;

  const correctCount = answers.filter(a => a.correct).length;
  $('resultStats').innerHTML = `
    <div class="stat-row"><span>正解数</span><span>${correctCount} / ${currentCases.length}</span></div>
    <div class="stat-row"><span>最高コンボ</span><span>×${Math.min(maxStreak, 3)} (${maxStreak}連続)</span></div>
    <div class="stat-row"><span>確信あり</span><span>${answers.filter(a => a.isSure).length}回</span></div>
  `;

  $('resultDetails').innerHTML = answers.map(a => {
    const icon = a.correct ? '<span class="dot-correct">◎</span>' : '<span class="dot-wrong">✗</span>';
    const sureTag = a.isSure ? '<span class="sure-tag">確信</span>' : '';
    return `<div class="result-row">${icon}${sureTag}<span>${a.author.substring(0, 14)}</span><span class="${a.pts >= 0 ? 'dot-correct' : 'dot-wrong'}">${a.pts > 0 ? '+' : ''}${a.pts}</span></div>`;
  }).join('');

  const best = parseInt(localStorage.getItem('quoteCourt_best') || '-999');
  if (totalScore > best) localStorage.setItem('quoteCourt_best', totalScore);
  const bestCombo = parseInt(localStorage.getItem('quoteCourt_bestCombo') || '0');
  if (maxStreak > bestCombo) localStorage.setItem('quoteCourt_bestCombo', maxStreak);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

async function startGame() {
  if (gameStarting) return;
  gameStarting = true;
  currentIndex = 0;
  totalScore = 0;
  streak = 0;
  maxStreak = 0;
  answers = [];

  currentCases = await generateCases();
  saveUsedAuthors(currentCases);
  saveUsedQuotes(currentCases);
  gameStarting = false;
  showScreen('gameScreen');
  renderCase();
}

// ── Init ──
function init() {
  initStartScreen();

  $('startBtn').addEventListener('click', () => startGame());

  [$('confNormal'), $('confSure')].forEach(btn => {
    btn.addEventListener('click', () => {
      confidence = btn.dataset.conf;
      $('confNormal').classList.toggle('active', confidence === 'normal');
      $('confSure').classList.toggle('active', confidence === 'sure');
    });
  });

  $('realBtn').addEventListener('click', () => handleVerdict('real'));
  $('fakeBtn').addEventListener('click', () => handleVerdict('fake'));
  $('nextBtn').addEventListener('click', nextCase);
  $('retryBtn').addEventListener('click', () => {
    showScreen('startScreen');
    initStartScreen();
  });
}

document.addEventListener('DOMContentLoaded', init);

