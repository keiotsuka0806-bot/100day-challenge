import { useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { getMoodInfo } from '../utils/moodUtils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const RANGES = [
  { label: '7日',  days: 7 },
  { label: '30日', days: 30 },
  { label: '全期間', days: Infinity },
]

function filterRecords(records, days) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  if (days === Infinity) return sorted
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return sorted.filter(r => r.date >= cutoffStr)
}

function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxRotation: 45, font: { size: 10 } },
    },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: { font: { size: 10 } },
    },
  },
}

export default function ChartsView({ records }) {
  const [rangeIdx, setRangeIdx] = useState(0)

  if (records.length === 0) {
    return (
      <div className="charts-screen">
        <h1 className="screen-header">グラフ</h1>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p>まだ記録がありません</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>記録タブからデータを追加してください</p>
        </div>
      </div>
    )
  }

  const filtered = filterRecords(records, RANGES[rangeIdx].days)
  const labels = filtered.map(r => shortDate(r.date))

  const moodData = {
    labels,
    datasets: [{
      data: filtered.map(r => r.mood),
      borderColor: '#7c3aed',
      backgroundColor: 'rgba(124,58,237,0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 5,
      pointBackgroundColor: filtered.map(r => getMoodInfo(r.mood).color),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }],
  }

  const sleepData = {
    labels,
    datasets: [{
      data: filtered.map(r => r.sleepHours),
      backgroundColor: 'rgba(59,130,246,0.65)',
      borderRadius: 6,
    }],
  }

  const combinedData = {
    labels,
    datasets: [
      {
        label: '睡眠の質',
        data: filtered.map(r => r.sleepQuality),
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 4,
      },
      {
        label: 'ストレス',
        data: filtered.map(r => r.stress),
        borderColor: '#f97316',
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 4,
      },
    ],
  }

  const moodOptions = {
    ...BASE_OPTIONS,
    scales: {
      ...BASE_OPTIONS.scales,
      y: { ...BASE_OPTIONS.scales.y, min: -5, max: 5, ticks: { font: { size: 10 }, stepSize: 1 } },
    },
  }

  const ratingOptions = {
    ...BASE_OPTIONS,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { font: { size: 11 }, boxWidth: 12, padding: 8 },
      },
    },
    scales: {
      ...BASE_OPTIONS.scales,
      y: { ...BASE_OPTIONS.scales.y, min: 1, max: 5, ticks: { font: { size: 10 }, stepSize: 1 } },
    },
  }

  return (
    <div className="charts-screen">
      <h1 className="screen-header">グラフ</h1>

      <div className="range-selector">
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            className={`range-btn ${rangeIdx === i ? 'active' : ''}`}
            onClick={() => setRangeIdx(i)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="chart-card">
        <div className="chart-title">気分スコア（−5〜+5）</div>
        <div className="chart-container">
          <Line data={moodData} options={moodOptions} />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">睡眠時間（時間）</div>
        <div className="chart-container">
          <Bar data={sleepData} options={BASE_OPTIONS} />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">睡眠の質 & ストレス（1〜5）</div>
        <div className="chart-container">
          <Line data={combinedData} options={ratingOptions} />
        </div>
      </div>
    </div>
  )
}
