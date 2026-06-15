// AIOrgSim — 組織変更の仮説を入れると、各部署キャラが寸劇でシミュレートする
// Vercel Serverless Function。ANTHROPIC_API_KEY は環境変数で秘匿（クライアントに出さない）。

const MODEL = "claude-opus-4-8";

// #100Day Challenge の実組織（本社CLAUDE.mdの部署定義より）。寸劇の登場人物。
const DEPARTMENTS = `
- 企画部: アイデア生成・仕様書・技術選定。口調=好奇心旺盛で前のめり。気にすること=独自性と「使う理由」。
- 開発部: 実装・バグ修正・リファクタリング。口調=現実的で手を動かす派。気にすること=実装コストと1日1本のペース。
- QA部: コードレビュー・品質チェック。口調=冷静で慎重。気にすること=品質・セキュリティ・破綻。
- 運用部: デプロイ・日次レポート・監視。口調=俯瞰的で段取り重視。気にすること=回る仕組みとデータ。
- 広報部: note発信・マネタイズ。口調=熱くて読者目線。気にすること=物語性と「人に届くか」。
`;

const SYSTEM = `あなたは「AIOrgSim」というアプリの頭脳です。ユーザーは「#100Day Challenge」というAIファースト開発スタジオ(1日1プロジェクトを作る会社)の経営者Keiです。

Keiが「もし○○したら(組織変更の仮説)」を入力します。あなたは下記5部署それぞれのキャラクターになりきり、その変更後の組織の動きを"寸劇(short dialogue)"として演じてください。

${DEPARTMENTS}

ルール:
- 5部署が必ず1回以上発言する。噛み合った会話にする(全員が同じことを言わない。賛成・反対・条件・副作用が混ざる)。
- 嘘をつかない。実在しない事実を作らない。あくまで「こうなりそう」というシミュレーション。
- 専門用語は避け、Keiにわかる平易な日本語で。
- 最後に「良い変化」と「崩れる箇所(リスク)」を具体的に挙げ、1行の結論を出す。
- 寸劇は8〜14発言程度。長すぎない。`;

// 構造化出力スキーマ(json_schema)。additionalProperties:false 必須。
const SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speaker: { type: "string", description: "発言する部署名(企画部/開発部/QA部/運用部/広報部)" },
          text: { type: "string", description: "そのキャラのセリフ" },
        },
        required: ["speaker", "text"],
        additionalProperties: false,
      },
    },
    good_changes: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    summary: { type: "string", description: "1行の結論" },
  },
  required: ["scenes", "good_changes", "risks", "summary"],
  additionalProperties: false,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "サーバー側でANTHROPIC_API_KEYが未設定です" });
    return;
  }

  const hypothesis = (req.body && req.body.hypothesis ? String(req.body.hypothesis) : "").trim();
  if (!hypothesis) {
    res.status(400).json({ error: "仮説(hypothesis)を入力してください" });
    return;
  }
  if (hypothesis.length > 1000) {
    res.status(400).json({ error: "入力が長すぎます(1000文字以内)" });
    return;
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        output_config: {
          effort: "low", // 寸劇生成は速さ優先で十分
          format: { type: "json_schema", schema: SCHEMA },
        },
        system: SYSTEM,
        messages: [{ role: "user", content: `組織変更の仮説:\n${hypothesis}` }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("Anthropic API error", r.status, detail);
      res.status(502).json({ error: "AIの応答に失敗しました。少し待って再試行してください。" });
      return;
    }

    const data = await r.json();

    if (data.stop_reason === "refusal") {
      res.status(200).json({ error: "この内容には応答できませんでした。別の言い回しで試してください。" });
      return;
    }

    // 構造化出力: 最初のtextブロックが有効なJSON
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) {
      res.status(502).json({ error: "AIの応答を解釈できませんでした。再試行してください。" });
      return;
    }

    const result = JSON.parse(textBlock.text);
    res.status(200).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "予期せぬエラーが発生しました。再試行してください。" });
  }
}
