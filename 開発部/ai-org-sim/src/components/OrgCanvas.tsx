import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import DeptNode from "./DeptNode";
import type { DeptData } from "../types";
import { edgeStyle, FLOW_META } from "../edgeDefaults";

interface Props {
  nodes: Node<DeptData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<DeptData>>;
  onEdgesChange: OnEdgesChange;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodeClick: (id: string) => void;
}

// 中央の組織図キャンバス。ドラッグ移動・ハンドル同士をつないで接続追加できる。
export default function OrgCanvas({ nodes, edges, onNodesChange, onEdgesChange, setEdges, onNodeClick }: Props) {
  const nodeTypes = useMemo(() => ({ dept: DeptNode }), []);

  const onConnect = useCallback(
    (params: Connection) => {
      const info = window.prompt("この線で流れる情報の名前は?(例: 仕様、不具合報告、改善データ)", "情報");
      if (info === null) return; // キャンセル
      setEdges((eds) =>
        addEdge({ ...params, label: info || "情報", ...edgeStyle("default") }, eds)
      );
    },
    [setEdges]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, node) => onNodeClick(node.id)}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={edgeStyle("default")}
      connectionLineStyle={{ strokeWidth: 3, stroke: FLOW_META.default.color }}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
