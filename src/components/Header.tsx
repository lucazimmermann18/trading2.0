import type { NavTab } from '../types'

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Market Dashboard', subtitle: 'Live market overview & key instruments' },
  charts: { title: 'Advanced Charts', subtitle: 'Technical analysis & price action' },
  signals: { title: 'Trading Signals', subtitle: 'AI-powered buy/sell recommendations' },
  watchlist: { title: 'Watchlist', subtitle: 'Track your favorite instruments' },
  portfolio: { title: 'Portfolio', subtitle: 'Your positions & performance' },
}

interface Props {
  activeTab: NavTab
  searchQuery: string
  onSearchChange: (q: string) => void
}

export default function Header({ activeTab, searchQuery, onSearchChange }: Props) {
  const { title, subtitle } = TAB_TITLES[activeTab]
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <header className="header">
      <div style={{ flex: 1 }}>
        <div className="header-title">{title}</div>
        <div className="header-subtitle">{subtitle}</div>
      </div>

      <div className="header-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          placeholder="Search symbol..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', lineHeight: 1.4 }}>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{timeStr}</div>
        <div>{dateStr}</div>
      </div>

      <div className="header-badge">
        <div className="dot" />
        LIVE
      </div>
    </header>
  )
}
