import { useCallback, useMemo, useRef, useState } from 'react'
import { PathBrowserPopover } from './PathBrowserPopover'

export function PathPicker({
  value,
  onChange,
  placeholder = 'Select a directory...',
  selectFiles = false,
}: {
  value: string
  onChange: (path: string) => void
  placeholder?: string
  selectFiles?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [browsing, setBrowsing] = useState<string | undefined>(undefined)
  const anchorRef = useRef<HTMLDivElement>(null)

  const inputCls = useMemo(
    () => 'w-full rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--dim)] transition focus:border-[var(--border-strong)] focus:bg-[rgba(255,255,255,0.06)] font-mono',
    [],
  )

  const openBrowser = useCallback(() => {
    setBrowsing(value || undefined)
    setOpen(true)
  }, [value])

  const handleSelect = useCallback((path: string) => {
    onChange(path)
    setOpen(false)
  }, [onChange])

  return (
    <>
      <div ref={anchorRef} className="flex gap-2">
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          className={inputCls}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={openBrowser}
          className="flex-shrink-0 rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[12px] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          title="Browse filesystem"
        >
          Browse
        </button>
      </div>

      <PathBrowserPopover
        open={open}
        browsing={browsing}
        setBrowsing={setBrowsing}
        selectFiles={selectFiles}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
      />
    </>
  )
}
