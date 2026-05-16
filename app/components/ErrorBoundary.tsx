"use client"
import { Component, type ReactNode } from "react"

interface Props { children: ReactNode }
interface State { error: Error | null; info: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: "" }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: "" }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ info: info.componentStack ?? "" })
    console.error("[TradeAI] Unhandled render error:", error, info)
  }

  handleReload = () => {
    this.setState({ error: null, info: "" })
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ error: null, info: "" })
  }

  render() {
    const { error, info } = this.state

    if (!error) return this.props.children

    return (
      <div className="flex items-center justify-center h-screen bg-[#070a12] p-8">
        <div className="max-w-lg w-full space-y-5">
          {/* Icon */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-red/15 text-accent-red flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white tracking-tight">Something went wrong</div>
              <div className="text-[11px] text-mute mt-0.5">The scanner hit an unexpected error</div>
            </div>
          </div>

          {/* Error message */}
          <div className="panel rounded-lg p-4 space-y-2">
            <div className="text-[11px] tracking-[0.14em] uppercase text-mute">Error</div>
            <div className="text-[12.5px] text-accent-red font-mono leading-relaxed">
              {error.message || String(error)}
            </div>
          </div>

          {/* Stack trace (collapsed) */}
          {info && (
            <details className="panel rounded-lg p-3 text-[10px] text-mute font-mono">
              <summary className="cursor-pointer text-[10px] tracking-[0.14em] uppercase mb-2 hover:text-white transition">
                Component Stack
              </summary>
              <pre className="overflow-x-auto whitespace-pre-wrap opacity-60 mt-2 leading-relaxed">
                {info.trim()}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="flex-1 h-10 rounded-lg bg-accent-blue/15 text-accent-blue border border-accent-blue/30
                text-[12px] font-semibold tracking-[0.12em] uppercase hover:bg-accent-blue/25 transition"
            >
              Reload App
            </button>
            <button
              onClick={this.handleReset}
              className="h-10 px-5 rounded-lg border border-white/10 text-white/60
                text-[12px] hover:text-white hover:border-white/20 transition"
            >
              Try Again
            </button>
          </div>

          <div className="text-[10px] text-mute text-center">
            Signal history and cached bars are preserved in localStorage
          </div>
        </div>
      </div>
    )
  }
}
