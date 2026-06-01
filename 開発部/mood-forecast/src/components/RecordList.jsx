import { formatDisplay } from '../utils/dateUtils'
import { getMoodInfo } from '../utils/moodUtils'

export default function RecordList({ records, onDelete, onSelectDate }) {
  if (records.length === 0) {
    return (
      <div className="list-screen">
        <h1 className="screen-header">記録一覧</h1>
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>まだ記録がありません</p>
        </div>
      </div>
    )
  }

  function handleDelete(e, id) {
    e.stopPropagation()
    if (window.confirm('この記録を削除しますか？')) {
      onDelete(id)
    }
  }

  return (
    <div className="list-screen">
      <h1 className="screen-header">
        記録一覧
        <span className="record-count">{records.length}件</span>
      </h1>

      {records.map(r => {
        const info = getMoodInfo(r.mood)
        return (
          <div
            key={r.id}
            className="record-item"
            onClick={() => onSelectDate(r.date)}
            role="button"
            tabIndex={0}
          >
            <div
              className="record-mood-dot"
              style={{ backgroundColor: `${info.color}28` }}
            >
              {info.emoji}
            </div>

            <div className="record-body">
              <div className="record-date">{formatDisplay(r.date)}</div>
              <div className="record-stats">
                <span className="record-stat" style={{ color: info.color, fontWeight: 600 }}>
                  {r.mood > 0 ? `+${r.mood}` : r.mood} {info.label}
                </span>
                <span className="record-stat">🌙 {r.sleepHours}h</span>
                <span className="record-stat">⭐ 質{r.sleepQuality}</span>
                <span className="record-stat">⚡ ストレス{r.stress}</span>
              </div>
              {r.memo && (
                <div className="record-memo">{r.memo}</div>
              )}
            </div>

            <button
              className="record-delete"
              onClick={e => handleDelete(e, r.id)}
              title="削除"
              aria-label="削除"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
