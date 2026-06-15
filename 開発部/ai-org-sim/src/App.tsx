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
import { recommend, type Recommendation } from "./sim/recommend";
import { resolveWires } from "./data/deptLibrary";
import { edgeStyle } from "./edgeDefaults";
import type { DeptData, GraphSnapshot, SimResult } from "./types";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

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

  const toSnapshot = (ns: RFNode<DeptData>[], es: RFEdge[]): GraphSnapshot => ({
    departments: ns.map((n) => ({
      id: n.id, name: n.data.label, role: n.data.role, strength: n.data.strength, risk: n.data.risk,
    })),
    flows: es.map((e) => ({ from: e.source, to: e.target, info: typeof e.label === "string" ? e.label : "情報" })),
  });

  // スナップショットを受け取り、シミュレート→Before/After差分→状態更新まで行う共通処理。
  const simulateSnapshot = useCallback(async (snap: GraphSnapshot) => {
    setLoading(true);
    try {
      const r = await simulate(snap, useApi);
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
  }, [useApi]);

  const runSimulation = useCallback(
    () => simulateSnapshot(toSnapshot(nodes, edges)),
    [simulateSnapshot, nodes, edges]
  );

  // 今の組織から「おすすめ部署」を算出(シミュ済みのときだけ)
  const recommendations: Recommendation[] = useMemo(
    () => (result ? recommend(toSnapshot(nodes, edges), result) : []),
    [result, nodes, edges]
  );

  // おすすめ部署をワンクリック追加 → 即・再シミュレーション
  const addRecommended = useCallback((rec: Recommendation) => {
    const newId = `dept_${rec.template.id}_${Date.now()}`;
    const existing = new Set(nodes.map((n) => n.id));
    const wires = resolveWires(rec.template, newId, existing);
    const newNode: RFNode<DeptData> = {
      id: newId, type: "dept", position: { x: 470, y: 300 + nodes.length * 8 },
      data: { label: rec.template.name, role: rec.template.role, strength: rec.template.strength, risk: rec.template.risk },
    };
    const newEdges: RFEdge[] = wires.map((w, i) => ({
      id: `e_${newId}_${i}`, source: w.from, target: w.to,
      sourceHandle: "out-r", targetHandle: "in-l", label: w.label, ...edgeStyle(w.kind),
    }));
    const nextNodes = [...nodes, newNode];
    const nextEdges = [...edges, ...newEdges];
    setNodes(nextNodes);
    setEdges(nextEdges);
    simulateSnapshot(toSnapshot(nextNodes, nextEdges)); // 追加直後の状態で再シミュ
  }, [nodes, edges, setNodes, setEdges, simulateSnapshot]);

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
              recommendations={recommendations}
              onClose={() => setResult(null)}
              onAddRecommended={addRecommended}
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
