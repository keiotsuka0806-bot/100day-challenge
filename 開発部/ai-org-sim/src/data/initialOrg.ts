import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { DeptData } from "../types";

// #100Day Challenge の初期5部署をノードとして配置。
export const initialNodes: Node<DeptData>[] = [
  {
    id: "kikaku",
    type: "dept",
    position: { x: 40, y: 40 },
    data: {
      label: "企画部",
      role: "アイデアを出し、プロジェクトの方向性を決める",
      strength: "発想・企画",
      risk: "独自性のなさ",
    },
  },
  {
    id: "kaihatsu",
    type: "dept",
    position: { x: 340, y: 40 },
    data: {
      label: "開発部",
      role: "企画を実際のプロダクトにする",
      strength: "実装",
      risk: "実装コスト・速度",
    },
  },
  {
    id: "qa",
    type: "dept",
    position: { x: 340, y: 240 },
    data: {
      label: "QA部",
      role: "問題点・矛盾・品質リスクを指摘する",
      strength: "品質・検証",
      risk: "見落とし・手戻り",
    },
  },
  {
    id: "unyo",
    type: "dept",
    position: { x: 640, y: 140 },
    data: {
      label: "運用部",
      role: "継続運用・改善・データ管理を担当する",
      strength: "運用・データ",
      risk: "属人化・抜け漏れ",
    },
  },
  {
    id: "koho",
    type: "dept",
    position: { x: 940, y: 140 },
    data: {
      label: "広報部",
      role: "成果物を外部向けに発信する",
      strength: "発信・物語化",
      risk: "届かない・燃える",
    },
  },
];

const edge = (id: string, source: string, target: string, label: string): Edge => ({
  id,
  source,
  target,
  label,
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed },
});

// 初期の情報フロー。矢印に「流れている情報名」を載せる。
export const initialEdges: Edge[] = [
  edge("e1", "kikaku", "kaihatsu", "企画案"),
  edge("e2", "kaihatsu", "qa", "仕様・成果物"),
  edge("e3", "qa", "kaihatsu", "不具合報告"),
  edge("e4", "kaihatsu", "unyo", "リリース物"),
  edge("e5", "unyo", "kikaku", "改善データ"),
  edge("e6", "unyo", "koho", "発信用素材"),
];
