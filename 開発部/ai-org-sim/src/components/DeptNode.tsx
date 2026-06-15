import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DeptData, DeptState } from "../types";

const STATE_LABEL: Record<DeptState, string> = { normal: "正常", caution: "注意", danger: "危険" };

// 組織図上の部署カード(=ノード)。シミュレート後は負荷メーター・状態色・⚠️を表示。
export default function DeptNode({ data, selected }: NodeProps) {
  const d = data as DeptData & {
    isStart?: boolean; isEnd?: boolean; isNew?: boolean;
    load?: number; state?: DeptState; bottleneck?: string; concentrated?: boolean;
  };
  const hasMetric = typeof d.load === "number";
  const cls =
    "dept-node" +
    (selected ? " selected" : "") +
    (d.isStart ? " start" : "") +
    (d.isEnd ? " end" : "") +
    (d.isNew ? " is-new" : "") +
    (hasMetric ? ` st-${d.state}` : "") +
    (d.bottleneck === "high" ? " bottleneck" : "");

  return (
    <div className={cls}>
      <Handle id="in-l" type="target" position={Position.Left} />
      <Handle id="in-t" type="target" position={Position.Top} />

      {d.isStart && <div className="flow-badge start">▶ START(入口)</div>}
      {d.isEnd && <div className="flow-badge end">■ GOAL(出口)</div>}

      <div className="dept-head">
        <span className="dept-name">{d.label}</span>
        {d.bottleneck === "high" && <span className="warn" title="ボトルネック">⚠️</span>}
        {d.concentrated && <span className="concentrate">集中</span>}
      </div>
      <div className="dept-role">{d.role}</div>

      {hasMetric && (
        <div className="meter">
          <div className="meter-top">
            <span>負荷 {d.load}%</span>
            <span className={`state-pill st-${d.state}`}>{STATE_LABEL[d.state ?? "normal"]}</span>
          </div>
          <div className="bar"><div className={`fill st-${d.state}`} style={{ width: `${d.load}%` }} /></div>
        </div>
      )}

      <div className="dept-meta">
        {d.strength && <span className="tag good">得意: {d.strength}</span>}
        {d.risk && <span className="tag risk">注意: {d.risk}</span>}
      </div>

      <Handle id="out-r" type="source" position={Position.Right} />
      <Handle id="out-b" type="source" position={Position.Bottom} />
    </div>
  );
}
