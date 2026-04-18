import { useEffect } from 'react'
import { MainPanel } from './components/MainPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { InputOverlay } from './components/InputOverlay'
import { useWebSocket } from './hooks/useWebSocket'
import { useStore } from './store'
import { applyTheme } from './themes'

export function App() {
  useWebSocket()
  const settingsOpen = useStore(state => state.settingsOpen)
  const setSettingsOpen = useStore(state => state.setSettingsOpen)
  const codeTheme = useStore(state => state.codeTheme)
  useEffect(() => { applyTheme(codeTheme) }, [codeTheme])

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-[var(--border)]">
        <MainPanel />
      </div>
      <InputOverlay />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
