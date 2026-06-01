const TABS = [
  { id: 'form',     icon: '✏️', label: '記録' },
  { id: 'calendar', icon: '📅', label: 'カレンダー' },
  { id: 'charts',   icon: '📊', label: 'グラフ' },
  { id: 'list',     icon: '📋', label: '一覧' },
]

export default function Navigation({ active, onChange }) {
  return (
    <nav className="nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`nav-item ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
