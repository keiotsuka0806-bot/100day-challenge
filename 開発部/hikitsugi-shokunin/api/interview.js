// 引き継ぎ職人 — サーバー関数（Vercel）
// OPENAI_API_KEY があれば本物、無ければモックを返す。キーはサーバー内のみで使用しクライアントに出さない。
// キー未設定なら OpenAI を一切叩かない＝コストゼロで動く。
// mode: draft(資料→下書きWiki) / question(差分インタビューの質問) / integrate(回答→ページ追記) / plan30(最初の30日プラン) / ask(後任がWikiに質問)

const MODEL = 'gpt-4o-mini';

const JOB_TYPES = ['事務', '営業', 'エンジニア', 'その他'];

function clip(s, n) {
  return String(s == null ? '' : s).slice(0, n);
}

function asArray(v, max) {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

// ===== モック（鍵なし・AI障害時の縮退） =====

const MOCK_QUESTIONS = {
  事務: [
    { q: '毎月「必ず」やっている作業を、締め切り日とセットで教えてください（例: 25日までに請求書発行）', target: '', reason: '定例業務の抜け防止' },
    { q: 'マニュアルには書いていないけれど、あなただけが知っている例外対応やコツはありますか？', target: '', reason: '暗黙知の掘り起こし' },
    { q: '社内外で「この件はこの人に聞く」という頼り先を3人挙げてください', target: '', reason: '人脈の引き継ぎ' },
  ],
  営業: [
    { q: '引き継ぐ顧客の中で、対応に注意が必要な相手と、その理由を教えてください', target: '', reason: '関係性の引き継ぎ' },
    { q: '見積もり・値引きで「ここまでは自分の判断でOK」という暗黙のラインはありますか？', target: '', reason: '判断基準の言語化' },
    { q: '今動いている案件で、次の1ヶ月に山場が来るものはどれですか？', target: '', reason: '直近の危機回避' },
  ],
  エンジニア: [
    { q: '本番環境で「これだけは触るな/こうやって触る」という暗黙のルールはありますか？', target: '', reason: '事故防止' },
    { q: 'ドキュメントにない歴史的経緯（なぜこの設計になっているか）を1つ教えてください', target: '', reason: '設計判断の継承' },
    { q: '障害が起きたとき、最初に見る場所と最初に連絡する人は？', target: '', reason: '緊急時対応' },
  ],
  その他: [
    { q: '毎日・毎週・毎月の定例作業を、頻度とセットで挙げてください', target: '', reason: '定例業務の棚卸し' },
    { q: 'あなたが休んだとき、周りが一番困った出来事は何でしたか？', target: '', reason: '属人化ポイントの特定' },
    { q: '後任が最初の1週間で必ず知っておくべきことを3つ挙げてください', target: '', reason: '立ち上がり支援' },
  ],
};

function mockDraft(sources) {
  const pages = sources.map(s => ({
    title: clip(s.title, 40) || '無題の資料',
    body: `## 概要\n（モックモード: AI未接続のため資料の要約は生成されていません。OPENAI_API_KEY 設定後に再実行すると、資料から下書きが作られます）\n\n## 元資料の冒頭\n${clip(s.text, 300)}…\n\n関連: [[取材メモ]]`,
    refs: [clip(s.title, 40) || '無題の資料'],
  }));
  pages.push({ title: '取材メモ', body: '取材（差分インタビュー）で掘り起こした内容がここに溜まります。', refs: [] });
  return {
    pages,
    gaps: ['（モック）資料に締め切り日への言及がある場合、対応ページがあるか確認してください'],
    mock: true,
  };
}

function mockIntegrate(q, a) {
  return {
    pageTitle: '取材メモ',
    addition: `**Q: ${clip(q, 200)}**\n\n${clip(a, 800)}`,
    gaps: [],
    mock: true,
  };
}

function mockAsk(question, pages) {
  // 日本語は分かち書きされないため、2文字ずつの断片(bigram)が本文に何個現れるかで関連ページを推定する
  const q = String(question).replace(/[\s、。？?！!]/g, '');
  const bigrams = [];
  for (let i = 0; i < q.length - 1; i++) bigrams.push(q.slice(i, i + 2));
  let hit = null; let best = 1;
  for (const p of pages) {
    if (!p.body) continue;
    const score = bigrams.filter(b => p.body.includes(b)).length;
    if (score > best) { best = score; hit = p; }
  }
  return {
    answer: hit
      ? `（モックモード）関連しそうなページは「${hit.title}」です。そのページを開いて確認してください。OPENAI_API_KEY 設定後は、Wikiの中身を読んだ上での回答になります。`
      : '（モックモード）Wikiの中から答えを探す機能は、OPENAI_API_KEY 設定後に本稼働します。いまはページ一覧から関連ページを開いて確認してください。',
    sources: hit ? [hit.title] : [],
    mock: true,
  };
}

function mockPlan30(pageTitles) {
  const first = pageTitles[0] || '主要業務';
  return {
    plan: [
      { phase: '初日', items: ['このWikiの全ページタイトルに目を通す', '前任者（在職中なら）と30分の顔合わせ', 'アカウント・権限の確認'] },
      { phase: '最初の週', items: [`「${first}」のページを読み、実際の作業を1回なぞる`, '関係者に着任の挨拶と「困ったら聞く」合意を取る'] },
      { phase: '最初の月末', items: ['月次業務を一人で回してみて、詰まった箇所をWikiに追記する', '抜け漏れリストの未解決項目を確認する'] },
    ],
    mock: true,
  };
}

// ===== レート制限（同一インスタンス内メモリ・ベストエフォート） =====
const WINDOW_MS = 60 * 1000;
const PER_IP_MAX = 10;
const GLOBAL_MAX = 60;
const hits = new Map();
let globalHits = [];

function tooMany(ip) {
  const now = Date.now();
  globalHits = globalHits.filter(t => now - t < WINDOW_MS);
  if (globalHits.length >= GLOBAL_MAX) return true;
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= PER_IP_MAX) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr); globalHits.push(now);
  if (hits.size > 5000) hits.clear();
  return false;
}

