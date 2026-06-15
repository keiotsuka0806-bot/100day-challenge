import { useCallback, useMemo, useRef, useState } from "react";
import { useNodesState, useEdgesState, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import OrgCanvas from "./components/OrgCanvas";
import AddDeptPanel from "./components/AddDeptPanel";
import ResultPanel, { type ChangeSummary } from "./components/ResultPanel";
import NodeDetail from "./components/NodeDetail";
import Legend from "./components/Legend";
import { initialNodes, initialEdges } from "./data/initialOrg";
import { simulate } from "./sim/simulate";
import { edgeStyle } from "./edgeDefaults";
import type { DeptData, GraphSnapshot, SimResult } from "./types";

const SCORE_LABELS = [
  { key: "speed", label: "速度", goodUp: true },
  { key: "quality", label: "品質", goodUp: true },
  { key: "lowRework", label: "手戻りの少なさ", goodUp: true },
  { key: "reach", label: "発信力", goodUp: true },
  { key: "keyManRisk", label: "属人化リスク", goodUp: false },
] as const;

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DeptData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [result, setResult] = useState<SimResult | null>(null);
  const [change, setChange] = useState<ChangeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [useApi, setUseApi] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);

  // 前回シミュレーション時の状態(Before/After用)
  const prev = useRef<{ result: SimResult; snapshot: GraphSnapshot } | null>(null);

  const snapshot = useCallback((): GraphSnapshot => ({
    departments: nodes.map((n) => ({
      id: n.id, name: n.data.label, role: n.data.role, strength: n.data.strength, risk: n.data.risk,
    })),
    flows: edges.map((e) => ({ from: e.source, to: e.target, info: typeof e.label === "string" ? e.label : "情報" })),
  }), [nodes, edges]);

  const runSimulation = useCallback(async () => {
    const snap = snapshot();
    setLoading(true);
    try {
      const r = await simulate(snap, useApi);
      // Before/After 差分(前回シミュとの比較)
      if (prev.current) {
        const p = prev.current;
        const prevDepts = new Set(p.snapshot.departments.map((d) => d.name));
        const addedDepts = snap.departments.filter((d) => !prevDepts.has(d.name)).map((d) => d.name);
        const prevFlows = new Set(p.snapshot.flows.map((f) => `${f.from}>${f.to}:${f.info}`));
        const nameOf = (id: string) => snap.departments.find((d) => d.id === id)?.name ?? id;
        const addedFlows = snap.flows
          .filter((f) => !prevFlows.has(`${f.from}>${f.to}:${f.info}`))
          .map((f) => `${nameOf(f.from)}→${nameOf(f.to)}(${f.info})`);
        const scoreDeltas = SCORE_LABELS.map((s) => ({
          label: s.label, before: p.result.scores[s.key], after: r.scores[s.key], goodUp: s.goodUp,
        })).filter((d) => d.before !== d.after);
        const prevLoad = new Map(p.result.nodeMetrics.map((m) => [m.name, m.load]));
        const loadDeltas = r.nodeMetrics
          .filter((m) => prevLoad.has(m.name) && prevLoad.get(m.name) !== m.load)
          .map((m) => ({ name: m.name, before: prevLoad.get(m.name)!, after: m.load }));
        if (addedDepts.length || addedFlows.length || scoreDeltas.length || loadDeltas.length) {
          setChange({
            title: addedDepts.length ? `🆕 ${addedDepts.join("・")}を追加した影響` : "🔄 構造変更の影響",
            addedDepts, addedFlows, scoreDeltas, loadDeltas,
          });
        } else setChange(null);
      } else setChange(null);

      setResult(r);
      prev.current = { result: r, snapshot: snap };
    } finally {
      setLoading(false);
    }
  }, [snapshot, useApi]);

  // 入口/出口 と シミュ後のメーターをノードに反映
  const displayNodes = useMemo(() => {
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    nodes.forEach((n) => { inDeg.set(n.id, 0); outDeg.set(n.id, 0); });
    edges.forEach((e) => {
      if ((e.data as { kind?: string } | undefined)?.kind === "feedback") return;
      outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    });
    const metricById = new Map((result?.nodeMetrics ?? []).map((m) => [m.id, m]));
    return nodes.map((n) => {
      const m = metricById.get(n.id);
      return {
        ...n,
        data: {
          ...n.data,
          isStart: (inDeg.get(n.id) ?? 0) === 0 && (outDeg.get(n.id) ?? 0) > 0,
          isEnd: (outDeg.get(n.id) ?? 0) === 0 && (inDeg.get(n.id) ?? 0) > 0,
          isNew: n.id.startsWith("dept_"),
          ...(m ? { load: m.load, state: m.state, bottleneck: m.bottleneck, concentrated: m.concentrated } : {}),
        },
      };
    });
  }, [nodes, edges, result]);

  // クイックアクション: デザイン部を企画↔開発の間に追加
  const addDesign = useCallback(() => {
    if (nodes.some((n) => n.data.label === "デザイン部")) return;
    const id = `dept_design_${Date.now()}`;
    setNodes((nds) => [...nds, {
      id, type: "dept", position: { x: 460, y: 260 },
      data: { label: "デザイン部", role: "見た目と体験を整える", strength: "UI設計", risk: "装飾過多" },
    }]);
    setEdges((eds) => [
      ...eds,
      { id: `e_des_in_${Date.now()}`, source: "kikaku", target: id, sourceHandle: "out-r", targetHandle: "in-l", label: "デザイン要件", ...edgeStyle("plan") },
      { id: `e_des_out_${Date.now()}`, source: id, target: "kaihatsu", sourceHandle: "out-r", targetHandle: "in-l", label: "デザイン案", ...edgeStyle("release") },
    ]);
  }, [nodes, setNodes, setEdges]);

  // クイックアクション: 改善ループ(運用→企画)を追加
  const addFeedback = useCallback(() => {
    if (edges.some((e) => e.source === "unyo" && e.target === "kikaku")) return;
    setEdges((eds) => [...eds, {
      id: `e_fb_${Date.now()}`, source: "unyo", target: "kikaku", sourceHandle: "out-b", targetHandle: "in-t",
      label: "改善データ", ...edgeStyle("feedback"),
    }]);
  }, [edges, setEdges]);

  const detailNode = detailId ? nodes.find((n) => n.id === detailId) : null;
  const detailMetric = detailId ? result?.nodeMetrics.find((m) => m.id === detailId) : undefined;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>🧩 AIOrgSim</h1>
          <p>AI組織のワークフローを組み立て、構造変化の影響をシミュレートする設計ツール</p>
        </div>
        <div className="header-actions">
          <label className="api-toggle" title="ONにすると公開/vercel dev時はOpenAIで要約。未設定なら自動でモック。">
            <input type="checkbox" checked={useApi} onChange={(e) => setUseApi(e.target.checked)} />
            AIで分析(OpenAI)
          </label>
          <button className="btn primary sim-btn" onClick={runSimulation} disabled={loading}>
            {loading ? "分析中…" : "▶ この組織で1日をシミュレート"}
          </button>
        </div>
      </header>

      <div className={`layout${leftOpen ? "" : " left-collapsed"}`}>
        {leftOpen && (
          <AddDeptPanel
            nodes={nodes}
            setNodes={setNodes}
            setEdges={setEdges}
            onCollapse={() => setLeftOpen(false)}
          />
        )}
        <div className="canvas-wrap">
          {!leftOpen && (
            <button className="expand-left" onClick={() => setLeftOpen(true)} title="部署パネルを開く">
              ▶ 部署パネル
            </button>
          )}
          <OrgCanvas
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setEdges={setEdges}
            onNodeClick={setDetailId}
          />
          <Legend />
          {result && (
            <ResultPanel
              result={result}
              change={change}
              onClose={() => setResult(null)}
              onAddDesign={addDesign}
              onAddFeedback={addFeedback}
            />
          )}
          {detailNode && (
            <NodeDetail data={detailNode.data} metric={detailMetric} onClose={() => setDetailId(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
