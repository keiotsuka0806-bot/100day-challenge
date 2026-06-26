// 乗り物（四輪・二輪）をAIで鑑定するサーバー関数。
// 鍵をクライアントに晒さず、ここで OpenAI Vision を叩く。
// 公開前提のため「サイズ上限 + 簡易レート制限」をかけてからコストの出る処理へ進む。

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10; // 1IPあたり60秒で10回まで（Visionコストの暴発を防ぐ歯止め）
const hits = new Map();

function rateLimited(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

const SYSTEM_PROMPT = `あなたは車（四輪）とオートバイ（二輪）の鑑定士です。画像に写る乗り物を同定します。
重要なルール:
- 年式は「単年」では断定しない。必ず世代（型式）と年式レンジで答える（例: 世代「50系」/ 年式レンジ「2015–2022」）。世代が不明なら generation は空文字にする。
- 確度は正直に。曖昧なら confidence を低くする。
- rarity は「日本の街でその車種を見かける珍しさ」を1〜5で表す（1=ありふれた / 3=たまに見る / 5=激レア・旧車・希少な輸入車など）。
- trivia は20〜45文字の、思わず人に話したくなる豆知識を1つ。
- candidates は「もし違ったら」の訂正用に、見た目が近い代替候補を2〜3個（"メーカー 車種名" の文字列）。
- plates は画像内のナンバープレート（前・後・二輪の1枚など）の位置。各プレートを {x,y,w,h} で表す。x,yは左上角、w,hは幅・高さで、すべて画像全体に対する0〜1の割合。プレートが見えなければ空配列 []。位置は多少大きめ（余白を含む）に囲ってよい。
出力は必ず次のJSONのみ:
{"isVehicle":true,"category":"car|bike","maker":"メーカー","model":"車種名","generation":"世代/型式","yearRange":"年式レンジ","bodyType":"ボディタイプ","confidence":0,"rarity":1,"trivia":"豆知識","candidates":["メーカー 車種"],"plates":[{"x":0,"y":0,"w":0,"h":0}]}
画像に車・バイクが写っていない、または主役でない場合は {"isVehicle":false,"message":"短い案内"} を返す。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (rateLimited(req)) {
    return res.status(429).json({ error: '混み合っています。少し待って再度お試しください。' });
  }

  const { image } = req.body || {};
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: '画像が不正です' });
  }
  if (image.length > 8_000_000) {
    return res.status(413).json({ error: '画像が大きすぎます' });
  }

  // 鍵が未登録なら、フロント側がモック（デモ）にフォールバックできるよう 503 を返す。
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI鑑定は未設定です（OPENAI_API_KEY 未登録）' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'この乗り物を鑑定してください。' },
              { type: 'image_url', image_url: { url: image, detail: 'low' } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenAI error:', text); // 詳細はサーバーログのみ
      return res.status(502).json({ error: '鑑定に失敗しました。少し待って再度お試しください。' });
    }

    const data = await response.json();
    let parsed;
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch {
      return res.status(502).json({ error: '鑑定結果を解析できませんでした' });
    }

    if (parsed.isVehicle === false) {
      return res.status(200).json({
        isVehicle: false,
        message: String(parsed.message || 'これは車・バイクではないみたいです。').slice(0, 60),
      });
    }

    const clampInt = (v, min, max, fallback) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const clamp01 = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
    };

    const result = {
      isVehicle: true,
      category: parsed.category === 'bike' ? 'bike' : 'car',
      maker: str(parsed.maker, 24) || '不明',
      model: str(parsed.model, 32) || '不明',
      generation: str(parsed.generation, 24),
      yearRange: str(parsed.yearRange, 24),
      bodyType: str(parsed.bodyType, 24),
      confidence: clampInt(parsed.confidence, 0, 100, 50),
      rarity: clampInt(parsed.rarity, 1, 5, 2),
      trivia: str(parsed.trivia, 80),
      candidates: Array.isArray(parsed.candidates)
        ? parsed.candidates.filter((c) => typeof c === 'string').map((c) => c.trim().slice(0, 48)).slice(0, 3)
        : [],
      plates: Array.isArray(parsed.plates)
        ? parsed.plates
            .map((p) => ({
              x: clamp01(p && p.x),
              y: clamp01(p && p.y),
              w: clamp01(p && p.w),
              h: clamp01(p && p.h),
            }))
            .filter((p) => p.w > 0.01 && p.h > 0.01)
            .slice(0, 4)
        : [],
    };

    res.status(200).json(result);
  } catch (err) {
    console.error('identify-vehicle error:', err);
    res.status(500).json({ error: '鑑定に失敗しました。少し待って再度お試しください。' });
  }
}
