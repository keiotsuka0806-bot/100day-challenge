import { MarkerType } from "@xyflow/react";

// 矢印(エッジ)の共通見た目。太め・矢じり大きめ・ラベルは背景付きで読みやすく。
export const EDGE_COLOR = "#8aa0d6";

export const edgeVisual = {
  type: "smoothstep" as const,
  style: { strokeWidth: 3, stroke: EDGE_COLOR },
  markerEnd: { type: MarkerType.ArrowClosed, width: 26, height: 26, color: EDGE_COLOR },
  labelStyle: { fill: "#e9eef6", fontSize: 13, fontWeight: 700 },
  labelBgStyle: { fill: "#0e1726", fillOpacity: 0.95, stroke: "#2a3647" },
  labelBgPadding: [7, 5] as [number, number],
  labelBgBorderRadius: 6,
};
