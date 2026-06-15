// AIOrgSim(任意のAI分析モード)— 組織グラフを受け取り、構造変化の影響をAIで分析する。
// OPENAI_API_KEY は環境変数で秘匿。未設定/失敗時はフロント側がモックに自動フォールバックする。
// ローカルの `npm run dev`(Vite)ではこの関数は動かない=モックで動作。`vercel dev` か本番でAI分析が有効。

const MODEL = "gpt-4o";

const SYSTEM = `あなたはAI開発スタジオの組織設計コンサルタントです。
ユーザーが「部署(ノード)」と「部署間の情報の流れ(矢印)」からなるAI組織図を送ってきます。
その構造を読み、情報フロー・ボトルネック・副作用を分析してください。寸劇ではなく、構造分析を返します。
平易な日本語で、各項目は短く具体的に。`;

const SCHEMA = {
  type: "object",
  properties: {
    flowSummary: { type: "string", description: "組織全体の変化と情報フローの要約(2〜3文)" },
    improvements: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    bottlenecks: { type: "array", items: { type: "string" } },
    deptComments: {
      type: "array",
      items: {
        type: "object",
        properties: { dept: { type: "string" }, comment: { type: "string" } },
        required: ["dept", "comment"],
        additionalProperties: false,
      },
    },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["flowSummary", "improvements", "risks", "bottlenecks", "deptComments", "suggestions"],
  additionalProperties: false,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY未設定(モックを使ってください)" });

  const graph = req.body && req.body.graph;
  if (!graph || !Array.isArray(graph.departments)) {
    return res.status(400).json({ error: "graph(departments/flows)が必要です" });
  }

  const userText =
    "部署:\n" +
    graph.departments.map((d) => `- ${d.name}(役割:${d.role}/得意:${d.strength || "-"}/注意:${d.risk || "-"})`).join("\n") +
    "\n\n情報の流れ:\n" +
    (graph.flows || []).map((f) => {
      const name = (id) => (graph.departments.find((d) => d.id === id) || {}).name || id;
      return `- ${name(f.from)} →[${f.info}]→ ${name(f.to)}`;
    }).join("\n");

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userText },
        ],
        response_format: { type: "json_schema", json_schema: { name: "org_analysis", strict: true, schema: SCHEMA } },
      }),
    });
    if (!r.ok) {
      console.error("OpenAI error", r.status, await r.text());
      return res.status(502).json({ error: "AI分析に失敗(モックに戻ります)" });
    }
    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) return res.status(502).json({ error: "応答を解釈できませんでした" });
    return res.status(200).json(JSON.parse(content));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "予期せぬエラー" });
  }
}
