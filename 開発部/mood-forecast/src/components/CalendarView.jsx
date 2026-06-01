import { useState } from 'react'
import { formatMonthYear, getDaysInMonth, getFirstDayOfWeek } from '../utils/dateUtils'
import { getMoodInfo } from '../utils/moodUtils'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function CalendarView({ records, onSelectDate }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const todayStr = now.toISOString().slice(0, 10)
  const recordMap = Object.fromEntries(records.map(r => [r.date, r]))

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthRecords = records.filter(r => r.date.startsWith(
    `${year}-${String(month + 1).padStart(2, '0')}`
  ))
  const avgMood = monthRecords.length
    ? (monthRecords.reduce((s, r) => s + r.mood, 0) / monthRecords.length).toFixed(1)
    : null

  return (
    <div className="calendar-screen">
      <h1 className="screen-header">カレンダー</h1>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="cal-header">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <div>
            <div className="cal-month-label">{formatMonthYear(year, month)}</div>
            {avgMood !== null && (
              <div className="cal-avg">平均気分: {avgMood > 0 ? `+${avgMood}` : avgMood}</div>
            )}
          </div>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>

        <div className="cal-weekdays">
          {WEEKDAYS.map(d => (
            <div key={d} className="cal-weekday">{d}</div>
          ))}
        </div>

        <div className="cal-grid">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const mm = String(month + 1).padStart(2, '0')
            const dd = String(day).padStart(2, '0')
            const dateStr = `${year}-${mm}-${dd}`
            const record = recordMap[dateStr]
            const info = record ? getMoodInfo(record.mood) : null
            const isToday = dateStr === todayStr

            return (
              <button
                key={dateStr}
                className={`cal-day ${isToday ? 'today' : ''} ${record ? 'has-record' : ''}`}
                style={record ? { backgroundColor: info.color } : undefined}
                onClick={() => onSelectDate(dateStr)}
                title={record ? `${info.emoji} ${info.label}` : '記録を追加'}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="chart-title" style={{ marginBottom: 10 }}>気分の色凡例</div>
        <div className="legend-grid">
          {[-5, -3, -1, 0, 1, 3, 5].map(v => {
            const info = getMoodInfo(v)
            return (
              <div key={v} className="legend-item">
                <div className="legend-dot" style={{ backgroundColor: info.color }} />
                <span>{v > 0 ? `+${v}` : v} {info.emoji}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
