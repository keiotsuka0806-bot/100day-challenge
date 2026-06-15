import type {
  GraphSnapshot,
  SimResult,
  NodeMetric,
  OrgScores,
  DeptState,
  BottleneckLevel,
} from "../types";

const TERMINAL_OK = ["広報部"]; // 出口でOK(次に渡さなくても自然)な部署名

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

// スコア(0-100)→ 文字グレード
export function grade(n: number): string {
  if (n >= 90) return "A+";
  if (n >= 83) return "A";
  if (n >= 75) return "A-";
  if (n >= 68) return "B+";
  if (n >= 60) return "B";
  if (n >= 52) return "B-";
  if (n >= 44) return "C+";
  if (n >= 36) return "C";
  return "D";
}

// グラフ構造から、各部署のメーター・組織スコア・所見を決定的に算出する(AI不要)。
export function mockSimulate(g: GraphSnapshot): SimResult {
  const byId = new Map(g.departments.map((d) => [d.id, d]));
  const name = (id: string) => byId.get(id)?.name ?? id;

  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  const inInfos = new Map<string, string[]>();
  const outInfos = new Map<string, string[]>();
  g.departments.forEach((d) => {
    inDeg.set(d.id, 0); outDeg.set(d.id, 0); inInfos.set(d.id, []); outInfos.set(d.id, []);
  });
  g.flows.forEach((f) => {
    outDeg.set(f.from, (outDeg.get(f.from) ?? 0) + 1);
    inDeg.set(f.to, (inDeg.get(f.to) ?? 0) + 1);
    outInfos.get(f.from)?.push(f.info);
    inInfos.get(f.to)?.push(f.info);
  });

  const mutual = (a: string, b: string) =>
    g.flows.some((f) => f.from === a && f.to === b) && g.flows.some((f) => f.from === b && f.to === a);
  const reviewLoops = g.departments.reduce((acc, d) => {
    return acc + g.flows.filter((f) => f.from === d.id && mutual(d.id, f.to)).length;
  }, 0) / 2;
  const hasFeedbackLoop = detectCycle(g);

  // --- 各部署メーター ---
  const nodeMetrics: NodeMetric[] = g.departments.map((d) => {
    const i = inDeg.get(d.id) ?? 0;
    const o = outDeg.get(d.id) ?? 0;
    const load = clamp(i * 22 + o * 14);
    const concentrated = i >= 3;
    const isolated = i === 0 && o === 0;
    const deadend = i > 0 && o === 0 && !TERMINAL_OK.includes(d.name);

    let bottleneck: BottleneckLevel = "low";
    if (i >= 3 || load >= 80) bottleneck = "high";
    else if (i === 2 || load >= 55) bottleneck = "mid";

    let state: DeptState = "normal";
    let reason = `入${i}・出${o}。安定して流れています。`;
    if (isolated) { state = "danger"; reason = "どこともつながっておらず孤立しています。"; }
    else if (deadend) { state = "danger"; reason = "受け取るだけで次に渡しておらず、行き止まりです。"; }
    else if (i >= 3 || load >= 80) { state = "danger"; reason = `入力が${i}方向に集中し、処理待ちが起きやすい状態です。`; }
    else if (i === 2 || load >= 55) { state = "caution"; reason = `入力が${i}方向。やや負荷が高めです。`; }

    let comment: string;
    if (isolated) comment = "誰ともつながってない。私、何をすれば?";
    else if (concentrated) comment = "受け取る情報が多い。さばききれるか不安。";
    else if (deadend) comment = "受けっぱなしだ。次に渡せていない。";
    else comment = `「${d.strength ?? d.role}」で${o}方向に貢献中。気にしてるのは${d.risk ?? "品質"}。`;

    return {
      id: d.id, name: d.name, load, bottleneck, state, reason, concentrated,
      inInfos: inInfos.get(d.id) ?? [], outInfos: outInfos.get(d.id) ?? [], comment,
    };
  });

  const highCount = nodeMetrics.filter((m) => m.bottleneck === "high").length;
  const deadends = nodeMetrics.filter((m) => m.state === "danger" && m.reason.includes("行き止まり")).length;
  const isolateds = nodeMetrics.filter((m) => m.reason.includes("孤立")).length;
  const maxLoad = nodeMetrics.reduce((mx, m) => Math.max(mx, m.load), 0);
  const n = g.departments.length;

  const endNodes = nodeMetrics.filter((m) => (outDeg.get(m.id) ?? 0) === 0 && (inDeg.get(m.id) ?? 0) > 0);
  const reachHasOutlet = endNodes.length > 0;

  // --- 組織スコア ---
  const scores: OrgScores = {
    speed: clamp(92 - highCount * 16 - Math.max(0, n - 5) * 6 - Math.max(0, maxLoad - 70) * 0.4, 20),
    quality: clamp(58 + (reviewLoops > 0 ? 22 : 0) + (hasFeedbackLoop ? 12 : 0) - deadends * 12 - isolateds * 10, 15),
    lowRework: clamp(90 - reviewLoops * 16 - deadends * 12, 20),
    reach: clamp((reachHasOutlet ? 82 : 38) + (g.flows.length >= 5 ? 8 : 0) - isolateds * 8, 15),
    keyManRisk: clamp(maxLoad + (highCount >= 1 && n <= 5 ? 12 : 0)),
  };

  // --- ボトルネック一覧 ---
  const bottlenecks = nodeMetrics
    .filter((m) => m.bottleneck !== "low")
    .map((m) => `${m.name}: ${m.reason}`);
  if (!bottlenecks.length) bottlenecks.push("明確なボトルネックは検出されませんでした。");

  // --- 次の一手(具体的に) ---
  const suggestions: string[] = [];
  if (!hasFeedbackLoop) suggestions.push("「運用部 → 企画部」の改善データフローを追加し、学びが回るループを作る。");
  nodeMetrics.filter((m) => m.concentrated).forEach((m) =>
    suggestions.push(`${m.name}の手前に中継・整理役を置くか、入力を絞って集中を解消する。`));
  nodeMetrics.filter((m) => m.reason.includes("行き止まり")).forEach((m) =>
    suggestions.push(`${m.name}から次工程へ成果を渡す接続を足す。`));
  nodeMetrics.filter((m) => m.reason.includes("孤立")).forEach((m) =>
    suggestions.push(`${m.name}を関係部署と最低1本つなぐ。`));
  if (!reachHasOutlet) suggestions.push("成果が外に出る出口(広報部など)への接続を足し、発信力を上げる。");
  if (n <= 5) suggestions.push("「デザイン部」を企画部と開発部の間に追加し、UI判断の負荷を分散してみる。");
  if (!suggestions.length) suggestions.push("大きな問題はなし。新しい部署を足して効果を試してみる。");

  const flowSummary =
    `部署${n}個・情報の流れ${g.flows.length}本。` +
    (highCount ? `負荷の高い部署が${highCount}か所、` : "目立つ過負荷はなく、") +
    (hasFeedbackLoop ? "改善の輪あり。" : "改善の輪は未形成。") +
    `組織全体の最大負荷は${maxLoad}%。`;

  return { flowSummary, nodeMetrics, scores, bottlenecks, suggestions: suggestions.slice(0, 6), mode: "mock" };
}

function detectCycle(g: GraphSnapshot): boolean {
  const adj = new Map<string, string[]>();
  g.flows.forEach((f) => { if (!adj.has(f.from)) adj.set(f.from, []); adj.get(f.from)!.push(f.to); });
  const state = new Map<string, number>();
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
  for (const d of g.departments) if ((state.get(d.id) ?? 0) === 0 && dfs(d.id)) return true;
  return false;
}

// AIモード: 構造メーター/スコアは決定的なモックを使い、要約だけAIで上書き(失敗時は純モック)。
export async function simulate(g: GraphSnapshot, useApi: boolean): Promise<SimResult> {
  const base = mockSimulate(g);
  if (!useApi) return base;
  try {
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: g }),
    });
    if (!res.ok) return base;
    const data = await res.json();
    if (data && data.flowSummary) {
      return {
        ...base,
        mode: "ai",
        flowSummary: data.flowSummary,
        suggestions: Array.isArray(data.suggestions) && data.suggestions.length ? data.suggestions : base.suggestions,
      };
    }
    return base;
  } catch {
    return base;
  }
}
