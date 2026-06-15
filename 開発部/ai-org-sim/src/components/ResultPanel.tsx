import type { SimResult } from "../types";

interface Props {
  result: SimResult | null;
  loading: boolean;
  useApi: boolean;
  setUseApi: (v: boolean) => void;
  onSimulate: () => void;
}

// 右パネル: シミュレーション実行と結果表示。
export default function ResultPanel({ result, loading, useApi, setUseApi, onSimulate }: Props) {
  return (
    <div className="panel right">
      <h2>シミュレーション</h2>
      <button className="btn primary big" onClick={onSimulate} disabled={loading}>
        {loading ? "分析中…" : "▶ この組織で1日をシミュレート"}
      </button>
      <label className="api-toggle">
        <input type="checkbox" checked={useApi} onChange={(e) => setUseApi(e.target.checked)} />
        AIで分析(公開/vercel dev時のみ。未設定でも自動でモックに戻ります)
      </label>

      {!result && !loading && (
        <p className="empty">部署と矢印を編集して、ボタンを押すと結果が出ます。</p>
      )}

      {result && (
        <div className="result">
          <span className={`mode-badge ${result.mode}`}>
            {result.mode === "ai" ? "AI分析" : "モック分析(構造ベース)"}
          </span>

          <Section title="組織全体の変化 / 情報フローの要約">
            <p>{result.flowSummary}</p>
          </Section>
          <Section title="✅ 良くなる点">
            <List items={result.improvements} />
          </Section>
          <Section title="⚠️ 悪化しそうな点">
            <List items={result.risks} />
          </Section>
          <Section title="🚧 ボトルネック">
            <List items={result.bottlenecks} />
          </Section>
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
      )}
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
  return (
    <ul>
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}
