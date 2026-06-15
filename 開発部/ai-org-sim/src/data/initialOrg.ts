import type { Node, Edge } from "@xyflow/react";
import type { DeptData } from "../types";
import { edgeVisual } from "../edgeDefaults";

// #100Day Challenge の初期5部署。横の流れを中心に、QAは開発の下、改善ループは下回り。
export const initialNodes: Node<DeptData>[] = [
  {
    id: "kikaku",
    type: "dept",
    position: { x: 40, y: 220 },
    data: { label: "企画部", role: "アイデアを出し、プロジェクトの方向性を決める", strength: "発想・企画", risk: "独自性のなさ" },
  },
  {
    id: "kaihatsu",
    type: "dept",
    position: { x: 460, y: 60 },
    data: { label: "開発部", role: "企画を実際のプロダクトにする", strength: "実装", risk: "実装コスト・速度" },
  },
  {
    id: "qa",
    type: "dept",
    position: { x: 460, y: 460 },
    data: { label: "QA部", role: "問題点・矛盾・品質リスクを指摘する", strength: "品質・検証", risk: "見落とし・手戻り" },
  },
  {
    id: "unyo",
    type: "dept",
    position: { x: 920, y: 220 },
    data: { label: "運用部", role: "継続運用・改善・データ管理を担当する", strength: "運用・データ", risk: "属人化・抜け漏れ" },
  },
  {
    id: "koho",
    type: "dept",
    position: { x: 1380, y: 220 },
    data: { label: "広報部", role: "成果物を外部向けに発信する", strength: "発信・物語化", risk: "届かない・燃える" },
  },
];

const edge = (
  id: string,
  source: string,
  target: string,
  label: string,
  sourceHandle: string,
  targetHandle: string
): Edge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  label,
  ...edgeVisual,
});

// 横=左右 / 縦=上下 / 戻り=下回り、で線が重ならないよう接続点を指定。
export const initialEdges: Edge[] = [
  edge("e1", "kikaku", "kaihatsu", "企画案", "out-r", "in-l"),
  edge("e2", "kaihatsu", "qa", "仕様・成果物", "out-b", "in-t"),
  edge("e3", "qa", "kaihatsu", "不具合報告", "out-r", "in-t"),
  edge("e4", "kaihatsu", "unyo", "リリース物", "out-r", "in-l"),
  edge("e5", "unyo", "kikaku", "改善データ", "out-b", "in-t"),
  edge("e6", "unyo", "koho", "発信用素材", "out-r", "in-l"),
];