// ===== OpenAI 呼び出し =====
async function callOpenAI(key, prompt, maxTokens) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}`);
  const data = await r.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : '';
  return JSON.parse(content);
}

const COMMON_RULES =
  `共通ルール:\n` +
  `- 事実の捏造をしない。資料・回答に無いことを推測で書くときは「（要確認）」を付ける\n` +
  `- 出力は必ず指定のJSONのみ\n` +
  `- 日本語で書く\n`;

function draftPrompt(jobType, sources) {
  const src = sources.map((s, i) => `【資料${i + 1}: ${s.title}】\n${s.text}`).join('\n\n');
  return (
    `あなたは業務引き継ぎ書づくりの職人です。持ち込まれた資料を読み、後任が辿って読める「引き継ぎWiki」の下書きページ群を作ってください。\n` +
    `職種: ${jobType}\n\n${src}\n\n` +
    COMMON_RULES +
    `作り方:\n` +
    `- 資料は整ったマニュアルとは限らない。チャットログ・メール・日報など雑多な断片でも、そこから業務・締め切り・関係者を拾い上げて再構成する\n` +
    `- 資料を業務単位のページ（最大8ページ）に再構成する。1ページ=1業務\n` +
    `- 各ページはMarkdown。見出し（##）は「概要 / 手順 / 頻度・締め切り / 関係者 / 注意点」から必要なものだけ\n` +
    `- 本文中で他ページに関連する語は [[ページ名]] 形式でリンクする\n` +
    `- refs には根拠にした資料タイトルを入れる\n` +
    `- 資料に言及があるのに詳細が書かれていない業務・締め切り・関係者を gaps に列挙する（最大5件。後で本人に取材する用）\n` +
    `出力JSON: {"pages":[{"title":"ページ名","body":"Markdown本文","refs":["資料タイトル"]}],"gaps":["確認すべき穴"]}`
  );
}

function questionPrompt(jobType, pageSummaries, askedQs) {
  return (
    `あなたは業務引き継ぎの取材記者です。すでにWikiに書かれていることは聞かず、「書かれていないこと・本人しか知らないこと」だけを質問してください。\n` +
    `職種: ${jobType}\n\n現在のWikiページ概要:\n${pageSummaries.map(p => `- ${p.title}: ${p.outline}`).join('\n')}\n\n` +
    `すでに聞いた質問（重複禁止）:\n${askedQs.map(q => `- ${q}`).join('\n') || '（なし）'}\n\n` +
    COMMON_RULES +
    `質問の狙い（優先順）: ①資料の古さ確認（「この手順は今も同じ?」） ②例外・トラブル対応の暗黙知 ③判断基準（どこまで自分で決めてよいか） ④人間関係（誰に聞くか） ⑤締め切り・頻度の穴\n` +
    `- 具体的に、1問1テーマで、答えやすく聞く\n` +
    `- target には最も関連するページ名を入れる（無ければ空文字）\n` +
    `出力JSON: {"questions":[{"q":"質問文","target":"ページ名","reason":"狙いの一言"}]}（3件）`
  );
}

