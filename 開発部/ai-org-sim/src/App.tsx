import { useCallback, useState } from "react";
import { useNodesState, useEdgesState, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import OrgCanvas from "./components/OrgCanvas";
import AddDeptPanel from "./components/AddDeptPanel";
import ResultPanel from "./components/ResultPanel";
import { initialNodes, initialEdges } from "./data/initialOrg";
import { simulate } from "./sim/simulate";
import type { DeptData, GraphSnapshot, SimResult } from "./types";

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DeptData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [useApi, setUseApi] = useState(false);

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
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setEdges={setEdges}
          />
          {result && <ResultPanel result={result} onClose={() => setResult(null)} />}
        </div>
      </div>
    </div>
  );
}
