// 思考のセカンドオピニオン — CBT認知再構成の伴走AI（サーバ側）
// stage: 'distortion'（歪みの候補） | 'socratic'（ソクラテス式の問い） | 'balance'（励まし）
// 鍵が無ければモックで動く。AIは診断・治療助言をしない。問いを返すだけ。

const DISTORTIONS = {
  all_or_nothing: '全か無か思考',
  overgeneralization: '過度の一般化',
  mental_filter: '心のフィルター',
  disqualifying_positive: 'マイナス化思考',
  jumping_to_conclusions: '結論の飛躍',
  magnification: '拡大解釈・過小評価',
  emotional_reasoning: '感情的決めつけ',
  should_statements: 'すべき思考',
  labeling: 'レッテル貼り',
  personalization: '個人化',
};

// 危機の言葉（簡易）。検出したら問診を止めて窓口へ誘導する。
const CRISIS_PATTERNS = [
  /死(に|の)?たい/, /消えたい/, /自殺/, /いなくなりたい/,
  /リスト?カット/, /死(の|ん)で/, /生きて(ても|いても)/,
];

function detectCrisis(text) {
  if (!text) return false;
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

// 簡易レート制限（同一IPから60秒に15回まで）。乱用によるOpenAI課金の暴走を防ぐ。
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 60000, max = 15;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // メモリ肥大の保険
  return arr.length > max;
}

const SAFETY = `あなたは医師でもセラピストでもなく、CBT（認知行動療法）の「思考記録」を一緒に進める伴走役です。
絶対の原則：
- 診断・断定・治療助言をしない。「あなたは○○障害」などと言わない。
- 相手の考えを「間違い」と否定しない。責めない。説教しない。
- 無理にポジティブにさせない。目指すのは"明るい考え"ではなく"現実的でバランスの取れた考え"。
- 答えを教えず、本人が自分で気づけるように問いを返す（ソクラテス式）。
- 温かく、短く、やさしい日本語で。1〜3文。`;

async function callOpenAI(messages, { json = false, maxTokens = 300 } = {}) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      temperature: 0.7,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── モック（鍵なしでも体験が成立するように） ──
function mockResponse(stage, body) {
  if (stage === 'distortion') {
    return {
      distortions: [
        { key: 'jumping_to_conclusions', why: '確かめていないのに、悪い結論を先取りしているかもしれません。' },
        { key: 'all_or_nothing', why: '「全部ダメ」と白黒で捉えているかもしれません。' },
      ],
    };
  }
  if (stage === 'socratic') {
    const qs = [
      'その考えを裏づける事実と、逆に当てはまらない事実は、それぞれ何がありますか？',
      'もし親しい友人が同じ状況にいたら、あなたは何と声をかけますか？',
      '最悪の見方を100%信じる根拠はありますか？　一番ありそうな現実は、どんなものでしょう。',
    ];
    return { question: qs[Math.min(body.qIndex || 0, qs.length - 1)] };
  }
  if (stage === 'balance') {
    return { message: '自分の言葉で見つめ直せたこと、それ自体が大きな一歩です。よく取り組みました。' };
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Vercelが付与する x-real-ip を優先（クライアント偽装に強い）。無ければ x-forwarded-for の先頭。
  const ip = req.headers['x-real-ip']
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: '少し時間をおいてからお試しください' });

  const { stage, situation = '', autoThought = '', distortion = '', qIndex = 0, balanceThought = '' } = req.body || {};
  if (!['distortion', 'socratic', 'balance'].includes(stage)) {
    return res.status(400).json({ error: 'stageが不正です' });
  }
  // 入力長の上限（暴走・コスト対策）
  for (const v of [situation, autoThought, balanceThought]) {
    if (typeof v !== 'string' || v.length > 500) {
      return res.status(400).json({ error: '入力が長すぎます' });
    }
  }

  // 危機検出は最優先。AIに渡す前に止める。
  if (detectCrisis(situation) || detectCrisis(autoThought) || detectCrisis(balanceThought)) {
    return res.status(200).json({ crisis: true });
  }

  // 鍵が無ければモック
  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({ ...mockResponse(stage, { qIndex }), mock: true });
  }

  try {
    if (stage === 'distortion') {
      const list = Object.entries(DISTORTIONS).map(([k, v]) => `${k}: ${v}`).join('\n');
      const content = await callOpenAI([
        { role: 'system', content: `${SAFETY}\n\n次の「自動思考」に最も当てはまりそうな認知の歪みを、下のリストから2つ選びます。\n${list}\n\n出力はJSONのみ：{"distortions":[{"key":"<リストのkey>","why":"<なぜそう見えるか。30字程度。決めつけず『〜かもしれません』と添える>"},{...}]}` },
        { role: 'user', content: `状況：${situation}\n自動思考：${autoThought}` },
      ], { json: true, maxTokens: 250 });
      return res.status(200).json(JSON.parse(content));
    }

    if (stage === 'socratic') {
      const intents = [
        'その考えを支持する事実と、反する事実の両方に目を向けてもらう問い',
        '大切な友人が同じ状況なら何と声をかけるかを考えてもらう問い',
        '最悪の見方の根拠と、一番ありそうな現実を見比べてもらう問い',
      ];
      const intent = intents[Math.min(qIndex, intents.length - 1)];
      const content = await callOpenAI([
        { role: 'system', content: SAFETY },
        { role: 'user', content: `状況：${situation}\n自動思考：${autoThought}\n気になっている歪み：${DISTORTIONS[distortion] || '未選択'}\n\nこの人に向けて、次のねらいの問いを1つだけ、状況に合わせてやさしく投げかけてください（問いの文だけを返す）。\nねらい：${intent}` },
      ], { maxTokens: 160 });
      return res.status(200).json({ question: content.trim() });
    }

    if (stage === 'balance') {
      const content = await callOpenAI([
        { role: 'system', content: SAFETY },
        { role: 'user', content: `この人が見つけ直した「バランスの取れた考え」：${balanceThought}\n\n添削や修正はせず、取り組みをねぎらう短い言葉を1〜2文で返してください。` },
      ], { maxTokens: 120 });
      return res.status(200).json({ message: content.trim() });
    }
  } catch (err) {
    // 失敗時はモックにフォールバック（体験を止めない）
    return res.status(200).json({ ...mockResponse(stage, { qIndex }), fallback: true });
  }
}
