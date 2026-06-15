import type { SimResult } from "../types";

interface Props {
  result: SimResult;
  onClose: () => void;
}

// 結果は中央キャンバスの上に浮かぶオーバーレイ。閉じれば図が全幅に戻る。
export default function ResultPanel({ result, onClose }: Props) {
  return (
    <div className="result-overlay">
      <div className="result-head">
        <span className={`mode-badge ${result.mode}`}>
          {result.mode === "ai" ? "AI分析" : "モック分析(構造ベース)"}
        </span>
        <button className="close" onClick={onClose} title="閉じる">×</button>
      </div>

      <Section title="組織全体の変化 / 情報フローの要約">
        <p>{result.flowSummary}</p>
      </Section>
      <Section title="✅ 良くなる点"><List items={result.improvements} /></Section>
      <Section title="⚠️ 悪化しそうな点"><List items={result.risks} /></Section>
      <Section title="🚧 ボトルネック"><List items={result.bottlenecks} /></Section>
      <Section title="🗣 各部署の反応">
        <ul className="comments">
          {result.deptComments.map((c, i) => (
            <li key={i}><b>{c.dept}</b>: {c.comment}</li>
          ))}
        </ul>
      </Section>
      <Section title="💡 改善提案(次に変えるべき接続/部署)">
        <List items={result.suggestions} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}
