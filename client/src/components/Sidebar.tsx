import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { JobTree } from './JobTree'
import { CreateJobModal } from './CreateJobModal'
import { CreateFolderModal } from './CreateFolderModal'
import { playChime } from '../lib/notify'

const SIDEBAR_WIDTH_KEY = 'sidebar-width'
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480
const SIDEBAR_DEFAULT = 224

function getSavedWidth(): number {
  try {
    const v = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (v) {
      const n = parseInt(v, 10)
      if (n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) return n
    }
  } catch { /* ignore */ }
  return SIDEBAR_DEFAULT
}

export function Sidebar() {
  const sidebarCollapsed = useStore(state => state.sidebarCollapsed)
  const toggleSidebar = useStore(state => state.toggleSidebar)
  const pendingInputIds = useStore(state => state.pendingInputIds)
  const wsConnected = useStore(state => state.wsConnected)
  const setSettingsOpen = useStore(state => state.setSettingsOpen)

  const [createOpen, setCreateOpen] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [width, setWidth] = useState(getSavedWidth)
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false)
  const overflowMenuRef = useRef<HTMLDivElement>(null)

  // Close overflow menu on outside click
  useEffect(() => {
    if (!overflowMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setOverflowMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [overflowMenuOpen])

  // Collapse settings + folder into ⋯ when sidebar is too narrow for all buttons
  const useOverflowMenu = width < 215

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const [notifDismissed, setNotifDismissed] = useState(
    () => localStorage.getItem('notif-dismissed') === '1'
  )

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
    if (result === 'granted') playChime()
  }

  function dismissNotifPrompt() {
    setNotifDismissed(true)
    localStorage.setItem('notif-dismissed', '1')
  }
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return
    const delta = e.clientX - startX.current
    const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + delta))
    setWidth(next)
  }, [])

  const onMouseUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setWidth(w => {
      try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)) } catch { /* ignore */ }
      return w
    })
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove])

  const onDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [width, onMouseMove, onMouseUp])

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  if (sidebarCollapsed) {
    return (
      <aside
        className="flex w-10 flex-shrink-0 flex-col items-center border-r border-[var(--border)] py-3"
        style={{ background: 'var(--sidebar-bg)' }}
      >
        <button
          onClick={toggleSidebar}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--dim)] text-sm transition hover:bg-white/6 hover:text-[var(--ink)]"
        >
          →
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="relative flex flex-shrink-0 flex-col border-r border-[var(--border)]"
      style={{ background: 'var(--sidebar-bg)', width }}
    >
      <div className="flex h-10 flex-shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-2" style={{ minWidth: 0 }}>
        <span
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-rose-500'}`}
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ink)]">
          agentsyncboard
        </span>

        {/* Always-visible actions */}
        <button
          onClick={() => setCreateOpen(true)}
          title="New job"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] text-lg leading-none transition hover:bg-white/6 hover:text-[var(--ink)]"
        >
          +
        </button>

        {/* Overflow menu (narrow sidebar) */}
        {useOverflowMenu ? (
          <div ref={overflowMenuRef} className="relative flex-shrink-0">
            <button
              onClick={() => setOverflowMenuOpen(v => !v)}
              title="More"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--dim)] text-sm transition hover:bg-white/6 hover:text-[var(--ink)]"
            >
              ⋯
            </button>
            {overflowMenuOpen && (
              <div
                className="absolute right-0 top-8 z-50 flex min-w-[140px] flex-col overflow-hidden rounded-lg border border-[var(--border-strong)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                style={{ background: '#111520' }}
              >
                <button
                  onClick={() => { setSettingsOpen(true); setOverflowMenuOpen(false) }}
                  className="flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)]"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0">
                    <path fillRule="evenodd" d="M7.429 1.525a6.593 6.593 0 0 1 1.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.18.501.28.455.287.991.305 1.438.048l.948-.564c.084-.05.172-.037.226.017.42.413.787.88 1.09 1.39.041.07.016.163-.045.217l-.861.719a1.345 1.345 0 0 0-.484 1.188 6.58 6.58 0 0 1 0 1.162 1.345 1.345 0 0 0 .484 1.188l.861.72c.061.053.086.146.045.217a7.099 7.099 0 0 1-1.09 1.39.177.177 0 0 1-.226.017l-.948-.564c-.447-.257-.983-.24-1.438.048a5.39 5.39 0 0 1-.501.28c-.447.222-.85.629-.997 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.58 6.58 0 0 1-1.142 0 .177.177 0 0 1-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a5.39 5.39 0 0 1-.501-.28c-.455-.287-.991-.305-1.438-.048l-.948.564a.177.177 0 0 1-.226-.017 7.099 7.099 0 0 1-1.09-1.39.177.177 0 0 1 .045-.217l.861-.72a1.345 1.345 0 0 0 .484-1.187 6.59 6.59 0 0 1 0-1.163 1.345 1.345 0 0 0-.484-1.188l-.861-.719a.177.177 0 0 1-.045-.217 7.1 7.1 0 0 1 1.09-1.39.177.177 0 0 1 .226-.017l.948.564c.447.257.983.24 1.438-.048.16-.1.327-.194.501-.28.447-.222.85-.629.997-1.189l.289-1.105c.029-.11.101-.143.137-.146ZM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" clipRule="evenodd" />
                  </svg>
                  Settings
                </button>
                <button
                  onClick={() => { setCreateFolderOpen(true); setOverflowMenuOpen(false) }}
                  className="flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)]"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0">
                    <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9Zm8.5 1.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5a.5.5 0 0 0-.5.5V5h8.5v-.5a.5.5 0 0 0-.5-.5Zm-7 2v6h11V7h-11Z" />
                  </svg>
                  New folder
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  onClick={() => { toggleSidebar(); setOverflowMenuOpen(false) }}
                  className="flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)]"
                >
                  ← Collapse
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M7.429 1.525a6.593 6.593 0 0 1 1.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.18.501.28.455.287.991.305 1.438.048l.948-.564c.084-.05.172-.037.226.017.42.413.787.88 1.09 1.39.041.07.016.163-.045.217l-.861.719a1.345 1.345 0 0 0-.484 1.188 6.58 6.58 0 0 1 0 1.162 1.345 1.345 0 0 0 .484 1.188l.861.72c.061.053.086.146.045.217a7.099 7.099 0 0 1-1.09 1.39.177.177 0 0 1-.226.017l-.948-.564c-.447-.257-.983-.24-1.438.048a5.39 5.39 0 0 1-.501.28c-.447.222-.85.629-.997 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.58 6.58 0 0 1-1.142 0 .177.177 0 0 1-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a5.39 5.39 0 0 1-.501-.28c-.455-.287-.991-.305-1.438-.048l-.948.564a.177.177 0 0 1-.226-.017 7.099 7.099 0 0 1-1.09-1.39.177.177 0 0 1 .045-.217l.861-.72a1.345 1.345 0 0 0 .484-1.187 6.59 6.59 0 0 1 0-1.163 1.345 1.345 0 0 0-.484-1.188l-.861-.719a.177.177 0 0 1-.045-.217 7.1 7.1 0 0 1 1.09-1.39.177.177 0 0 1 .226-.017l.948.564c.447.257.983.24 1.438-.048.16-.1.327-.194.501-.28.447-.222.85-.629.997-1.189l.289-1.105c.029-.11.101-.143.137-.146ZM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setCreateFolderOpen(true)}
              title="New folder"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9Zm8.5 1.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5a.5.5 0 0 0-.5.5V5h8.5v-.5a.5.5 0 0 0-.5-.5Zm-7 2v6h11V7h-11Z" />
              </svg>
            </button>
            <button
              onClick={toggleSidebar}
              title="Collapse"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] text-sm transition hover:bg-white/6 hover:text-[var(--ink)]"
            >
              ←
            </button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <JobTree />
      </div>

      {notifPermission === 'default' && !notifDismissed && (
        <div className="flex-shrink-0 border-t border-[var(--border)] px-3 py-2">
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-2.5 py-2">
            <span className="text-[13px]">🔔</span>
            <span className="min-w-0 flex-1 text-[11px] text-[var(--muted)]">Enable notifications?</span>
            <button
              onClick={requestNotifPermission}
              className="flex-shrink-0 rounded bg-[var(--accent-strong)] px-2 py-0.5 text-[10px] font-medium text-[#0a0c11] transition hover:opacity-90"
            >
              Allow
            </button>
            <button
              onClick={dismissNotifPrompt}
              className="flex-shrink-0 text-[11px] text-[var(--dim)] transition hover:text-[var(--ink)]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {pendingInputIds.length > 0 && (
        <div className="flex-shrink-0 border-t border-[var(--border)] px-3 py-2">
          <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-300">
              {pendingInputIds.length} input{pendingInputIds.length > 1 ? 's' : ''} waiting
            </span>
          </div>
        </div>
      )}

      {createOpen && <CreateJobModal onClose={() => setCreateOpen(false)} />}
      {createFolderOpen && <CreateFolderModal onClose={() => setCreateFolderOpen(false)} />}

      {/* Resize handle */}
      <div
        onMouseDown={onDragHandleMouseDown}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition hover:bg-sky-500/30 active:bg-sky-500/50"
        style={{ marginRight: -1 }}
      />
    </aside>
  )
}
