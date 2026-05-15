import { useEffect, useState } from 'react'
import { fetchQuote } from '../api/twelvedata'
import type { NavTab, Quote } from '../types'

interface Props {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
  symbols: string[]
  onSymbolSelect: (sym: string) => void
}

const NAV_ITEMS: { tab: NavTab; label: string; icon: JSX.Element }[] = [
  {
    tab: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    tab: 'charts',
    label: 'Charts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    tab: 'signals',
    label: 'Signals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    tab: 'watchlist',
    label: 'Watchlist',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    tab: 'portfolio',
    label: 'Portfolio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
]

const MINI_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'BTC/USD', 'ETH/USD']

export default function Sidebar({ activeTab, onTabChange, onSymbolSelect }: Props) {
  const [miniQuotes, setMiniQuotes] = useState<Quote[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const quotes = await fetchQuote(MINI_SYMBOLS)
        setMiniQuotes(quotes)
      } catch {
        // silent fail for sidebar
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg className="logo-svg" viewBox="0 0 40 40" fill="none">
            <path d="M4 32 L14 12 L22 22 L30 8 L36 32" stroke="#00d4ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="22" cy="22" r="5" fill="#00ff88" />
          </svg>
          <span className="logo-name">Trade<span>AI</span> Pro</span>
        </div>
        <div className="logo-tagline">Institutional Signal Engine</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {NAV_ITEMS.map(({ tab, label, icon }) => (
          <button
            key={tab}
            className={`nav-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-watchlist-mini">
        <div className="nav-section-label">Live Prices</div>
        {miniQuotes.length > 0
          ? miniQuotes.map((q) => (
            <div
              key={q.symbol}
              className="mini-ticker"
              onClick={() => onSymbolSelect(q.symbol)}
            >
              <div>
                <div className="mini-ticker-sym">{q.symbol.replace('/USD', '')}</div>
                <div className="mini-ticker-price">${q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className={`mini-ticker-chg ${q.changePercent >= 0 ? 'up' : 'down'}`}>
                {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
              </div>
            </div>
          ))
          : MINI_SYMBOLS.map((s) => (
            <div key={s} className="mini-ticker">
              <div>
                <div className="mini-ticker-sym skeleton" style={{ width: 40, height: 14, marginBottom: 4 }} />
                <div className="mini-ticker-price skeleton" style={{ width: 60, height: 12 }} />
              </div>
            </div>
          ))}
      </div>
    </aside>
  )
}
