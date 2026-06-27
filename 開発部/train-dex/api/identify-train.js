// 鉄道車両（路面電車・在来線/私鉄・新幹線）をAIで鑑定するサーバー関数。
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

const SYSTEM_PROMPT = `あなたは日本の鉄道車両の鑑定士です。画像に写る鉄道車両を同定します。
重要なルール:
- operator（事業者）と series（形式・系列）は必ず日本語で答える（英語・ローマ字では書かない）。同じ車両は毎回まったく同じ表記にすること（表記ゆれを作らない）。
- category は車両の種類を表す: "tram"=路面電車/LRT、"local"=在来線・私鉄・地下鉄の通勤/特急など、"shinkansen"=新幹線。
- operator は運行事業者（例: JR東日本 / 東京メトロ / 阪急電鉄 / 京急 / 広島電鉄）。不明なら空文字。
- series は形式・系列（例: E5系 / N700S / 京急2100形 / 広電5100形「グリーンムーバーmax」）。これが車の「車種＋世代」に相当する核。不明なら空文字。
- kind は列車種別や用途（例: 通勤型 / 特急 / 観光列車 / 路面電車 / 新幹線）。
- debut は登場（営業運転開始）年。単年が不確かなら "2007–" のようなレンジや "国鉄時代" でもよい。不明なら空文字。
- confidence は形式同定の確度。曖昧なら低くする（0〜100）。
- rarity は「その車両を今その路線で見かける珍しさ」を1〜5で表す（1=主力で頻繁 / 3=数が減ってきた / 5=引退間近・保存車・地方私鉄の希少形式・記念塗装など）。
- trivia は20〜45文字の、思わず人に話したくなる豆知識を1つ。
- candidates は「もし違ったら」の訂正用に、見た目が近い代替候補を2〜3個（"事業者 形式" の文字列）。
- faces は画像内に写り込んだ人物の顔の位置。各顔を {x,y,w,h} で表す。x,yは左上角、w,hは幅・高さで、すべて画像全体に対する0〜1の割合。人物が写っていなければ空配列 []。位置は多少大きめ（余白を含む）に囲ってよい。
出力は必ず次のJSONのみ:
{"isTrain":true,"category":"tram|local|shinkansen","operator":"事業者","series":"形式/系列","kind":"種別","debut":"登場年","confidence":0,"rarity":1,"trivia":"豆知識","candidates":["事業者 形式"],"faces":[{"x":0,"y":0,"w":0,"h":0}]}
画像に鉄道車両が写っていない、または主役でない場合は isTrain を false にし、message に「なぜ鑑定できないか＋どう撮ればよいか」を利用者向けの一文で書く（例文をそのまま返さず、その画像に合わせて書くこと）。`;

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
              { type: 'text', text: 'この鉄道車両を鑑定してください。' },
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

    if (parsed.isTrain === false) {
      const msg = String(parsed.message || '').trim();
      const friendly = (!msg || msg.length < 6 || msg === '短い案内')
        ? 'これは鉄道車両ではないようです。車両が大きく写るように撮ってみてください。'
        : msg;
      return res.status(200).json({ isTrain: false, message: friendly.slice(0, 80) });
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
    const cat = ['tram', 'local', 'shinkansen'].includes(parsed.category) ? parsed.category : 'local';

    const result = {
      isTrain: true,
      category: cat,
      operator: str(parsed.operator, 24),
      series: str(parsed.series, 40) || '不明',
      kind: str(parsed.kind, 24),
      debut: str(parsed.debut, 24),
      confidence: clampInt(parsed.confidence, 0, 100, 50),
      rarity: clampInt(parsed.rarity, 1, 5, 2),
      trivia: str(parsed.trivia, 80),
      candidates: Array.isArray(parsed.candidates)
        ? parsed.candidates.filter((c) => typeof c === 'string').map((c) => c.trim().slice(0, 48)).slice(0, 3)
        : [],
      faces: Array.isArray(parsed.faces)
        ? parsed.faces
            .map((p) => ({
              x: clamp01(p && p.x),
              y: clamp01(p && p.y),
              w: clamp01(p && p.w),
              h: clamp01(p && p.h),
            }))
            .filter((p) => p.w > 0.01 && p.h > 0.01)
            .slice(0, 8)
        : [],
    };

    res.status(200).json(result);
  } catch (err) {
    console.error('identify-train error:', err);
    res.status(500).json({ error: '鑑定に失敗しました。少し待って再度お試しください。' });
  }
}
