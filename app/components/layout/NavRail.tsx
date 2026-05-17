"use client"
import type { ViewId } from "@/app/lib/types"

const NAV_ITEMS: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard",   label: "Dashboard",   icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13l9-9 9 9"/><path d="M5 11v10h14V11"/></svg> },
  { id: "multichart",  label: "Multi-Chart", icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg> },
  { id: "heatmap",     label: "Heatmap",     icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: "performance", label: "Performance", icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg> },
  { id: "journal",     label: "Journal",     icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h12l4 4v12H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg> },
  { id: "mtf",         label: "MTF Analysis", icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="5" rx="1"/><rect x="2" y="9" width="13" height="5" rx="1"/><rect x="2" y="16" width="8" height="5" rx="1"/></svg> },
  { id: "replay",      label: "Replay",      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
  { id: "system",      label: "System",      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></svg> },
]

interface Props {
  view: ViewId
  setView: (v: ViewId) => void
  badges?: Partial<Record<ViewId, number>>
}

export default function NavRail({ view, setView, badges }: Props) {
  return (
    <nav className="w-[60px] shrink-0 panel border-t-0 border-b-0 border-l-0 flex flex-col items-center py-3">
      <div className="space-y-1 flex-1">
        {NAV_ITEMS.map(it => {
          const on = view === it.id
          const badge = badges?.[it.id] ?? 0
          return (
            <button
              key={it.id}
              onClick={() => setView(it.id)}
              title={it.label}
              className={`relative w-10 h-10 rounded-md flex items-center justify-center group transition
                ${on ? "bg-accent-blue/15 text-accent-blue" : "text-mute hover:text-white hover:bg-white/[0.04]"}`}
            >
              {it.icon}
              {on && <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-accent-blue" />}
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-accent-red text-[9px] font-bold text-white flex items-center justify-center">
                  {badge}
                </span>
              )}
              <span className="absolute left-full ml-2 px-2 h-7 rounded-md bg-ink-850 border border-white/10 text-[11px] text-white whitespace-nowrap items-center hidden group-hover:flex pointer-events-none z-30">
                {it.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
