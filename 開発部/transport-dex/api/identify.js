// TransportDex 共通の鑑定API（ジャンル別プロンプト）。任意ヒント用。
// 鍵はサーバーのみ。公開前提のためサイズ上限＋簡易レート制限。返すキーは各ジャンルのフィールドIDに合わせる。

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map();
function rateLimited(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

const COMMON = `confidence は形式同定の確度(0〜100)。曖昧なら低く。rarity は珍しさ(1=よく見る/5=激レア)。trivia は20〜45字の豆知識。candidates は近い代替候補を2〜3個。redact は隠すべき領域(下記)の配列で各 {x,y,w,h}(画像に対する0〜1の割合・左上角と幅高さ)、無ければ []。operator と series は必ず日本語で答え、英語・ローマ字にしない。同じ対象は毎回まったく同じ表記にする。出力は指定のJSONのみ。`;

const GENRE_PROMPT = {
  train: `あなたは日本の鉄道車両の鑑定士。画像の車両を同定する。
category は "shinkansen"=新幹線 / "local"=在来線・私鉄・地下鉄 / "tram"=路面電車。
operator=事業者(例 JR東日本/東京メトロ/京急)、series=形式・系列(例 E5系/N700S/京急2100形)、kind=種別、debut=登場年。redact=画像内の人物の顔。
${COMMON}
JSON: {"ok":true,"operator":"","series":"","kind":"","debut":"","category":"shinkansen|local|tram","confidence":0,"rarity":1,"trivia":"","candidates":[],"redact":[]}
鉄道車両が主役でなければ {"ok":false,"message":"鉄道車両が見つかりません。車両が大きく写るように撮ってください。"}`,
  ride: `あなたは車(四輪)とオートバイ(二輪)の鑑定士。画像の乗り物を同定する。
category は "car"=四輪 / "bike"=二輪。
operator=メーカー(カタカナ 例 トヨタ/ホンダ)、series=車種(例 プリウス/ジムニー)、kind=ボディタイプ、debut=世代/年式レンジ(単年で断定しない)。redact=画像内のナンバープレート。
${COMMON}
JSON: {"ok":true,"operator":"","series":"","kind":"","debut":"","category":"car|bike","confidence":0,"rarity":1,"trivia":"","candidates":[],"redact":[]}
車・バイクが主役でなければ {"ok":false,"message":"車・バイクが見つかりません。車体が大きく写るように撮ってください。"}`,
  plane: `あなたは旅客機の鑑定士。画像の航空機を同定する。
category は "jet"=ジェット機 / "prop"=プロペラ機 / "heli"=ヘリコプター。
operator=航空会社(例 ANA/JAL)、series=機種(例 ボーイング787/エアバスA350/Q400)、kind=タイプ、debut=就航年など。redact=画像内の人物の顔。
${COMMON}
JSON: {"ok":true,"operator":"","series":"","kind":"","debut":"","category":"jet|prop|heli","confidence":0,"rarity":1,"trivia":"","candidates":[],"redact":[]}
航空機が主役でなければ {"ok":false,"message":"飛行機が見つかりません。機体が大きく写るように撮ってください。"}`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimited(req)) return res.status(429).json({ error: '混み合っています。少し待って再度お試しください。' });

  const { image, genre } = req.body || {};
  const prompt = GENRE_PROMPT[genre];
  if (!prompt) return res.status(400).json({ error: 'ジャンルが不正です' });
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return res.status(400).json({ error: '画像が不正です' });
  if (image.length > 8_000_000) return res.status(413).json({ error: '画像が大きすぎます' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI鑑定は未設定です' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini', max_tokens: 500, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: [{ type: 'text', text: '鑑定してください。' }, { type: 'image_url', image_url: { url: image, detail: 'low' } }] },
        ],
      }),
    });
    if (!response.ok) { console.error('OpenAI error:', await response.text()); return res.status(502).json({ error: '鑑定に失敗しました。少し待って再度お試しください。' }); }
    const data = await response.json();
    let p; try { p = JSON.parse(data.choices[0].message.content); } catch { return res.status(502).json({ error: '鑑定結果を解析できませんでした' }); }

    if (p.ok === false) {
      const msg = String(p.message || '').trim();
      return res.status(200).json({ ok: false, message: (!msg || msg.length < 6) ? '対象が見つかりませんでした。大きく写るように撮ってください。' : msg.slice(0, 80) });
    }
    const str = (v, m) => (typeof v === 'string' ? v.trim().slice(0, m) : '');
    const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
    const clamp01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; };
    res.status(200).json({
      ok: true,
      operator: str(p.operator, 24), series: str(p.series, 40), kind: str(p.kind, 24), debut: str(p.debut, 24),
      category: str(p.category, 16), confidence: clampInt(p.confidence, 0, 100, 50), rarity: clampInt(p.rarity, 1, 5, 2),
      trivia: str(p.trivia, 80),
      redact: Array.isArray(p.redact) ? p.redact.map((r) => ({ x: clamp01(r && r.x), y: clamp01(r && r.y), w: clamp01(r && r.w), h: clamp01(r && r.h) })).filter((r) => r.w > 0.01 && r.h > 0.01).slice(0, 8) : [],
    });
  } catch (err) { console.error('identify error:', err); res.status(500).json({ error: '鑑定に失敗しました。少し待って再度お試しください。' }); }
}
