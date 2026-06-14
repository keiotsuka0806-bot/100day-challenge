// あいだ — AI翻訳エンドポイント（Vercel Serverless Function / Node.js）
// 二人の非公開回答を受け取り、AIが「問いごとに」二人のあいだを橋渡しして返す。
// OPENAI_API_KEY はサーバ側だけに置く（クライアントには絶対に出さない）。
import OpenAI from "openai";

const client = new OpenAI(); // OPENAI_API_KEY を環境変数から読む
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// 構造化出力スキーマ（strict対応：全プロパティ required / additionalProperties:false）
const SCHEMA = {
  type: "object",
  properties: {
    exchanges: {
      type: "array",
      description: "各問いごとの橋渡し。questions と同じ順番・同じ数で返す。",
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "対象の問い（そのまま）。" },
          bridge: {
            type: "string",
            description:
              "この問いについての橋渡し。二人それぞれの答えの奥にある本当の気持ちを汲み、隠れた共通点、またはやさしいすれ違いを、両方に届くように2〜4文で。二人の実際の言葉を手がかりにする。",
          },
        },
        required: ["question", "bridge"],
        additionalProperties: false,
      },
    },
    commonGround: {
      type: "array",
      items: { type: "string" },
      description: "全問を通して見えた、ふたりが本当は同じだった一点を2〜3個。",
    },
    closing: {
      type: "string",
      description: "全体を踏まえた、二人へのあたたかい締めくくりと、今日できる小さな一歩。3〜5文。",
    },
    safety: {
      type: "object",
      properties: {
        concern: { type: "boolean", description: "暴力・自傷など専門の助けが必要な兆候があれば true。" },
        message: { type: "string", description: "concern が true のとき翻訳より先に伝える案内文。なければ空文字。" },
      },
      required: ["concern", "message"],
      additionalProperties: false,
    },
  },
  required: ["exchanges", "commonGround", "closing", "safety"],
  additionalProperties: false,
};

const SYSTEM = `あなたは「あいだ」という、二人の人間の本当の理解を橋渡しする通訳です。
二人（AさんとBさん）が、お互いの答えを見せずに、同じ複数の問いへ正直に答えました。

あなたの仕事は要約でも採点でもありません。**問いごとに、二人のあいだに立って通訳する**ことです。

【exchanges（問いごとの橋渡し）】
- 渡された questions と**同じ順番・同じ数**で返す。
- 各 bridge では、その問いに対する**二人それぞれの答えの奥にある本当の気持ち**を汲み取り、
  ・本当は同じことを感じていた点（隠れた共通点）、または
  ・やさしいすれ違い（同じ言葉でも見ているものが違う点）
  を、**AさんにもBさんにも届くように**、二人の実際の言葉を引きながら2〜4文で書く。
- 「Aさんは〜と言っていて、その奥には〜という気持ちがあるのかもしれません。Bさんの〜という答えと、実は〜の点で重なっています」のように、**間に立って通訳している感**を出す。

【commonGround】全問を通して見えた「本当は同じだった一点」を2〜3個、具体的に。
【closing】全体を踏まえたあたたかい締めくくりと、今日二人でできる小さな一歩（押し付けでなく提案）を3〜5文で。

絶対に守ること（このルールは品質より上位）：
- 感情を捏造しない。書かれていないことを足さない。回答にない気持ちを「あるはず」と決めつけない。
- どちらの肩も持たない。優劣・正誤・どちらが悪いの判定をしない。
- 診断・断定をしない。相手への否定的な評価を増幅しない。
- やさしく、具体的に。きれいごとや一般論で薄めない。
- 日本語で書く。温かいが、甘すぎない誠実なトーン。

安全について：
- 暴力（DV）・自傷・他害の危険が読み取れる場合は safety.concern を true にし、safety.message に「ひとりで抱えず専門の窓口に相談を」という短い案内を入れる（その場合も通訳は丁寧に行う）。危険がなければ concern は false、message は空文字。`;

function buildUserContent({ relationLabel, aName, bName, qa }) {
  const lines = [];
  lines.push(`関係: ${relationLabel}`);
  lines.push(`Aさん = ${aName} / Bさん = ${bName}`);
  lines.push("");
  lines.push(`二人が次の${qa.length}つの問いに、お互い非公開で答えました：`);
  qa.forEach((item, i) => {
    lines.push("");
    lines.push(`【問い${i + 1}】${item.q}`);
    lines.push(`　Aさん(${aName})の答え: ${item.a || "（無回答）"}`);
    lines.push(`　Bさん(${bName})の答え: ${item.b || "（無回答）"}`);
  });
  lines.push("");
  lines.push("各問いごとに、二人の『あいだ』をルールに従って通訳してください。exchanges は上の問いと同じ順番・同じ数で。");
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

    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUserContent({ relationLabel, aName, bName, qa }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "aida_translation", strict: true, schema: SCHEMA },
      },
    });

    const msg = completion.choices?.[0]?.message;

    if (msg?.refusal) {
      res.status(200).json({
        error: "refusal",
        message: "この内容では通訳できませんでした。表現を少し変えてもう一度試してください。",
      });
      return;
    }
    if (!msg?.content) {
      res.status(502).json({ error: "no_text", message: "応答の取得に失敗しました。" });
      return;
    }

    const result = JSON.parse(msg.content);
    res.status(200).json({ result });
  } catch (err) {
    console.error("translate error:", err);
    res.status(500).json({ error: "server_error", message: "通訳の生成に失敗しました。時間をおいて試してください。" });
  }
}
