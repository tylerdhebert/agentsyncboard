import { useState, useRef, useCallback, useEffect } from 'react'
import { Bell, ChevronLeft, ChevronRight, Ellipsis, FolderPlus, Plus, Settings, X } from 'lucide-react'
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
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
        >
          <ChevronRight className="h-4 w-4" />
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

        <button
          onClick={() => setCreateOpen(true)}
          title="new job"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
        >
          <Plus className="h-4 w-4" />
        </button>

        {useOverflowMenu ? (
          <div ref={overflowMenuRef} className="relative flex-shrink-0">
            <button
              onClick={() => setOverflowMenuOpen(v => !v)}
              title="more"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
            >
              <Ellipsis className="h-4 w-4" />
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
                  <Settings className="h-3.5 w-3.5 flex-shrink-0" />
                  settings
                </button>
                <button
                  onClick={() => { setCreateFolderOpen(true); setOverflowMenuOpen(false) }}
                  className="flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)]"
                >
                  <FolderPlus className="h-3.5 w-3.5 flex-shrink-0" />
                  new folder
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  onClick={() => { toggleSidebar(); setOverflowMenuOpen(false) }}
                  className="flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)]"
                >
                  <ChevronLeft className="h-3.5 w-3.5 flex-shrink-0" />
                  collapse
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => setSettingsOpen(true)}
              title="settings"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCreateFolderOpen(true)}
              title="new folder"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleSidebar}
              title="collapse"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
            >
              <ChevronLeft className="h-4 w-4" />
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
            <Bell className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" />
            <span className="min-w-0 flex-1 text-[11px] text-[var(--muted)]">enable notifications?</span>
            <button
              onClick={requestNotifPermission}
              className="flex-shrink-0 rounded bg-[var(--accent-strong)] px-2 py-0.5 text-[10px] font-medium text-[#0a0c11] transition hover:opacity-90"
            >
              allow
            </button>
            <button
              onClick={dismissNotifPrompt}
              className="flex-shrink-0 text-[11px] text-[var(--dim)] transition hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
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

      <div
        onMouseDown={onDragHandleMouseDown}
        className="absolute bottom-0 right-0 top-0 w-1 cursor-col-resize transition hover:bg-sky-500/30 active:bg-sky-500/50"
        style={{ marginRight: -1 }}
      />
    </aside>
  )
}
