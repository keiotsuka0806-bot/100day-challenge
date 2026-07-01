// 衝動ブレーキ — 「未来の自分」からの3つの問いを返すサーバー関数（Vercel）
// OPENAI_API_KEY があれば本物、無ければモックを返す。キーはサーバー内のみで使用しクライアントに出さない。

const MODEL = 'gpt-4o-mini';

function mockQuestions(name, price) {
  const p = price ? `¥${Number(price).toLocaleString('ja-JP')}` : 'そのお金';
  return [
    `「${name}」を実際に使う場面を、具体的に1つ言える？ 言えないなら、たぶん要らない。`,
    `いま家にある物で代わりになるものは本当にない？ ${p}を出す前に一度見回してみて。`,
    `届いた「${name}」の置き場所は、もう決まってる？ 決まってないなら、それは増えるだけの物かも。`,
  ];
}

function clip(s, n) {
  return String(s == null ? '' : s).slice(0, n);
}

// ベストエフォートのレート制限（同一インスタンス内メモリ）。
// サーバーレスは複数インスタンスに分かれるため完全な上限ではない（1インスタンスあたりの上限）。
// 本質的な濫用対策はプラットフォーム側（Vercel WAF/Firewallのレート制限、または
// Upstash等の共有ストア）で行うこと。ここは温まった1インスタンスへの連打を抑える防波堤。
// キー未設定なら本APIはmockのみでOpenAIを一切叩かない＝その場合コストはゼロ。
const WINDOW_MS = 60 * 1000;
const PER_IP_MAX = 10;      // 1IP / 1分
const GLOBAL_MAX = 60;      // 1インスタンス全体 / 1分（暴走時のコスト上限を低く）
const hits = new Map();     // ip -> [timestamps]
let globalHits = [];

function tooMany(ip) {
  const now = Date.now();
  globalHits = globalHits.filter(t => now - t < WINDOW_MS);
  if (globalHits.length >= GLOBAL_MAX) return true;
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= PER_IP_MAX) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr); globalHits.push(now);
  if (hits.size > 5000) hits.clear(); // メモリ肥大の保険
  return false;
}

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
  const name = clip(body && body.name, 120).trim();
  const price = Number(body && body.price) || 0;
  const memo = clip(body && body.memo, 200).trim();

  if (!name) {
    res.status(400).json({ error: 'name required' });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(200).json({ questions: mockQuestions(name, price), mock: true });
    return;
  }

  try {
    const prompt =
      `あなたは「24時間後のユーザー本人」です。いま衝動買いしそうな商品について、` +
      `買う手を一瞬止めるための短い問いを日本語でちょうど3つ作ってください。` +
      `説教や否定はせず、静かに我に返らせる問いにすること。各問い40文字以内。\n` +
      `商品名: ${name}\n値段: ${price}円\nメモ: ${memo || '（なし）'}\n` +
      `出力はJSONのみ: {"questions":["...","...","..."]}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!r.ok) {
      res.status(200).json({ questions: mockQuestions(name, price), mock: true });
      return;
    }

    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
    let questions = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.questions)) questions = parsed.questions;
    } catch (_) {}

    questions = questions.map(q => clip(q, 120)).filter(Boolean).slice(0, 3);
    if (questions.length < 3) questions = mockQuestions(name, price);

    res.status(200).json({ questions, mock: false });
  } catch (_) {
    res.status(200).json({ questions: mockQuestions(name, price), mock: true });
  }
}
