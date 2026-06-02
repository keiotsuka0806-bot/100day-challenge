const TABS = [
  { id: 'form',     icon: '✏️', label: '記録' },
  { id: 'calendar', icon: '📅', label: 'カレンダー' },
  { id: 'charts',   icon: '📊', label: 'グラフ' },
  { id: 'list',     icon: '📋', label: '一覧' },
]

export default function Navigation({ active, onChange, user, onSignOut }) {
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
      <button className="nav-item nav-item-signout" onClick={onSignOut} title={user?.displayName}>
        <img
          src={user?.photoURL ?? ''}
          alt=""
          className="nav-avatar"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
        ログアウト
      </button>
    </nav>
  )
}
