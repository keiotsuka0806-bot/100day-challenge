const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const OPENAI_KEY = defineSecret('OPENAI_API_KEY');
const dailyCounts = new Map();
const DAILY_LIMIT_PER_IP = 20;
const MAX_IMAGE_BASE64_LENGTH = 4_500_000;

const prompt = `あなたはSNS映え料理写真の専門採点AIです。
この写真を以下4項目で採点し、JSONのみ返してください（コードブロック・前置き・説明不要）。

採点基準（各25点満点）：
1. 色彩バランス — 食材の色の豊かさ、彩り、食欲への訴求力
2. 構図・アングル — フレーミング、撮影角度、余白バランス、主役の強調
3. 明度・光 — 露出の適切さ、自然光の活用、影の美しさ
4. 料理の盛り付け — 配置の美しさ、立体感、装飾、全体の完成度

JSONフォーマット（厳守）:
{
  "料理名": "<写真に写っている料理名（日本語）。不明なら「料理」>",
  "色彩バランス": <0〜25の整数>,
  "構図・アングル": <0〜25の整数>,
  "明度・光": <0〜25の整数>,
  "料理の盛り付け": <0〜25の整数>,
  "合計": <上記4つの合計>,
  "一言評価": "<写真の最大の強みを具体的に1文（日本語）>",
  "ハッシュタグ": ["<#料理名関連>", "<#food系英語>", "<#instafood系>", "<#撮影・光関連>", "<#SNS映え系>"],
  "改善アドバイス": [
    "<具体的な改善点1>",
    "<具体的な改善点2>",
    "<具体的な改善点3>"
  ],
  "撮り直しポイント": "<最も効果的な改善を1文>"
}`;

exports.analyzeFood = onRequest(
  {
    cors: true,
    secrets: [OPENAI_KEY],
    region: 'asia-northeast1',
    timeoutSeconds: 60,
    maxInstances: 5,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const clientId = getClientId(req);
    const count = incrementDailyCount(clientId);
    if (count > DAILY_LIMIT_PER_IP) {
      res.status(429).json({ error: '本日の採点回数上限に達しました。明日また試してください。' });
      return;
    }

    const { image, mediaType = 'image/jpeg' } = req.body || {};
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'image is required' });
      return;
    }

    if (image.length > MAX_IMAGE_BASE64_LENGTH) {
      res.status(413).json({ error: '画像サイズが大きすぎます。別の写真で試してください。' });
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
      res.status(400).json({ error: 'unsupported mediaType' });
      return;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY.value()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          max_output_tokens: 1400,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: `data:${mediaType};base64,${image}`, detail: 'low' },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        res.status(response.status).json({ error: err.error?.message || 'OpenAI API error' });
        return;
      }

      const data = await response.json();
      const raw = extractOutputText(data);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        res.status(502).json({ error: 'AIレスポンスを解析できませんでした' });
        return;
      }

      const result = normalizeResult(JSON.parse(match[0]));
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message || '採点に失敗しました' });
    }
  }
);

function normalizeResult(input) {
  const result = {
    '料理名': typeof input['料理名'] === 'string' ? input['料理名'] : '料理',
    '色彩バランス': clampScore(input['色彩バランス']),
    '構図・アングル': clampScore(input['構図・アングル']),
    '明度・光': clampScore(input['明度・光']),
    '料理の盛り付け': clampScore(input['料理の盛り付け']),
    '一言評価': typeof input['一言評価'] === 'string' ? input['一言評価'] : '写真全体の印象を整える余地があります。',
    'ハッシュタグ': Array.isArray(input['ハッシュタグ']) ? input['ハッシュタグ'].slice(0, 8).filter(t => typeof t === 'string') : [],
    '改善アドバイス': Array.isArray(input['改善アドバイス']) ? input['改善アドバイス'].slice(0, 5).filter(a => typeof a === 'string') : [],
    '撮り直しポイント': typeof input['撮り直しポイント'] === 'string' ? input['撮り直しポイント'] : '',
  };

  result['合計'] = result['色彩バランス'] + result['構図・アングル'] + result['明度・光'] + result['料理の盛り付け'];
  return result;
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(25, Math.round(n)));
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') return data.output_text.trim();

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function getClientId(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function incrementDailyCount(clientId) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}:${clientId}`;
  const next = (dailyCounts.get(key) || 0) + 1;
  dailyCounts.set(key, next);

  for (const existingKey of dailyCounts.keys()) {
    if (!existingKey.startsWith(`${day}:`)) {
      dailyCounts.delete(existingKey);
    }
  }

  return next;
}
