import { MarkerType } from "@xyflow/react";

// 流れの種類と色。矢印はこの色で塗り分ける。
export type FlowKind = "plan" | "quality" | "release" | "publish" | "feedback" | "default";

export const FLOW_META: Record<FlowKind, { color: string; label: string; dashed?: boolean }> = {
  plan: { color: "#5b8def", label: "計画・企画" },
  quality: { color: "#e0655b", label: "品質(検証・不具合)" },
  release: { color: "#a78bfa", label: "リリース・供給" },
  publish: { color: "#4ec38a", label: "発信" },
  feedback: { color: "#e0a44a", label: "改善ループ", dashed: true },
  default: { color: "#8aa0d6", label: "その他" },
};

// 種類に応じた矢印の見た目(太め・矢じり大きめ・ラベル背景付き)。
export function edgeStyle(kind: FlowKind = "default") {
  const m = FLOW_META[kind];
  return {
    type: "smoothstep" as const,
    animated: true,
    style: {
      strokeWidth: 3,
      stroke: m.color,
      ...(m.dashed ? { strokeDasharray: "7 5" } : {}),
    },
    markerEnd: { type: MarkerType.ArrowClosed, width: 26, height: 26, color: m.color },
    labelStyle: { fill: "#e9eef6", fontSize: 13, fontWeight: 700 },
    labelBgStyle: { fill: "#0e1726", fillOpacity: 0.95, stroke: m.color },
    labelBgPadding: [7, 5] as [number, number],
    labelBgBorderRadius: 6,
    data: { kind },
  };
}
