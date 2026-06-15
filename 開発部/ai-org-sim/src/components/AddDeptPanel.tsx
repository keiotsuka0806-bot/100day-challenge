import { useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { DeptData } from "../types";

interface Props {
  nodes: Node<DeptData>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<DeptData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

// 左パネル: 部署の追加・削除と、接続の追加。
export default function AddDeptPanel({ nodes, setNodes, setEdges }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [strength, setStrength] = useState("");
  const [risk, setRisk] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [info, setInfo] = useState("");

  const addDept = () => {
    if (!name.trim()) return;
    const id = `dept_${Date.now()}`;
    const offset = nodes.length * 24;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "dept",
        position: { x: 120 + offset, y: 380 + offset },
        data: { label: name.trim(), role: role.trim(), strength: strength.trim(), risk: risk.trim() },
      },
    ]);
    setName(""); setRole(""); setStrength(""); setRisk("");
  };

  const removeDept = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const addConnection = () => {
    if (!from || !to || from === to) return;
    setEdges((eds) => [
      ...eds,
      {
        id: `e_${from}_${to}_${Date.now()}`,
        source: from,
        target: to,
        sourceHandle: "out-r",
        targetHandle: "in-l",
        label: info.trim() || "情報",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ]);
    setInfo("");
  };

  return (
    <div className="panel left">
      <h2>部署を追加</h2>
      <div className="field"><label>部署名</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: デザイン部" /></div>
      <div className="field"><label>役割</label>
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="例: 見た目と体験を整える" /></div>
      <div className="field"><label>得意なこと</label>
        <input value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="例: UI設計" /></div>
      <div className="field"><label>気にするリスク</label>
        <input value={risk} onChange={(e) => setRisk(e.target.value)} placeholder="例: 装飾過多" /></div>
      <button className="btn primary" onClick={addDept}>＋ この部署を追加</button>

      <h2>接続を追加</h2>
      <p className="hint">中央の図で点と点をドラッグしてもつなげます。</p>
      <div className="field"><label>From(出す側)</label>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">選択</option>
          {nodes.map((n) => <option key={n.id} value={n.id}>{n.data.label}</option>)}
        </select></div>
      <div className="field"><label>To(受ける側)</label>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">選択</option>
          {nodes.map((n) => <option key={n.id} value={n.id}>{n.data.label}</option>)}
        </select></div>
      <div className="field"><label>流れる情報</label>
        <input value={info} onChange={(e) => setInfo(e.target.value)} placeholder="例: デザイン案" /></div>
      <button className="btn" onClick={addConnection}>→ 接続を追加</button>

      <h2>部署一覧</h2>
      <ul className="dept-list">
        {nodes.map((n) => (
          <li key={n.id}>
            <span>{n.data.label}</span>
            <button className="del" onClick={() => removeDept(n.id)} title="削除">×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
