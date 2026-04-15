import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { requestJson } from '../api/client'

type BrowseResult = {
  path: string
  sep: string
  parent: string | null
  entries: { name: string; isDir: boolean }[]
}

export function PathPicker({
  value,
  onChange,
  placeholder = 'Select a directory…',
}: {
  value: string
  onChange: (path: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [browsing, setBrowsing] = useState<string | undefined>(undefined)

  const { data, isFetching } = useQuery<BrowseResult>({
    queryKey: ['fs-browse', browsing ?? ''],
    queryFn: () =>
      requestJson<BrowseResult>(`/fs/browse${browsing ? `?path=${encodeURIComponent(browsing)}` : ''}`),
    enabled: open,
    placeholderData: keepPreviousData,
  })

  const inputCls =
    'w-full rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--dim)] transition focus:border-[var(--border-strong)] focus:bg-[rgba(255,255,255,0.06)] font-mono'

  if (!open) {
    return (
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className={inputCls}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => {
            setBrowsing(value || undefined)
            setOpen(true)
          }}
          className="flex-shrink-0 rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[12px] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          title="Browse filesystem"
        >
          Browse
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-[var(--border-strong)] bg-[rgba(10,13,20,0.98)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {/* Current path bar */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">
          {data?.path ?? browsing ?? '…'}
        </span>
        {isFetching && (
          <span className="flex-shrink-0 text-[10px] text-[var(--dim)]">…</span>
        )}
        <button
          onClick={() => setOpen(false)}
          className="flex-shrink-0 text-[11px] text-[var(--dim)] transition hover:text-[var(--ink)]"
        >
          ✕
        </button>
      </div>

      {/* Directory listing */}
      <div className="max-h-48 overflow-y-auto">
        {!data ? (
          <div className="px-3 py-4 text-[12px] text-[var(--dim)]">Loading…</div>
        ) : (
          <>
            {/* Up to parent */}
            {data?.parent && (
              <button
                onClick={() => setBrowsing(data.parent ?? undefined)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--dim)] transition hover:bg-white/[0.04] hover:text-[var(--ink)]"
              >
                <span className="text-[var(--dim)]">↑</span>
                <span className="font-mono">..</span>
              </button>
            )}

            {data?.entries.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--dim)]">No subdirectories</div>
            )}

            {data?.entries.map(entry => (
              <button
                key={entry.name}
                onClick={() => setBrowsing(`${data.path}${data.sep}${entry.name}`)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ink)] transition hover:bg-white/[0.04]"
              >
                <span className="text-[var(--dim)]">📁</span>
                <span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Select current / cancel */}
      <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2">
        <span className="truncate font-mono text-[11px] text-[var(--dim)]">
          {data?.path ?? ''}
        </span>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded px-2.5 py-1 text-[11px] text-[var(--dim)] transition hover:text-[var(--ink)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (data?.path) onChange(data.path)
              setOpen(false)
            }}
            className="rounded bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-medium text-[#0a0c11] transition hover:opacity-90"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  )
}