function integratePrompt(q, a, pageTitles) {
  return (
    `業務引き継ぎ取材の回答を、Wikiページへの追記文に整えてください。\n` +
    `質問: ${q}\n回答: ${a}\n\n既存ページ名: ${pageTitles.join(' / ') || '（なし）'}\n\n` +
    COMMON_RULES +
    `- pageTitle は追記先。既存ページ名から最も合うものを選ぶ。合うものが無ければ新しいページ名を付けてよい\n` +
    `- addition は回答を整理したMarkdown（箇条書き推奨・話し言葉を書き言葉に。ただし内容の追加・脚色はしない）\n` +
    `- 回答の中に「さらに掘るべき穴」があれば gaps に最大2件\n` +
    `出力JSON: {"pageTitle":"追記先ページ名","addition":"Markdown追記文","gaps":["穴"]}`
  );
}

function plan30Prompt(pageSummaries, deadline) {
  return (
    `後任者向けの「最初の30日プラン」を、引き継ぎWikiの内容から作ってください。\n` +
    (deadline ? `前任者の最終日: ${deadline}\n` : '') +
    `Wikiページ概要:\n${pageSummaries.map(p => `- ${p.title}: ${p.outline}`).join('\n')}\n\n` +
    COMMON_RULES +
    `- 「初日 / 最初の週 / 最初の月末」の3フェーズ。各フェーズ2〜4項目\n` +
    `- 各項目は具体的な行動（読む・やってみる・会う）。ページ名を含める場合は [[ページ名]] 形式\n` +
    `出力JSON: {"plan":[{"phase":"初日","items":["行動"]},{"phase":"最初の週","items":["行動"]},{"phase":"最初の月末","items":["行動"]}]}`
  );
}

function askPrompt(question, pages) {
  return (
    `あなたは前任者の引き継ぎWikiを熟読した案内役です。後任者の質問に、Wikiに書かれている内容だけを根拠に答えてください。\n` +
    `質問: ${question}\n\nWiki全ページ:\n${pages.map(p => `【${p.title}】\n${p.body}`).join('\n\n')}\n\n` +
    COMMON_RULES +
    `- Wikiに答えがあれば、簡潔に答え、根拠にしたページ名を sources に入れる\n` +
    `- Wikiに書かれていないことは推測で答えず、「Wikiには記載がありません」と正直に言い、関連しそうなページや「前任者・周囲に確認すべき」ことを案内する（その場合 sources は空でよい）\n` +
    `出力JSON: {"answer":"回答（3文以内目安）","sources":["根拠ページ名"]}`
  );
}

