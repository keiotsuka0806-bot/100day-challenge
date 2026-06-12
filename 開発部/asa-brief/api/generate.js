// AsaBrief — 朝刊生成API(OpenAI gpt-4o-mini / 素のfetchで依存ゼロ)

const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + 60_000 }); return false; }
  if (entry.count >= 8) return true;
  entry.count++;
  rateMap.set(ip, entry);
  return false;
}

const SYSTEM_PROMPT = `あなたは老舗新聞社の名物編集長です。読者(1人)の昨日のメモ・日報と今日の予定から、その人専用の「朝刊一面」を作ります。

ルール:
- 事実はユーザーのメモにあることだけを使う。創作で事実を足さない(誇張した見出しの「演出」はよい)
- 新聞らしい文体(である調、体言止めの見出し)
- ユーザーを「氏」付きの三人称で呼ぶ(名前が不明なら「主人公」とする)
- ユーモアと品格を両立させる

次の構造のJSONだけを返す。JSON以外の文字・マークダウン・バッククォートは一切出力しない:
{
  "paperName": "<新聞の題字。その人の生活に合わせた4〜8文字。例: 朝刊ケイ新聞>",
  "topHeadline": "<一面トップの大見出し。15〜25文字。昨日いちばんのニュース>",
  "lead": "<リード文。2〜3文。トップ記事の要約>",
  "articles": [
    { "heading": "<記事見出し10〜18文字>", "body": "<本文2〜4文>" },
    { "heading": "<記事見出し>", "body": "<本文2〜4文>" },
    { "heading": "<記事見出し>", "body": "<本文2〜4文>" }
  ],
  "column": "<一面下のコラム(天声人語風)。昨日の出来事から人生の機微へ広げる4〜6文。最後は余韻のある一文で締める>",
  "tomorrowHeadline": "<明日の朝刊の見出し予想。今日の予定から1行。なければ励ましの予告>"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) return res.status(429).json({ error: '少し時間をおいてからもう一度お試しください(1分あたり8回まで)' });

  const { notes, plan } = req.body || {};
  if (typeof notes !== 'string' || notes.trim().length < 10) {
    return res.status(400).json({ error: '昨日のメモを10文字以上入力してください' });
  }
  if (notes.length > 8000 || (plan && String(plan).length > 2000)) {
    return res.status(400).json({ error: '入力が長すぎます(メモ8000字・予定2000字まで)' });
  }

  const userContent = `# 昨日のメモ・日報\n${notes.trim()}\n\n# 今日の予定\n${(plan || '').trim() || '(記載なし)'}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('OpenAI error:', r.status, detail.slice(0, 300));
      return res.status(502).json({ error: '朝刊の印刷機が不調です。少し待ってからもう一度お試しください' });
    }

    const data = await r.json();
    let paper;
    try {
      paper = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch {
      return res.status(502).json({ error: '紙面の組版に失敗しました。もう一度お試しください' });
    }

    const ok = paper.paperName && paper.topHeadline && paper.lead && Array.isArray(paper.articles) && paper.column;
    if (!ok) return res.status(502).json({ error: '紙面が不完全でした。もう一度お試しください' });

    paper.articles = paper.articles.slice(0, 4);
    return res.status(200).json(paper);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
