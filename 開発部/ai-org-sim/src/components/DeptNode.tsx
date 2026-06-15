import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DeptData } from "../types";

// 組織図上の部署カード(=ノード)。左右にハンドル(接続点)を持つ。
export default function DeptNode({ data, selected }: NodeProps) {
  const d = data as DeptData;
  return (
    <div className={`dept-node${selected ? " selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="dept-name">{d.label}</div>
      <div className="dept-role">{d.role}</div>
      <div className="dept-meta">
        {d.strength && <span className="tag good">得意: {d.strength}</span>}
        {d.risk && <span className="tag risk">注意: {d.risk}</span>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