// ===== ハンドラ =====
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) {
    res.status(429).json({ error: 'Too Many Requests' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const mode = clip(body.mode, 20);
  const jobType = JOB_TYPES.includes(body.jobType) ? body.jobType : 'その他';
  const key = process.env.OPENAI_API_KEY;

  try {
    if (mode === 'draft') {
      const sources = asArray(body.sources, 6)
        .map(s => ({ title: clip(s && s.title, 60), text: clip(s && s.text, 6000) }))
        .filter(s => s.text.trim());
      if (!sources.length) { res.status(400).json({ error: 'sources required' }); return; }
      if (!key) { res.status(200).json(mockDraft(sources)); return; }
      const parsed = await callOpenAI(key, draftPrompt(jobType, sources), 2000);
      const pages = asArray(parsed.pages, 8).map(p => ({
        title: clip(p && p.title, 60) || '無題ページ',
        body: clip(p && p.body, 4000),
        refs: asArray(p && p.refs, 6).map(r => clip(r, 60)),
      })).filter(p => p.body.trim());
      if (!pages.length) { res.status(200).json(mockDraft(sources)); return; }
      res.status(200).json({ pages, gaps: asArray(parsed.gaps, 5).map(g => clip(g, 200)), mock: false });
      return;
    }

    if (mode === 'question') {
      const pageSummaries = asArray(body.pageSummaries, 20)
        .map(p => ({ title: clip(p && p.title, 60), outline: clip(p && p.outline, 300) }));
      const askedQs = asArray(body.askedQs, 15).map(q => clip(q, 200));
      if (!key) {
        const pool = MOCK_QUESTIONS[jobType];
        const remaining = pool.filter(item => !askedQs.includes(item.q));
        res.status(200).json({ questions: (remaining.length ? remaining : pool).slice(0, 3), mock: true });
        return;
      }
      const parsed = await callOpenAI(key, questionPrompt(jobType, pageSummaries, askedQs), 500);
      const questions = asArray(parsed.questions, 3).map(item => ({
        q: clip(item && item.q, 300),
        target: clip(item && item.target, 60),
        reason: clip(item && item.reason, 100),
      })).filter(item => item.q.trim());
      if (!questions.length) { res.status(200).json({ questions: MOCK_QUESTIONS[jobType].slice(0, 3), mock: true }); return; }
      res.status(200).json({ questions, mock: false });
      return;
    }

    if (mode === 'integrate') {
      const q = clip(body.q, 300).trim();
      const a = clip(body.a, 1500).trim();
      const pageTitles = asArray(body.pageTitles, 20).map(t => clip(t, 60));
      if (!q || !a) { res.status(400).json({ error: 'q and a required' }); return; }
      if (!key) { res.status(200).json(mockIntegrate(q, a)); return; }
      const parsed = await callOpenAI(key, integratePrompt(q, a, pageTitles), 700);
      const addition = clip(parsed.addition, 2000);
      if (!addition.trim()) { res.status(200).json(mockIntegrate(q, a)); return; }
      res.status(200).json({
        pageTitle: clip(parsed.pageTitle, 60) || '取材メモ',
        addition,
        gaps: asArray(parsed.gaps, 2).map(g => clip(g, 200)),
        mock: false,
      });
      return;
    }

    if (mode === 'ask') {
      const question = clip(body.question, 300).trim();
      const pages = asArray(body.pages, 12)
        .map(p => ({ title: clip(p && p.title, 60), body: clip(p && p.body, 1200) }))
        .filter(p => p.title);
      if (!question) { res.status(400).json({ error: 'question required' }); return; }
      if (!pages.length) { res.status(400).json({ error: 'pages required' }); return; }
      if (!key) { res.status(200).json(mockAsk(question, pages)); return; }
      const parsed = await callOpenAI(key, askPrompt(question, pages), 500);
      const answer = clip(parsed.answer, 1000);
      if (!answer.trim()) { res.status(200).json(mockAsk(question, pages)); return; }
      const validTitles = new Set(pages.map(p => p.title));
      res.status(200).json({
        answer,
        sources: asArray(parsed.sources, 5).map(s => clip(s, 60)).filter(s => validTitles.has(s)),
        mock: false,
      });
      return;
    }

    if (mode === 'plan30') {
      const pageSummaries = asArray(body.pageSummaries, 20)
        .map(p => ({ title: clip(p && p.title, 60), outline: clip(p && p.outline, 300) }));
      const deadline = clip(body.deadline, 20);
      if (!pageSummaries.length) { res.status(400).json({ error: 'pageSummaries required' }); return; }
      if (!key) { res.status(200).json(mockPlan30(pageSummaries.map(p => p.title))); return; }
      const parsed = await callOpenAI(key, plan30Prompt(pageSummaries, deadline), 800);
      const plan = asArray(parsed.plan, 3).map(ph => ({
        phase: clip(ph && ph.phase, 20),
        items: asArray(ph && ph.items, 4).map(i => clip(i, 200)),
      })).filter(ph => ph.items.length);
      if (!plan.length) { res.status(200).json(mockPlan30(pageSummaries.map(p => p.title))); return; }
      res.status(200).json({ plan, mock: false });
      return;
    }

    res.status(400).json({ error: 'unknown mode' });
  } catch (err) {
    console.error('interview api fallback:', mode, err && err.message);
    // AI障害時はモックに縮退（mockフラグでクライアントに明示）
    if (mode === 'draft') { res.status(200).json(mockDraft(asArray(body.sources, 6).map(s => ({ title: clip(s && s.title, 60), text: clip(s && s.text, 6000) })))); return; }
    if (mode === 'question') { res.status(200).json({ questions: MOCK_QUESTIONS[jobType].slice(0, 3), mock: true }); return; }
    if (mode === 'integrate') { res.status(200).json(mockIntegrate(clip(body.q, 300), clip(body.a, 1500))); return; }
    if (mode === 'plan30') { res.status(200).json(mockPlan30(asArray(body.pageSummaries, 20).map(p => clip(p && p.title, 60)))); return; }
    if (mode === 'ask') { res.status(200).json(mockAsk(clip(body.question, 300), asArray(body.pages, 12).map(p => ({ title: clip(p && p.title, 60), body: clip(p && p.body, 1200) })))); return; }
    res.status(500).json({ error: 'internal' });
  }
}
