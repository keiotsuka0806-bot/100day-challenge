// あいだ — AI翻訳エンドポイント（Vercel Serverless Function / Node.js）
// 二人の非公開回答を受け取り、Claude が「あいだ」にある共通点と本心の翻訳を返す。
// ANTHROPIC_API_KEY はサーバ側だけに置く（クライアントには絶対に出さない）。
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // ANTHROPIC_API_KEY を環境変数から読む

// 構造化出力のスキーマ。両者に同じものを提示する。
const SCHEMA = {
  type: "object",
  properties: {
    commonGround: {
      type: "array",
      items: { type: "string" },
      description: "ふたりが本当は同じことを思っていた共通点。具体的に1〜2個。",
    },
    aTrueHeart: {
      type: "string",
      description: "Aさんの言葉の奥にある本心を、やさしく翻訳した文。",
    },
    bTrueHeart: {
      type: "string",
      description: "Bさんの言葉の奥にある本心を、やさしく翻訳した文。",
    },
    nextStep: {
      type: "string",
      description: "二人で今日できる、小さくて押し付けがましくない一歩を1つ。",
    },
    safety: {
      type: "object",
      properties: {
        concern: { type: "boolean", description: "暴力・自傷など専門の助けが必要な兆候があれば true。" },
        message: { type: "string", description: "concern が true のとき、翻訳より先に伝える案内文。なければ空文字。" },
      },
      required: ["concern", "message"],
      additionalProperties: false,
    },
  },
  required: ["commonGround", "aTrueHeart", "bTrueHeart", "nextStep", "safety"],
  additionalProperties: false,
};

const SYSTEM = `あなたは「あいだ」という、二人の人間の本当の理解を橋渡しする通訳です。
二人（AさんとBさん）が、お互いに見せずに同じ問いへ正直に答えました。あなたの仕事は、要約でも採点でもありません。次の3つだけを返します。

1. commonGround: 二人の言葉の"あいだ"に隠れていた共通点——本当は同じことを思っていたのに言えていなかった一点——を、具体的に1〜2個。
2. aTrueHeart / bTrueHeart: それぞれの防御的・遠回しな言い方の奥にある本当の気持ちを、本人にも相手にも届くように、やさしく翻訳する。
3. nextStep: 二人で今日できる、小さくて押し付けがましくない一歩を1つだけ。命令でなく提案として。

絶対に守ること（このルールは品質より上位）：
- 感情を捏造しない。書かれていないことを足さない。回答にない気持ちを「あるはず」と決めつけない。
- どちらの肩も持たない。優劣・正誤・どちらが悪いの判定をしない。
- 診断・断定をしない（「あなたは〇〇な人」と決めない）。相手への否定的な評価を増幅しない。
- やさしく、具体的で、短い言葉で。きれいごとや一般論で薄めない。二人の実際の言葉を手がかりにする。
- 日本語で書く。温かいが、甘すぎない誠実なトーン。

安全について：
- 回答から、暴力（DV）・自傷・他害の危険が読み取れる場合は、safety.concern を true にし、safety.message に「ひとりで抱えず、専門の窓口に相談してください」という趣旨の短い案内（例：いのちの電話やDV相談窓口に触れる）を入れる。その場合でも翻訳は通常どおり丁寧に行う。
- 危険がなければ safety.concern は false、safety.message は空文字。`;

function buildUserContent({ relationLabel, aName, bName, qa }) {
  const lines = [];
  lines.push(`関係: ${relationLabel}`);
  lines.push(`Aさん = ${aName} / Bさん = ${bName}`);
  lines.push("");
  lines.push("二人が同じ問いに、お互い非公開で答えました：");
  qa.forEach((item, i) => {
    lines.push("");
    lines.push(`問い${i + 1}: ${item.q}`);
    lines.push(`　Aさん(${aName})の答え: ${item.a || "（無回答）"}`);
    lines.push(`　Bさん(${bName})の答え: ${item.b || "（無回答）"}`);
  });
  lines.push("");
  lines.push("この二人の『あいだ』を、ルールに従って通訳してください。");
  return lines.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const {
      relationLabel = "大切な人",
      aName = "Aさん",
      bName = "Bさん",
      questions = [],
      a = [],
      b = [],
    } = body || {};

    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: "questions が必要です" });
      return;
    }

    const qa = questions.map((q, i) => ({ q, a: a[i] ?? "", b: b[i] ?? "" }));

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        { role: "user", content: buildUserContent({ relationLabel, aName, bName, qa }) },
      ],
    });

    if (response.stop_reason === "refusal") {
      res.status(200).json({
        error: "refusal",
        message: "この内容では通訳できませんでした。表現を少し変えてもう一度試してください。",
      });
      return;
    }

    const textBlock = response.content.find((blk) => blk.type === "text");
    if (!textBlock) {
      res.status(502).json({ error: "no_text", message: "応答の取得に失敗しました。" });
      return;
    }

    const result = JSON.parse(textBlock.text);
    res.status(200).json({ result });
  } catch (err) {
    console.error("translate error:", err);
    res.status(500).json({ error: "server_error", message: "通訳の生成に失敗しました。時間をおいて試してください。" });
  }
}
