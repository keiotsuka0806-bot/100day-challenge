import type { GraphSnapshot, SimResult } from "../types";
import { DEPT_TEMPLATES, TEMPLATE_BY_ID, resolveWires, type DeptTemplate } from "../data/deptLibrary";
import { mockSimulate } from "./simulate";

export interface Recommendation {
  template: DeptTemplate;
  targetName: string; // 今つまっている部署
  reason: string; // なぜ詰まっているか
  effects: string[]; // 期待効果(ドライランで計算した本物の差分)
  connections: string[]; // 追加される接続
}

// 詰まっている部署 → 置くと楽になる部署の候補(第一〜第三候補)
const CANDIDATES: Record<string, string[]> = {
  kaihatsu: ["design", "pm", "automation"],
  kikaku: ["pm", "research", "knowledge"],
  qa: ["automation", "knowledge"],
  unyo: ["automation", "cs"],
  koho: ["editorial", "cs"],
};

// ある部署テンプレを今のグラフに「裏で置いてみて」効果を計算する(ドライラン)。
function predict(snapshot: GraphSnapshot, baseline: SimResult, t: DeptTemplate) {
  const newId = "__pred__";
  const existing = new Set(snapshot.departments.map((d) => d.id));
  const wires = resolveWires(t, newId, existing);
  const newSnap: GraphSnapshot = {
    departments: [
      ...snapshot.departments,
      { id: newId, name: t.name, role: t.role, strength: t.strength, risk: t.risk },
    ],
    flows: [...snapshot.flows, ...wires.map((w) => ({ from: w.from, to: w.to, info: w.label }))],
  };
  const after = mockSimulate(newSnap);

  const beforeLoad = new Map(baseline.nodeMetrics.map((m) => [m.name, m.load]));
  const effects: string[] = [];

  // 負荷が下がった部署(上位2件)
  const drops = after.nodeMetrics
    .filter((m) => m.name !== t.name && beforeLoad.has(m.name))
    .map((m) => ({ name: m.name, before: beforeLoad.get(m.name)!, after: m.load }))
    .filter((d) => d.after < d.before)
    .sort((a, b) => b.before - b.after - (a.before - a.after));
  drops.slice(0, 2).forEach((d) => effects.push(`${d.name}の負荷 ${d.before}% → ${d.after}%`));

  // スコア改善(品質/速度/発信力/手戻り) と 副作用(下がるもの)
  const sc = baseline.scores, sa = after.scores;
  const scoreLine = (label: string, b: number, a: number) => {
    const diff = a - b;
    if (diff >= 3) effects.push(`${label} +${diff}`);
  };
  scoreLine("品質", sc.quality, sa.quality);
  scoreLine("発信力", sc.reach, sa.reach);
  scoreLine("手戻りの少なさ", sc.lowRework, sa.lowRework);
  if (sa.speed - sc.speed <= -4) effects.push(`(副作用)速度 ${sa.speed - sc.speed}`);

  const nameOf = (id: string) => newSnap.departments.find((d) => d.id === id)?.name ?? id;
  const connections = wires.map((w) => `${nameOf(w.from)}→${nameOf(w.to)}: ${w.label}`);

  return { effects, connections };
}

// 現在の組織から「おすすめ部署」を提案する(ルールベース)。
export function recommend(snapshot: GraphSnapshot, result: SimResult): Recommendation[] {
  const metrics = result.nodeMetrics;
  const existingNames = new Set(snapshot.departments.map((d) => d.name));

  // 詰まっている部署(負荷高い順)
  const targets = metrics
    .filter((m) => m.bottleneck !== "low" || m.load >= 60)
    .sort((a, b) => b.load - a.load);

  // 広報の入力不足も対象に
  const koho = metrics.find((m) => m.id === "koho");
  if (koho && koho.inInfos.length === 0 && !targets.find((t) => t.id === "koho")) targets.push(koho);

  const recs: Recommendation[] = [];
  const used = new Set<string>();
  for (const tgt of targets) {
    const cands = CANDIDATES[tgt.id] ?? [];
    for (const tid of cands) {
      if (used.has(tid)) continue;
      const t = TEMPLATE_BY_ID.get(tid);
      if (!t || existingNames.has(t.name)) continue;
      const { effects, connections } = predict(snapshot, result, t);
      if (!effects.length) continue;
      recs.push({ template: t, targetName: tgt.name, reason: tgt.reason, effects, connections });
      used.add(tid);
      break; // 1部署につき第一候補を1つ
    }
    if (recs.length >= 3) break;
  }
  return recs;
}

export { DEPT_TEMPLATES };
