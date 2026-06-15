import { useCallback, useMemo, useState } from "react";
import { useNodesState, useEdgesState, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import OrgCanvas from "./components/OrgCanvas";
import AddDeptPanel from "./components/AddDeptPanel";
import ResultPanel from "./components/ResultPanel";
import Legend from "./components/Legend";
import { initialNodes, initialEdges } from "./data/initialOrg";
import { simulate } from "./sim/simulate";
import type { DeptData, GraphSnapshot, SimResult } from "./types";

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DeptData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [useApi, setUseApi] = useState(false);

  // START(入口=入ってくる流れが無い) / GOAL(出口=出ていく流れが無い)を構造から算出。
  const displayNodes = useMemo(() => {
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    nodes.forEach((n) => { inDeg.set(n.id, 0); outDeg.set(n.id, 0); });
    // 「改善ループ(feedback)」は前工程への戻りなので、入口/出口の判定からは除外する。
    edges.forEach((e) => {
      if ((e.data as { kind?: string } | undefined)?.kind === "feedback") return;
      outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    });
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isStart: (inDeg.get(n.id) ?? 0) === 0 && (outDeg.get(n.id) ?? 0) > 0,
        isEnd: (outDeg.get(n.id) ?? 0) === 0 && (inDeg.get(n.id) ?? 0) > 0,
      },
    }));
  }, [nodes, edges]);

  const runSimulation = useCallback(async () => {
    const snapshot: GraphSnapshot = {
      departments: nodes.map((n) => ({
        id: n.id,
        name: n.data.label,
        role: n.data.role,
        strength: n.data.strength,
        risk: n.data.risk,
      })),
      flows: edges.map((e) => ({
        from: e.source,
        to: e.target,
        info: typeof e.label === "string" ? e.label : "情報",
      })),
    };
    setLoading(true);
    try {
      setResult(await simulate(snapshot, useApi));
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, useApi]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>🧩 AIOrgSim</h1>
          <p>AI組織のワークフローを組み立て、構造変化の影響をシミュレートする設計ツール</p>
        </div>
        <div className="header-actions">
          <label className="api-toggle" title="ONにすると公開/vercel dev時はOpenAIで分析。未設定なら自動でモック。">
            <input type="checkbox" checked={useApi} onChange={(e) => setUseApi(e.target.checked)} />
            AIで分析
          </label>
          <button className="btn primary sim-btn" onClick={runSimulation} disabled={loading}>
            {loading ? "分析中…" : "▶ この組織で1日をシミュレート"}
          </button>
        </div>
      </header>

      <div className="layout">
        <AddDeptPanel nodes={nodes} setNodes={setNodes} setEdges={setEdges} />
        <div className="canvas-wrap">
          <OrgCanvas
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setEdges={setEdges}
          />
          <Legend />
          {result && <ResultPanel result={result} onClose={() => setResult(null)} />}
        </div>
      </div>
    </div>
  );
}
