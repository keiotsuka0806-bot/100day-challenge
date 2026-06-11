export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, side, history, turnIndex } = req.body;

  // ── 入力バリデーション ──
  if (!topic || typeof topic !== 'string' || topic.length > 120) {
    return res.status(400).json({ error: 'テーマが不正です' });
  }
  if (!['pro', 'con'].includes(side)) {
    return res.status(400).json({ error: '不正なサイド指定です' });
  }
  if (!Array.isArray(history) || history.length > 10) {
    return res.status(400).json({ error: '履歴が不正です' });
  }
  if (typeof turnIndex !== 'number' || turnIndex < 0 || turnIndex > 5) {
    return res.status(400).json({ error: 'ターン番号が不正です' });
  }

  const sideLabel = side === 'pro' ? '推進派' : '懐疑派';
  const oppLabel  = side === 'pro' ? '懐疑派' : '推進派';

  const turnNum = Math.floor(turnIndex / 2);
  const turnLabels = ['最初の主張', '反論', '最終発言'];
  const turnLabel = turnLabels[turnNum] || '発言';

  const systemPrompt =
    `あなたは「${topic}」についての討論において${sideLabel}（${side === 'pro' ? '賛成・推進' : '反対・懐疑'}側）を担います。
論理的・情熱的に自分の立場を主張し、相手の弱点を的確に突いてください。
制約：150〜200字で簡潔に。具体的な根拠や事例を必ず含める。日本語で話す。`;

  let userContent;

  if (history.length === 0) {
    userContent = `テーマ「${topic}」について、${sideLabel}として${turnLabel}を述べてください。力強く、説得力を持って主張してください。`;
  } else {
    const historyText = history
      .map(h => `【${h.side === 'pro' ? '推進派' : '懐疑派'}】${h.text}`)
      .join('\n\n');
    userContent = `これまでの討論：\n\n${historyText}\n\nあなたは${sideLabel}です。${oppLabel}の直近の主張に反論しながら、${turnLabel}を述べてください。`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: turnIndex >= 4 ? 500 : 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: text });
    }

    const data = await response.json();
    res.status(200).json({ text: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
