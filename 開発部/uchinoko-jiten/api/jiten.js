// うちの子語録辞典 — 語釈生成API (OpenAI gpt-4o-mini / 鍵なしモック)
// 教訓: 公開APIには入力上限+レート制限を入れてから鍵を登録する

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 20;
const MAX_GLOBAL = 300;
const hits = new Map();
let globalStamps = [];

function rateLimited(ip) {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  globalStamps = globalStamps.filter(t => now - t < WINDOW_MS);
  if (globalStamps.length >= MAX_GLOBAL) return true;
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_IP) return true;
  list.push(now);
  hits.set(ip, list);
  globalStamps.push(now);
  return false;
}

function mockEntry(goroku, imi, age) {
  const yomi = goroku.replace(/[^ぁ-んァ-ンー]/g, '') || 'よみかたふめい';
  return {
    yomi,
    hinshi: '〔幼児語・名詞〕',
    teigi: `${imi ? imi + '。' : ''}本辞典編纂委員会が正式な日本語として認定した、この家にしか存在しない言葉。`,
    yourei: [`「きょうのごはん、${goroku}がいい」${age ? `(${age}・本人)` : '(本人)'}`],
    gogen: `標準語との音韻のずれから発生したと推定される。発話者の口の筋肉と気持ちが、正しさより勢いを優先した結果と考えられる。`,
    mock: true
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const g = String(body.goroku || '').trim().slice(0, 40);
  const m = String(body.imi || '').trim().slice(0, 120);
  const a = String(body.age || '').trim().slice(0, 10);
  if (!g) return res.status(400).json({ error: '見出し語が空です' });

  const ip = (req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'しばらく待ってからもう一度どうぞ(1時間の上限に達しました)' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(200).json(mockEntry(g, m, a));

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.9,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `あなたは老舗国語辞典の編纂者。子どもの言い間違い・迷言を、権威ある国語辞典の項目として大真面目に記述する。笑いは「くだけた文体」でなく「辞典の格式と内容のギャップ」から生む。文体は辞典調(だ・である/体言止め)。子どもをバカにする表現・下品な表現は禁止。愛のある大真面目さで。必ずJSONのみを返す:
{"yomi":"見出し語のよみ(ひらがなのみ)","hinshi":"〔幼児語・名詞〕のような品詞表示(それらしく創作可)","teigi":"語釈1〜2文(意味・使用場面を辞典調で)","yourei":["用例1(「」つき・話者注記つき)","用例2(任意)"],"gogen":"語源考察2〜3文(音韻変化・発話者の心理を学術風に大真面目に推定)"}`
          },
          {
            role: 'user',
            content: `見出し語: ${g}\n意味・状況: ${m || '(未記入。語形から推定せよ)'}\n発話時年齢: ${a || '不明'}`
          }
        ]
      })
    });
    if (!r.ok) throw new Error(`openai ${r.status}`);
    const data = await r.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    if (!parsed.yomi || !parsed.teigi) throw new Error('bad shape');
    parsed.yourei = Array.isArray(parsed.yourei) ? parsed.yourei.slice(0, 2) : [];
    parsed.mock = false;
    return res.status(200).json(parsed);
  } catch (e) {
    // AI失敗でもアプリを止めない。ただし「鍵なしモック」とは区別し、ログに残す
    console.error('jiten fallback:', e.message);
    const fb = mockEntry(g, m, a);
    fb.mock = false;
    fb.fallback = true;
    return res.status(200).json(fb);
  }
}
