import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { requestJson } from '../api/client'

type BrowseResult = {
  path: string
  sep: string
  parent: string | null
  entries: { name: string; isDir: boolean }[]
}

type PopoverPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

function FolderGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1.75 4.75h3.3l1.15 1.4h8.05v5.85a1.25 1.25 0 0 1-1.25 1.25H3A1.25 1.25 0 0 1 1.75 12Z" />
      <path d="M1.75 5.25V4A1.25 1.25 0 0 1 3 2.75h2.55c.38 0 .74.17.98.46l.72.89h4.5A1.25 1.25 0 0 1 13 5.35V6.1" />
    </svg>
  )
}

function FileGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M4 2.75h5l3 3V12A1.25 1.25 0 0 1 10.75 13.25h-6.5A1.25 1.25 0 0 1 3 12V4A1.25 1.25 0 0 1 4.25 2.75Z" />
      <path d="M9 2.75V6h3" />
    </svg>
  )
}

type PathBrowserPopoverProps = {
  open: boolean
  browsing: string | undefined
  setBrowsing: (path: string | undefined) => void
  selectFiles: boolean
  anchorRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onSelect: (path: string) => void
}

export function PathBrowserPopover({
  open,
  browsing,
  setBrowsing,
  selectFiles,
  anchorRef,
  onClose,
  onSelect,
}: PathBrowserPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PopoverPosition | null>(null)

  const { data, isFetching } = useQuery<BrowseResult>({
    queryKey: ['fs-browse', browsing ?? '', selectFiles],
    queryFn: () => {
      const params = new URLSearchParams()
      if (browsing) params.set('path', browsing)
      if (selectFiles) params.set('files', 'true')
      const query = params.toString()
      return requestJson<BrowseResult>(`/fs/browse${query ? `?${query}` : ''}`)
    },
    enabled: open,
    placeholderData: keepPreviousData,
  })

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const width = Math.min(Math.max(rect.width, 420), viewportWidth - 16)
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8))
    const belowSpace = viewportHeight - rect.bottom - 8
    const aboveSpace = rect.top - 8
    const openAbove = belowSpace < 280 && aboveSpace > belowSpace
    const maxHeight = Math.max(180, Math.min(360, (openAbove ? aboveSpace : belowSpace) - 12))
    const estimatedHeight = Math.min(360, maxHeight)
    const top = openAbove
      ? Math.max(8, rect.top - estimatedHeight - 8)
      : Math.min(viewportHeight - estimatedHeight - 8, rect.bottom + 8)

    setPosition({ top, left, width, maxHeight })
  }, [anchorRef])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const handle = () => updatePosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchorRef, onClose, open])

  useEffect(() => {
    if (open) updatePosition()
  }, [data, open, updatePosition])

  if (!open || !position) return null

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[90] overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[rgba(10,13,20,0.98)] shadow-[0_24px_52px_rgba(0,0,0,0.58)]"
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">
          {data?.path ?? browsing ?? 'Loading...'}
        </span>
        {isFetching && <span className="flex-shrink-0 text-[10px] text-[var(--dim)]">syncing</span>}
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] text-[var(--dim)] transition hover:bg-white/5 hover:text-[var(--ink)]"
        >
          close
        </button>
      </div>

      <div className="overflow-y-auto py-1" style={{ maxHeight: position.maxHeight }}>
        {!data ? (
          <div className="px-3 py-4 text-[12px] text-[var(--dim)]">Loading...</div>
        ) : (
          <>
            {data.parent && (
              <button
                type="button"
                onClick={() => setBrowsing(data.parent ?? undefined)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--dim)] transition hover:bg-white/[0.04] hover:text-[var(--ink)]"
              >
                <span className="w-4 text-center font-mono text-[11px]">..</span>
                <span className="font-mono">Parent directory</span>
              </button>
            )}

            {data.entries.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--dim)]">
                {selectFiles ? 'No files or subdirectories' : 'No subdirectories'}
              </div>
            )}

            {data.entries.map(entry => {
              const entryPath = `${data.path}${data.sep}${entry.name}`
              const Icon = entry.isDir ? FolderGlyph : FileGlyph
              const handleClick = entry.isDir ? () => setBrowsing(entryPath) : () => onSelect(entryPath)

              return (
                <button
                  key={entry.name}
                  type="button"
                  onClick={handleClick}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ink)] transition hover:bg-white/[0.04]"
                >
                  <span className="flex h-4 w-4 items-center justify-center text-[var(--muted)]">
                    <Icon />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
                </button>
              )
            })}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-3 py-2.5">
        <span className="min-w-0 truncate font-mono text-[11px] text-[var(--dim)]">
          {data?.path ?? ''}
        </span>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2.5 py-1 text-[11px] text-[var(--dim)] transition hover:bg-white/5 hover:text-[var(--ink)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (data?.path) onSelect(data.path)
            }}
            className="rounded bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-medium text-[#0a0c11] transition hover:opacity-90"
          >
            Select
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
