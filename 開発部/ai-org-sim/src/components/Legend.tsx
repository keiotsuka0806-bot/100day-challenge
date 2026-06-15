import { FLOW_META, type FlowKind } from "../edgeDefaults";

// キャンバス左下の凡例。矢印の色 → 流れの種類、とSTART/GOALの説明。
const ORDER: FlowKind[] = ["plan", "quality", "release", "publish", "feedback"];

export default function Legend() {
  return (
    <div className="legend">
      <h4>矢印の色 = 流れの種類</h4>
      {ORDER.map((k) => (
        <div className="row" key={k}>
          <span
            className="swatch"
            style={{
              borderTopColor: FLOW_META[k].color,
              borderTopStyle: FLOW_META[k].dashed ? "dashed" : "solid",
            }}
          />
          <span>{FLOW_META[k].label}</span>
        </div>
      ))}
      <div className="legend-div" />
      <div className="row"><span className="dot start" /> <span>START(入口)</span></div>
      <div className="row"><span className="dot end" /> <span>GOAL(出口)</span></div>
    </div>
  );
}
