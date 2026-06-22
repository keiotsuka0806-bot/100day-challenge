// Vercel サーバーレス関数: 大喜利のお題に対するAIのボケを1つ返す。
// APIキーは環境変数 OPENAI_API_KEY からのみ読む（ブラウザに出さない）。
// 鍵が未設定なら 501 を返し、クライアントは「とぼけるAIキャラ」のモック回答にフォールバックする。
//
// コスト保護（AIを本番ONにするため）:
//  - 同一サイト(Origin==Host)からのリクエストだけ許可（外部からの直叩きを弾く）
//  - IPごとに 10分20回までの簡易レート制限（暖機中インスタンス内・無料枠の防波堤）
//  - 安いモデル＋max_tokens小さめで1回あたりのコストを最小化

const RL = new Map(); // ip -> number[]（リクエスト時刻）
const RL_WINDOW_MS = 10 * 60 * 1000;
const RL_MAX = 20;

function rateLimited(ip) {
  const now = Date.now();
  const arr = (RL.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  RL.set(ip, arr);
  if (RL.size > 5000) RL.clear(); // メモリ暴走の保険
  return arr.length > RL_MAX;
}

function sameSite(req) {
  const host = req.headers.host || "";
  const origin = req.headers.origin || "";
  if (!origin) return true; // 同一オリジンでOriginが無い場合は許容
  try { return new URL(origin).host === host; } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }
  if (!sameSite(req)) { res.status(403).json({ error: "forbidden" }); return; }

  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(501).json({ needsKey: true }); return; }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) { res.status(429).json({ error: "rate limited" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const prompt = String((body && body.prompt) || "").slice(0, 80);
  if (!prompt) { res.status(400).json({ error: "no prompt" }); return; }

  const system =
    "あなたは大喜利の名人です。お題に対して、短く気の利いた面白い回答を1つだけ返します。" +
    "前置き・説明・記号・かぎ括弧は付けず、回答の本文だけを20字以内で出力します。" +
    "下品すぎる/攻撃的すぎる内容は避け、機転とシュールさで笑わせます。";

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `お題：${prompt}` },
        ],
        temperature: 1.0,
        max_tokens: 60,
      }),
    });
    if (!r.ok) { res.status(502).json({ error: "openai error" }); return; }
    const data = await r.json();
    let text = (data.choices?.[0]?.message?.content || "").trim();
    text = text.replace(/^[「『"']|[」』"']$/g, "").slice(0, 40);
    res.status(200).json({ text: text || "ノーコメント" });
  } catch (e) {
    res.status(502).json({ error: "fetch failed" });
  }
}
