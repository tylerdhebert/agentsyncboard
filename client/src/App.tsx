import { useMemo } from 'react'
import { MainPanel } from './components/MainPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { InputOverlay } from './components/InputOverlay'
import { useWebSocket } from './hooks/useWebSocket'
import { useStore } from './store'

export function App() {
  useWebSocket()

  const wsConnected = useStore(state => state.wsConnected)
  const settingsOpen = useStore(state => state.settingsOpen)
  const setSettingsOpen = useStore(state => state.setSettingsOpen)

  const statusLabel = useMemo(() => (wsConnected ? 'live' : 'offline'), [wsConnected])

  return (
    <div className="grid-shell relative flex h-full overflow-hidden text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.11),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(245,185,76,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_26%)]" />

      <aside className="pointer-events-none absolute left-0 top-0 z-40 hidden h-full w-2 bg-[linear-gradient(180deg,rgba(125,211,252,0.12),rgba(245,185,76,0.08),rgba(56,189,248,0.12))] lg:block" />

      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(8,11,16,0.86)] px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-[var(--good)]' : 'bg-[var(--bad)]'}`} />
          <span>{statusLabel}</span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="ml-2 rounded-full border border-[var(--border)] bg-white/5 px-2 py-1 font-[var(--font-ui)] text-[9px] uppercase tracking-[0.25em] text-[var(--ink)] transition hover:border-[var(--border-strong)] hover:bg-white/10"
          >
            settings
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />

        <header className="flex items-end justify-between border-b border-[var(--border)] px-6 pb-4 pt-6 lg:px-8">
          <div className="space-y-1">
            <div className="text-[0.64rem] uppercase tracking-[0.5em] text-[var(--muted)]">agentsyncboard</div>
            <h1 className="text-2xl font-semibold leading-none text-[var(--ink)] sm:text-[2rem]">
              Worktrees first. Everything else follows.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              A live control surface for jobs, worktrees, review, and human decisions.
            </p>
          </div>
          <div className="hidden rounded-full border border-[var(--border)] bg-white/5 px-4 py-2 text-right font-[var(--font-ui)] text-[9px] uppercase tracking-[0.4em] text-[var(--muted)] md:block">
            <div className="text-[var(--ink)]">sync channel</div>
            <div>ws / query / cli</div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <MainPanel />
        </main>
      </div>

      <InputOverlay />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
