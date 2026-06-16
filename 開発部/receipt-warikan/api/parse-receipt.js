export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body || {};

  // ── 入力バリデーション（セキュリティ：公開APIにサイズ上限を入れてから鍵を登録する方針）──
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: '画像が不正です' });
  }
  // data URL の概算サイズ上限（約6MB）。巨大画像でのコスト暴発を防ぐ。
  if (image.length > 8_000_000) {
    return res.status(413).json({ error: '画像が大きすぎます' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI読み取りは未設定です（OPENAI_API_KEY 未登録）' });
  }

  const systemPrompt =
    `あなたはレシート読み取りアシスタントです。画像から「飲食・購入した品目名」と「税抜きの単価または記載金額」を抽出します。
合計・小計・お預り・お釣り・税・サービス料・割引などの行は品目に含めないでください。
出力は必ず次のJSONのみ：{"items":[{"name":"品名","price":数値}]}
金額は数値（円、整数）。読み取れない場合は items を空配列にしてください。`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'このレシートの品目と金額を抽出してください。' },
              { type: 'image_url', image_url: { url: image, detail: 'high' } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: text });
    }

    const data = await response.json();
    let parsed;
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch {
      return res.status(502).json({ error: '読み取り結果を解析できませんでした' });
    }

    const items = (parsed.items || [])
      .filter((it) => it && typeof it.name === 'string')
      .map((it) => ({ name: it.name.slice(0, 40), price: Math.max(0, Math.round(Number(it.price) || 0)) }))
      .slice(0, 50);

    res.status(200).json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
