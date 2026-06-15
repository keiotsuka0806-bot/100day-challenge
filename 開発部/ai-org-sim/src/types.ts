// AIOrgSim のドメイン型。部署=ノード、情報の流れ=エッジ。

export interface DeptData {
  // React Flow のノードdataに載せる
  label: string; // 部署名
  role: string; // 役割
  strength?: string; // 得意なこと
  risk?: string; // 気にするリスク
  [key: string]: unknown;
}

export interface SimResult {
  flowSummary: string; // 組織全体の変化 / 情報フローの要約
  improvements: string[]; // 良くなる点
  risks: string[]; // 悪化しそうな点
  bottlenecks: string[]; // ボトルネック
  deptComments: { dept: string; comment: string }[]; // 各部署の反応
  suggestions: string[]; // 改善提案(次に変えるべき接続/部署)
  mode: "mock" | "ai"; // どちらで生成したか
}

// シミュレーション入力(グラフのスナップショット)
export interface GraphSnapshot {
  departments: {
    id: string;
    name: string;
    role: string;
    strength?: string;
    risk?: string;
  }[];
  flows: { from: string; to: string; info: string }[];
}
