import { useState, useEffect } from 'react'
import { today, formatDisplay } from '../utils/dateUtils'
import { getMoodInfo } from '../utils/moodUtils'

export default function MoodForm({ date, setDate, getByDate, onSave }) {
  const [mood, setMood] = useState(0)
  const [sleepHours, setSleepHours] = useState(7)
  const [sleepQuality, setSleepQuality] = useState(3)
  const [stress, setStress] = useState(3)
  const [memo, setMemo] = useState('')
  const [savedDate, setSavedDate] = useState(null)

  useEffect(() => {
    const record = getByDate(date)
    if (record) {
      setMood(record.mood)
      setSleepHours(record.sleepHours)
      setSleepQuality(record.sleepQuality)
      setStress(record.stress)
      setMemo(record.memo)
    } else {
      setMood(0)
      setSleepHours(7)
      setSleepQuality(3)
      setStress(3)
      setMemo('')
    }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    const existing = getByDate(date)
    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      date,
      mood,
      sleepHours,
      sleepQuality,
      stress,
      memo,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    })
    setSavedDate(date)
    setTimeout(() => setSavedDate(null), 2000)
  }

  const info = getMoodInfo(mood)
  const isEditing = !!getByDate(date)
  const justSaved = savedDate === date

  const moodGradient = 'linear-gradient(to right, #ef4444, #f97316, #fbbf24, #94a3b8, #a3e635, #4ade80, #16a34a)'

  return (
    <div className="form-screen">
      <h1 className="screen-header">今日の記録</h1>

      <div className="form-group">
        <label className="form-label">日付</label>
        <input
          type="date"
          className="date-input"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        {isEditing && !justSaved && (
          <p className="edit-hint">✏️ この日の記録を編集中</p>
        )}
        {justSaved && (
          <p className="save-hint">✅ 保存しました！</p>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">気分スコア</label>
        <div className="mood-display">
          <div className="mood-emoji">{info.emoji}</div>
          <div className="mood-value" style={{ color: info.color }}>
            {mood > 0 ? `+${mood}` : mood}
          </div>
          <div className="mood-label">{info.label}</div>
        </div>
        <input
          type="range"
          className="mood-slider"
          min={-5}
          max={5}
          step={1}
          value={mood}
          onChange={e => setMood(Number(e.target.value))}
          style={{ background: moodGradient }}
        />
        <div className="mood-ticks">
          {[-5,-4,-3,-2,-1,0,1,2,3,4,5].map(v => (
            <span key={v}>{v > 0 ? `+${v}` : v}</span>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">睡眠時間</label>
        <div className="stepper">
          <button
            className="stepper-btn"
            onClick={() => setSleepHours(h => Math.max(0, +(h - 0.5).toFixed(1)))}
          >−</button>
          <div className="stepper-value">
            {sleepHours}<span className="stepper-unit">時間</span>
          </div>
          <button
            className="stepper-btn"
            onClick={() => setSleepHours(h => Math.min(24, +(h + 0.5).toFixed(1)))}
          >＋</button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">睡眠の質（1〜5）</label>
        <div className="rating-row">
          {[1, 2, 3, 4, 5].map(v => (
            <button
              key={v}
              className={`rating-btn ${sleepQuality === v ? 'active' : ''}`}
              onClick={() => setSleepQuality(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">ストレスレベル（1〜5）</label>
        <div className="rating-row">
          {[1, 2, 3, 4, 5].map(v => (
            <button
              key={v}
              className={`rating-btn ${stress === v ? 'active' : ''}`}
              onClick={() => setStress(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">メモ（任意）</label>
        <textarea
          className="memo-input"
          placeholder="今日の出来事、気づきなど..."
          value={memo}
          onChange={e => setMemo(e.target.value)}
          rows={3}
        />
      </div>

      <button className="btn-primary" onClick={handleSave}>
        {justSaved ? '✅ 保存しました！' : isEditing ? '更新する' : '記録する'}
      </button>
    </div>
  )
}
