import type { GraphSnapshot, SimResult } from "../types";

// 終端でOKな部署(出力が外向き=次に渡さなくても自然)
const TERMINAL_OK = ["広報部"];

// グラフ構造から決定的に分析する「モックシミュレーション」。
// Claude/AIが無くてもそれっぽく動く。構造(入次数・出次数・孤立・循環)から導く。
export function mockSimulate(g: GraphSnapshot): SimResult {
  const byId = new Map(g.departments.map((d) => [d.id, d]));
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  g.departments.forEach((d) => {
    inDeg.set(d.id, 0);
    outDeg.set(d.id, 0);
  });
  g.flows.forEach((f) => {
    outDeg.set(f.from, (outDeg.get(f.from) ?? 0) + 1);
    inDeg.set(f.to, (inDeg.get(f.to) ?? 0) + 1);
  });

  const name = (id: string) => byId.get(id)?.name ?? id;

  const improvements: string[] = [];
  const risks: string[] = [];
  const bottlenecks: string[] = [];
  const suggestions: string[] = [];

  // ボトルネック: 入ってくる情報が多い部署(集中しすぎ)
  g.departments.forEach((d) => {
    const i = inDeg.get(d.id) ?? 0;
    if (i >= 3) {
      bottlenecks.push(`${d.name}に情報が${i}方向から集中。処理待ちが起きやすい。`);
      suggestions.push(`${d.name}の手前に中継・整理役を置くか、入力を絞る。`);
    }
  });

  // 行き止まり: 受け取るが誰にも渡さない(終端OK部署は除く)
  g.departments.forEach((d) => {
    const i = inDeg.get(d.id) ?? 0;
    const o = outDeg.get(d.id) ?? 0;
    if (i > 0 && o === 0 && !TERMINAL_OK.includes(d.name)) {
      risks.push(`${d.name}が情報を受け取るだけで次に渡していない(行き止まり)。成果が組織に還流しない。`);
      suggestions.push(`${d.name}から成果や学びを次の部署へ流す接続を足す。`);
    }
  });

  // 孤立: 接続ゼロ
  g.departments.forEach((d) => {
    const i = inDeg.get(d.id) ?? 0;
    const o = outDeg.get(d.id) ?? 0;
    if (i === 0 && o === 0) {
      risks.push(`${d.name}がどこともつながっていない(孤立)。存在しても組織に効いていない。`);
      suggestions.push(`${d.name}を、関係する部署と最低1本つなぐ。`);
    }
  });

  // フィードバックループの有無(改善が回るか)
  const hasLoop = g.flows.some((f) =>
    g.flows.some((b) => b.from === f.to && b.to === f.from)
  ) || detectCycle(g);
  if (hasLoop) {
    improvements.push("フィードバックの輪がある。手戻りや改善が組織内で回収できる。");
  } else {
    risks.push("一方通行の流れだけで、改善やレビューが前工程に戻らない。品質が上がりにくい。");
    suggestions.push("下流の学び(改善データ・不具合)を上流へ戻すループを1本作る。");
  }

  // 規模に応じた一般的所見
  const n = g.departments.length;
  if (n >= 7) {
    risks.push(`部署が${n}個と多め。連携の手間(調整コスト)が増え、判断が遅くなりやすい。`);
  } else {
    improvements.push(`部署数は${n}個。小回りが利き、意思決定が速い構成。`);
  }

  // 各部署の一言(役割+構造から)
  const deptComments = g.departments.map((d) => {
    const i = inDeg.get(d.id) ?? 0;
    const o = outDeg.get(d.id) ?? 0;
    let c: string;
    if (i === 0 && o === 0) c = `誰ともつながってない。私、何をすれば?`;
    else if (i >= 3) c = `受け取る情報が多い。さばききれるか不安。`;
    else if (o === 0 && !TERMINAL_OK.includes(d.name)) c = `受けっぱなしだ。次に渡せていない。`;
    else c = `「${d.strength ?? d.role}」で${o}方向に貢献中。気にしてるのは${d.risk ?? "品質"}。`;
    return { dept: d.name, comment: c };
  });

  const flowSummary =
    `部署${n}個・情報の流れ${g.flows.length}本の組織。` +
    (bottlenecks.length ? `集中点が${bottlenecks.length}か所、` : "目立つ集中点はなく、") +
    (hasLoop ? "改善の輪は存在。" : "改善の輪は未形成。");

  if (!improvements.length) improvements.push("大きな崩れはなく、素直に流れる構成。");
  if (!risks.length) risks.push("現時点で目立つリスクは検出されず。");
  if (!bottlenecks.length) bottlenecks.push("明確なボトルネックは検出されず。");
  if (!suggestions.length) suggestions.push("現状は良好。新しい部署を足して効果を試してみる。");

  return { flowSummary, improvements, risks, bottlenecks, deptComments, suggestions, mode: "mock" };
}

// 単純な有向サイクル検出(改善ループ判定の補助)
function detectCycle(g: GraphSnapshot): boolean {
  const adj = new Map<string, string[]>();
  g.flows.forEach((f) => {
    if (!adj.has(f.from)) adj.set(f.from, []);
    adj.get(f.from)!.push(f.to);
  });
  const state = new Map<string, number>(); // 0=未,1=訪問中,2=完了
  const dfs = (u: string): boolean => {
    state.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      const s = state.get(v) ?? 0;
      if (s === 1) return true;
      if (s === 0 && dfs(v)) return true;
    }
    state.set(u, 2);
    return false;
  };
  for (const d of g.departments) {
    if ((state.get(d.id) ?? 0) === 0 && dfs(d.id)) return true;
  }
  return false;
}

// 本番/vercel dev では /api/simulate(OpenAI)を試し、ダメならモックにフォールバック。
export async function simulate(g: GraphSnapshot, useApi: boolean): Promise<SimResult> {
  if (!useApi) return mockSimulate(g);
  try {
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: g }),
    });
    if (!res.ok) return mockSimulate(g);
    const data = await res.json();
    if (data && data.flowSummary) return { ...data, mode: "ai" } as SimResult;
    return mockSimulate(g);
  } catch {
    return mockSimulate(g);
  }
}
