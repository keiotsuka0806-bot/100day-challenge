import type { FlowKind } from "../edgeDefaults";

// 提案で追加できる部署のテンプレート。
// reduces: この部署を「つないで置く」と、どの部署の負荷が何ポイント下がるか(モデル上の効果)。
// wiring: つなぎ方。"$NEW" は追加される部署自身。相手が存在する接続だけが張られる。
export interface Wire {
  from: string; // dept id or "$NEW"
  to: string; // dept id or "$NEW"
  label: string;
  kind: FlowKind;
}

export interface DeptTemplate {
  id: string;
  emoji: string;
  name: string;
  role: string;
  strength: string;
  risk: string;
  sideEffect: string; // 副作用(定性)
  reduces: Record<string, number>; // 部署名 → 負荷軽減ポイント
  wiring: Wire[];
}

export const DEPT_TEMPLATES: DeptTemplate[] = [
  {
    id: "design", emoji: "🎨", name: "デザイン部",
    role: "UI/UX設計・体験整理", strength: "UI設計", risk: "装飾過多",
    sideEffect: "デザインレビュー待ちが発生しやすい",
    reduces: { "開発部": 18, "企画部": 8 },
    wiring: [
      { from: "kikaku", to: "$NEW", label: "要件・体験方針", kind: "plan" },
      { from: "$NEW", to: "kaihatsu", label: "UI設計・画面仕様", kind: "release" },
    ],
  },
  {
    id: "pm", emoji: "🗂", name: "PM部",
    role: "優先順位整理・進行管理・仕様調整", strength: "段取り", risk: "意思決定が一段増える",
    sideEffect: "判断ステップが一つ増える",
    reduces: { "企画部": 16, "開発部": 12 },
    wiring: [
      { from: "kikaku", to: "$NEW", label: "やりたいこと", kind: "plan" },
      { from: "$NEW", to: "kaihatsu", label: "整理済み仕様・優先順位", kind: "release" },
    ],
  },
  {
    id: "knowledge", emoji: "📚", name: "ナレッジ部",
    role: "ドキュメント化・ルール整備・再利用可能な知識化", strength: "知識整理", risk: "初期整備コスト",
    sideEffect: "最初の整備に手間がかかる",
    reduces: { "QA部": 14, "運用部": 12, "開発部": 10 },
    wiring: [
      { from: "qa", to: "$NEW", label: "検証ナレッジ", kind: "quality" },
      { from: "$NEW", to: "kaihatsu", label: "再利用できる知識", kind: "release" },
    ],
  },
  {
    id: "editorial", emoji: "✍️", name: "編集部",
    role: "発信素材の編集・文章化・物語化", strength: "編集", risk: "素材依存",
    sideEffect: "元素材の質に成果が左右される",
    reduces: { "広報部": 18, "企画部": 8 },
    wiring: [
      { from: "unyo", to: "$NEW", label: "素材・データ", kind: "publish" },
      { from: "$NEW", to: "koho", label: "編集済み素材", kind: "publish" },
    ],
  },
  {
    id: "cs", emoji: "🤝", name: "カスタマーサクセス部",
    role: "利用者の声を集め改善要望に変える", strength: "傾聴・橋渡し", risk: "要望が増えすぎる",
    sideEffect: "要望過多で優先順位づけが必要になる",
    reduces: { "運用部": 14, "企画部": 10 },
    wiring: [
      { from: "koho", to: "$NEW", label: "利用者接点", kind: "publish" },
      { from: "$NEW", to: "kikaku", label: "改善要望", kind: "feedback" },
    ],
  },
  {
    id: "research", emoji: "🔬", name: "リサーチ部",
    role: "市場調査・競合分析・技術調査", strength: "調査", risk: "調査過多で実行が遅れる",
    sideEffect: "調べすぎると実行が遅くなる",
    reduces: { "企画部": 16 },
    wiring: [
      { from: "kikaku", to: "$NEW", label: "調査依頼", kind: "plan" },
      { from: "$NEW", to: "kikaku", label: "調査結果", kind: "feedback" },
    ],
  },
  {
    id: "automation", emoji: "⚙️", name: "自動化部",
    role: "繰り返し作業の自動化・ツール化", strength: "自動化", risk: "初期開発コスト",
    sideEffect: "作るまでに初期コストがかかる",
    reduces: { "運用部": 16, "QA部": 12, "開発部": 10 },
    wiring: [
      { from: "unyo", to: "$NEW", label: "繰り返し作業", kind: "release" },
      { from: "$NEW", to: "unyo", label: "自動化ツール", kind: "feedback" },
      { from: "$NEW", to: "qa", label: "自動チェック", kind: "quality" },
    ],
  },
];

export const TEMPLATE_BY_ID = new Map(DEPT_TEMPLATES.map((t) => [t.id, t]));
export const TEMPLATE_BY_NAME = new Map(DEPT_TEMPLATES.map((t) => [t.name, t]));

// テンプレートのwiringを、追加IDと既存ノードに合わせて解決(相手が居る接続だけ残す)。
export function resolveWires(t: DeptTemplate, newId: string, existingIds: Set<string>): Wire[] {
  return t.wiring
    .map((w) => ({
      from: w.from === "$NEW" ? newId : w.from,
      to: w.to === "$NEW" ? newId : w.to,
      label: w.label,
      kind: w.kind,
    }))
    .filter((w) => (w.from === newId || existingIds.has(w.from)) && (w.to === newId || existingIds.has(w.to)));
}
