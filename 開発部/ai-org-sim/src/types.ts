// AIOrgSim のドメイン型。部署=ノード、情報の流れ=エッジ。

export interface DeptData {
  label: string; // 部署名
  role: string; // 役割
  strength?: string; // 得意なこと
  risk?: string; // 気にするリスク
  [key: string]: unknown;
}

export type DeptState = "normal" | "caution" | "danger";
export type BottleneckLevel = "low" | "mid" | "high";

// 1部署の状態メーター(中央の図とノード詳細で使う)
export interface NodeMetric {
  id: string;
  name: string;
  load: number; // 負荷 0〜100
  bottleneck: BottleneckLevel; // ボトルネック度
  state: DeptState; // 正常/注意/危険
  reason: string; // その状態の理由
  concentrated: boolean; // 入力が集中しているか
  inInfos: string[]; // 入ってくる情報
  outInfos: string[]; // 出している情報
  comment: string; // AI部署としての一言
}

// 組織スコア(0〜100)。keyManRiskだけ高いほど悪い。
export interface OrgScores {
  speed: number; // 速度
  quality: number; // 品質
  lowRework: number; // 手戻りの少なさ
  reach: number; // 発信力
  keyManRisk: number; // 属人化リスク(高いほど悪い)
}

export interface SimResult {
  flowSummary: string;
  nodeMetrics: NodeMetric[];
  scores: OrgScores;
  bottlenecks: string[];
  suggestions: string[];
  mode: "mock" | "ai";
}

export interface GraphSnapshot {
  departments: { id: string; name: string; role: string; strength?: string; risk?: string }[];
  flows: { from: string; to: string; info: string }[];
}
