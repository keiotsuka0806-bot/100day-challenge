import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DeptData } from "../types";

// 組織図上の部署カード(=ノード)。
// 流れを整理するため「入口=左/上(target)」「出口=右/下(source)」に接続点を置く。
export default function DeptNode({ data, selected }: NodeProps) {
  const d = data as DeptData;
  return (
    <div className={`dept-node${selected ? " selected" : ""}`}>
      <Handle id="in-l" type="target" position={Position.Left} />
      <Handle id="in-t" type="target" position={Position.Top} />

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
