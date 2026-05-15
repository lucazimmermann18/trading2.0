import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import ChartsPage from './components/ChartsPage'
import SignalsPage from './components/SignalsPage'
import WatchlistPage from './components/WatchlistPage'
import PortfolioPage from './components/PortfolioPage'
import type { NavTab } from './types'

const DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'BTC/USD', 'ETH/USD', 'SPY']

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [searchQuery, setSearchQuery] = useState('')

  const handleSymbolSelect = (sym: string) => {
    setSelectedSymbol(sym)
    setActiveTab('charts')
  }

  return (
    <div className="app">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        symbols={DEFAULT_SYMBOLS}
        onSymbolSelect={handleSymbolSelect}
      />
      <div className="main">
        <Header
          activeTab={activeTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="content">
          {activeTab === 'dashboard' && (
            <Dashboard
              symbols={DEFAULT_SYMBOLS}
              onSymbolSelect={handleSymbolSelect}
            />
          )}
          {activeTab === 'charts' && (
            <ChartsPage
              symbol={selectedSymbol}
              onSymbolChange={setSelectedSymbol}
            />
          )}
          {activeTab === 'signals' && (
            <SignalsPage symbols={DEFAULT_SYMBOLS} onSymbolSelect={handleSymbolSelect} />
          )}
          {activeTab === 'watchlist' && (
            <WatchlistPage symbols={DEFAULT_SYMBOLS} onSymbolSelect={handleSymbolSelect} />
          )}
          {activeTab === 'portfolio' && (
            <PortfolioPage onSymbolSelect={handleSymbolSelect} />
          )}
        </div>
      </div>
    </div>
  )
}
