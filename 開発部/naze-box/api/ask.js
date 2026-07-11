// Naze Box — 子どもの「なんで？」に年齢に合わせて答えるサーバー関数（Vercel）
// OPENAI_API_KEY があれば本物、無ければモックを返す。キーはサーバー内のみで使用しクライアントに出さない。
// キー未設定なら OpenAI を一切叩かない＝コストゼロで動く。

const MODEL = 'gpt-4o-mini';

const CATEGORIES = ['宇宙', '生き物', '体', '食べ物', '科学', '社会', '感情', 'その他'];

// センシティブな話題（死・病気・事故・性・災害）は親向け補足を厚くする
const SENSITIVE = ['死', '亡く', '殺', '病気', '事故', '戦争', '災害', '地震', '津波',
  'セックス', '赤ちゃんはどこ', 'どうやってできる', 'いじめ', '離婚', 'がん'];

function isSensitive(q) {
  return SENSITIVE.some(w => q.includes(w));
}

function clip(s, n) {
  return String(s == null ? '' : s).slice(0, n);
}

// キーワードによる簡易カテゴリ分類（AIが返せなかった時のフォールバック）
function guessCategory(q) {
  const map = {
    宇宙: ['空', '星', '月', '太陽', '宇宙', '惑星', 'ロケット', '雲', '虹', '雨', '雪', '天気', '夜'],
    生き物: ['魚', '犬', '猫', '動物', '虫', '鳥', '恐竜', '花', '木', '植物', 'ペット', 'カエル', 'クモ'],
    体: ['体', '血', '骨', '歯', '髪', '目', '鼻', '耳', '寝', '眠', 'くしゃみ', '涙', 'けが', 'うんち', 'おしっこ'],
    食べ物: ['食べ', 'ごはん', '野菜', '肉', 'お菓子', '甘い', 'からい', '料理', '飲む', 'ジュース', 'パン'],
    科学: ['電気', '磁石', '火', '水', '氷', '溶け', '浮く', '音', '光', '機械', 'ロボット', '電池', '風'],
    社会: ['お金', '仕事', '学校', '国', 'ルール', '信号', '電車', 'バス', '警察', '選挙', '税金', '会社'],
    感情: ['気持ち', '悲しい', '怒', '泣', '好き', 'こわい', 'さみしい', 'うれしい', '友だち', 'どきどき'],
  };
  for (const cat of Object.keys(map)) {
    if (map[cat].some(w => q.includes(w))) return cat;
  }
  return 'その他';
}

// 年齢ごとの語り口の指針
function ageGuide(age) {
  switch (Number(age)) {
    case 3: return 'ひらがな中心。1〜2文。むずかしい言葉は使わない。「〜だよ」とやさしく。';
    case 5: return 'やさしい言葉で2〜3文。身近なものにたとえる。';
    case 7: return '小学校低学年向け。3〜4文。理由を少しだけ説明する。';
    case 10: return '小学校中〜高学年向け。4〜5文。仕組みを少していねいに、でも専門用語は噛みくだく。';
    default: return 'やさしい言葉で2〜3文。';
  }
}

function mockAnswer(question, age) {
  const sensitive = isSensitive(question);
  const childAnswer = age <= 3
    ? 'いいしつもんだね。それはね、ちゃんとわけがあるんだよ。いっしょにかんがえてみようね。'
    : 'とてもいい質問だね。それにはちゃんと理由があるんだ。少しずつ見ていこう。';
  return {
    childAnswer,
    analogy: 'たとえば、おふろのお湯とおなじで、身近なところにもヒントがかくれているよ。',
    parentNote: sensitive
      ? '【要フォロー】これはデリケートな話題です。お子さんの不安に寄り添い、「気になったんだね」とまず気持ちを受け止めてあげてください。年齢に応じて、怖がらせない範囲で正直に。答えに困ったら「一緒に調べようね」でも十分です。（※いまはモックモードです。OPENAI_API_KEY 設定後にAIの本回答が表示されます）'
      : 'いまはAI未接続のモック回答です。OPENAI_API_KEY を設定すると、質問に合わせた本物の回答が出ます。読み聞かせのきっかけにしてください。',
    nextQuestion: age <= 3 ? 'ほかにも「なんで？」ってなったこと、ある？' : 'この中で、いちばん「もっと知りたい！」と思ったのはどれ？',
    category: guessCategory(question),
  };
}

// ベストエフォートのレート制限（同一インスタンス内メモリ）。完全な上限ではない。
const WINDOW_MS = 60 * 1000;
const PER_IP_MAX = 15;
const GLOBAL_MAX = 80;
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
  const question = clip(body && body.question, 200).trim();
  const age = Number(body && body.age) || 5;

  if (!question) {
    res.status(400).json({ error: 'question required' });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(200).json({ ...mockAnswer(question, age), mock: true });
    return;
  }

  const sensitive = isSensitive(question);

  try {
    const prompt =
      `あなたは、子どもの「なんで？」にやさしく答える、あたたかい先生です。\n` +
      `子どもの年齢: ${age}歳\n語り口の指針: ${ageGuide(age)}\n質問: ${question}\n\n` +
      `次のルールを必ず守ってください:\n` +
      `- 年齢に合った言葉で、短く、親がその場で読み聞かせやすい長さにする\n` +
      `- 断定しすぎない。わからないことは正直に「まだよく分かっていないんだ」と言う\n` +
      `- 怖がらせない。安心できるトーンで\n` +
      (sensitive
        ? `- これはデリケートな話題（死・病気・事故・性・災害など）です。子どもへの答えはやさしく最小限にし、「親向け補足」を厚く書く。親がどう寄り添い、どう言葉を選べばよいかを具体的に助言する\n`
        : `- 親向け補足には、豆知識や会話を広げるヒントを一言添える\n`) +
      `- 最後に、子どもの好奇心を広げる「次に聞いてみる質問」を1つ出す\n\n` +
      `カテゴリは次から1つ選ぶ: ${CATEGORIES.join(' / ')}\n` +
      `出力はJSONのみ: {"childAnswer":"子どもへの答え","analogy":"わかりやすいたとえ話","parentNote":"親向け補足","nextQuestion":"次に聞いてみる質問","category":"カテゴリ"}`;

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
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!r.ok) {
      res.status(200).json({ ...mockAnswer(question, age), mock: true });
      return;
    }

    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
    let parsed = {};
    try { parsed = JSON.parse(content); } catch (_) {}

    const answer = {
      childAnswer: clip(parsed.childAnswer, 400) || mockAnswer(question, age).childAnswer,
      analogy: clip(parsed.analogy, 300),
      parentNote: clip(parsed.parentNote, 500),
      nextQuestion: clip(parsed.nextQuestion, 200),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : guessCategory(question),
      mock: false,
    };
    res.status(200).json(answer);
  } catch (_) {
    res.status(200).json({ ...mockAnswer(question, age), mock: true });
  }
}
