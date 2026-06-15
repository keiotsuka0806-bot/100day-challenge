import type { SimResult, OrgScores } from "../types";
import { grade } from "../sim/simulate";
import type { Recommendation } from "../sim/recommend";

export interface ChangeSummary {
  title: string;
  addedDepts: string[];
  addedFlows: string[];
  scoreDeltas: { label: string; before: number; after: number; goodUp: boolean }[];
  loadDeltas: { name: string; before: number; after: number }[];
}

interface Props {
  result: SimResult;
  change: ChangeSummary | null;
  recommendations: Recommendation[];
  onClose: () => void;
  onAddRecommended: (rec: Recommendation) => void;
}

const SCORE_DEFS: { key: keyof OrgScores; label: string; goodUp: boolean }[] = [
  { key: "speed", label: "速度", goodUp: true },
  { key: "quality", label: "品質", goodUp: true },
  { key: "lowRework", label: "手戻りの少なさ", goodUp: true },
  { key: "reach", label: "発信力", goodUp: true },
  { key: "keyManRisk", label: "属人化リスク", goodUp: false },
];

export default function ResultPanel({ result, change, recommendations, onClose, onAddRecommended }: Props) {
  return (
    <div className="result-overlay">
      <div className="result-head">
        <span className={`mode-badge ${result.mode}`}>
          {result.mode === "ai" ? "AI分析" : "モック分析(構造ベース)"}
        </span>
        <button className="close" onClick={onClose} title="閉じる">×</button>
      </div>

      {/* 変化サマリー(前回シミュとの差分) */}
      {change && (
        <div className="card change">
          <h3>{change.title}</h3>
          {!!change.addedDepts.length && <p className="sub">追加部署: {change.addedDepts.join("、")}</p>}
          {!!change.addedFlows.length && <p className="sub">追加フロー: {change.addedFlows.join("、")}</p>}
          {change.loadDeltas.map((d, i) => (
            <p key={i} className="delta">
              {d.name}の負荷: <b>{d.before}%</b> → <b>{d.after}%</b>{" "}
              <span className={d.after < d.before ? "up" : d.after > d.before ? "down" : ""}>
                {d.after < d.before ? "↓改善" : d.after > d.before ? "↑増加" : "→変化なし"}
              </span>
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <h3>組織全体</h3>
        <p className="sub">{result.flowSummary}</p>
      </div>

      {/* 組織スコア */}
      <div className="card">
        <h3>組織スコア</h3>
        {SCORE_DEFS.map((s) => {
          const v = result.scores[s.key];
          // 属人化リスクは低いほど良い → バーは「危険度」、色は反転
          const good = s.goodUp ? v : 100 - v;
          const cls = good >= 70 ? "ok" : good >= 45 ? "warn" : "bad";
          return (
            <div className="score-row" key={s.key}>
              <span className="score-label">{s.label}</span>
              <div className="bar"><div className={`fill ${cls}`} style={{ width: `${v}%` }} /></div>
              <span className="score-grade">{s.goodUp ? grade(v) : `${v}%`}</span>
            </div>
          );
        })}
      </div>

      {/* ボトルネック */}
      <div className="card">
        <h3>🚧 ボトルネック</h3>
        <ul>{result.bottlenecks.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>

      {/* 部署ごとの反応 */}
      <div className="card">
        <h3>🗣 部署ごとの反応</h3>
        <ul className="comments">
          {result.nodeMetrics.map((m, i) => (
            <li key={i}><b>{m.name}</b>: {m.comment}</li>
          ))}
        </ul>
      </div>

      {/* 次の一手 = おすすめ部署(詰まりを解消) */}
      <div className="card">
        <h3>💡 置くと楽になる部署</h3>
        {recommendations.length === 0 && (
          <p className="sub">大きな詰まりはなし。自由に部署を足して効果を試してみましょう。</p>
        )}
        {recommendations.map((r, i) => (
          <div className="reco" key={i}>
            <div className="reco-target">⚠️ {r.targetName}が詰まっています</div>
            <div className="reco-reason">{r.reason}</div>
            <div className="reco-name">{r.template.emoji} {r.template.name} を間に置くと…</div>
            <ul className="reco-effects">{r.effects.map((e, j) => <li key={j}>{e}</li>)}</ul>
            <div className="reco-side">副作用: {r.template.sideEffect}</div>
            <details className="reco-conns">
              <summary>追加される接続</summary>
              <ul>{r.connections.map((c, j) => <li key={j}>{c}</li>)}</ul>
            </details>
            <button className="btn primary small" onClick={() => onAddRecommended(r)}>
              {r.template.emoji} この部署を追加して試す
            </button>
          </div>
        ))}
      </div>

      {/* 補足ヒント */}
      {result.suggestions.length > 0 && (
        <div className="card">
          <h3>その他のヒント</h3>
          <ul>{result.suggestions.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
