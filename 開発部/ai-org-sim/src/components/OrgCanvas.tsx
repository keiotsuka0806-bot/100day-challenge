import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import DeptNode from "./DeptNode";
import type { DeptData } from "../types";

interface Props {
  nodes: Node<DeptData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<DeptData>>;
  onEdgesChange: OnEdgesChange;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

// 中央の組織図キャンバス。ドラッグ移動・ハンドル同士をつないで接続追加できる。
export default function OrgCanvas({ nodes, edges, onNodesChange, onEdgesChange, setEdges }: Props) {
  const nodeTypes = useMemo(() => ({ dept: DeptNode }), []);

  const onConnect = useCallback(
    (params: Connection) => {
      const info = window.prompt("この線で流れる情報の名前は?(例: 仕様、不具合報告、改善データ)", "情報");
      if (info === null) return; // キャンセル
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            label: info || "情報",
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
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
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
