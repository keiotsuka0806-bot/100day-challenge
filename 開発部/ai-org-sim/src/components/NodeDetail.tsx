import type { DeptData, NodeMetric, DeptState } from "../types";

const STATE_LABEL: Record<DeptState, string> = { normal: "正常", caution: "注意", danger: "危険" };

interface Props {
  data: DeptData;
  metric?: NodeMetric;
  onClose: () => void;
}

// ノードクリックで開く部署詳細モーダル。
export default function NodeDetail({ data, metric, onClose }: Props) {
  return (
    <div className="detail-backdrop" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <h3>{data.label}</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>
        <Row label="役割" value={data.role} />
        <Row label="得意なこと" value={data.strength || "-"} />
        <Row label="気にするリスク" value={data.risk || "-"} />
        {metric && (
          <>
            <Row label="入ってくる情報" value={metric.inInfos.length ? metric.inInfos.join("、") : "なし"} />
            <Row label="出している情報" value={metric.outInfos.length ? metric.outInfos.join("、") : "なし"} />
            <div className="detail-meter">
              <div className="meter-top">
                <span>負荷 {metric.load}%</span>
                <span className={`state-pill st-${metric.state}`}>{STATE_LABEL[metric.state]}</span>
              </div>
              <div className="bar"><div className={`fill st-${metric.state}`} style={{ width: `${metric.load}%` }} /></div>
              <p className="reason">{metric.reason}</p>
            </div>
            <div className="detail-comment">🗣 {metric.comment}</div>
          </>
        )}
        {!metric && <p className="sub">「シミュレート」を押すと、負荷や状態の詳細が表示されます。</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
