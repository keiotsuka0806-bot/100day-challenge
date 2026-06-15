import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DeptData } from "../types";

// 組織図上の部署カード(=ノード)。
// 入口=左/上(target)、出口=右/下(source)。入口が無い=START、出口が無い=END。
export default function DeptNode({ data, selected }: NodeProps) {
  const d = data as DeptData & { isStart?: boolean; isEnd?: boolean };
  const cls =
    "dept-node" +
    (selected ? " selected" : "") +
    (d.isStart ? " start" : "") +
    (d.isEnd ? " end" : "");
  return (
    <div className={cls}>
      <Handle id="in-l" type="target" position={Position.Left} />
      <Handle id="in-t" type="target" position={Position.Top} />

      {d.isStart && <div className="flow-badge start">▶ START(入口)</div>}
      {d.isEnd && <div className="flow-badge end">■ GOAL(出口)</div>}

      <div className="dept-name">{d.label}</div>
      <div className="dept-role">{d.role}</div>
      <div className="dept-meta">
        {d.strength && <span className="tag good">得意: {d.strength}</span>}
        {d.risk && <span className="tag risk">注意: {d.risk}</span>}
      </div>

      <Handle id="out-r" type="source" position={Position.Right} />
      <Handle id="out-b" type="source" position={Position.Bottom} />
    </div>
  );
}
