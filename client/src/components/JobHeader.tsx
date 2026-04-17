import { useEffect, useRef, useState } from 'react'
import { Ellipsis, Stamp, Trash2 } from 'lucide-react'
import type { Job } from '../api/types'

const STATUS_ACCENT: Record<Job['status'], string> = {
  open: '#64748b',
  'in-progress': '#f59e0b',
  blocked: '#f87171',
  'in-review': '#a78bfa',
  approved: '#22c55e',
  done: '#34d399',
}

const STATUS_COLOR: Record<Job['status'], string> = {
  open: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  'in-progress': 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  blocked: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  'in-review': 'border-violet-400/20 bg-violet-400/10 text-violet-200',
  approved: 'border-green-400/20 bg-green-400/10 text-green-200',
  done: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
}

const TYPE_COLOR: Record<Job['type'], string> = {
  goal: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
  plan: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
  review: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200',
  analysis: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
  arch: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  convo: 'border-orange-400/20 bg-orange-400/10 text-orange-200',
  impl: 'border-stone-400/20 bg-stone-400/10 text-stone-200',
}

function Switch({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="group flex items-center gap-2"
    >
      <span
        className={[
          'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border transition-colors duration-200',
          value
            ? 'border-sky-400/40 bg-sky-500/30'
            : 'border-white/10 bg-white/[0.06]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200',
            value
              ? 'left-[18px] bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]'
              : 'left-0.5 bg-slate-500',
          ].join(' ')}
        />
      </span>
      <span className={`text-[12px] ${value ? 'text-[var(--ink)]' : 'text-[var(--dim)]'} transition-colors`}>
        {label}
      </span>
    </button>
  )
}

export function JobHeader({
  job,
  onToggle,
  onApprove,
  onDelete,
  approveDisabled = false,
  deleteDisabled = false,
}: {
  job: Job
  onToggle: (field: 'autoMerge' | 'requireReview', value: boolean) => void
  onApprove: () => void
  onDelete: () => void
  approveDisabled?: boolean
  deleteDisabled?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div
      className="flex flex-col border-b border-[var(--border)]"
      style={{
        background: 'rgba(10, 13, 20, 0.9)',
        borderLeft: `3px solid ${STATUS_ACCENT[job.status]}`,
      }}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <span className="flex-shrink-0 font-mono text-[11px] text-[var(--dim)]">#{job.refNum}</span>
        <h2 className="min-w-0 shrink truncate text-[15px] font-semibold text-[var(--ink)]">
          {job.title}
        </h2>
        <span className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${TYPE_COLOR[job.type]}`}>
          {job.type}
        </span>
        <span className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${STATUS_COLOR[job.status]}`}>
          {job.status}
        </span>
        <span className="flex-1" />
        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(open => !open)}
            title="more actions"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
          >
            <Ellipsis className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-7 z-20 flex min-w-[12rem] flex-col overflow-hidden rounded-lg border border-[var(--border-strong)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
              style={{ background: '#111520' }}
            >
              {job.status === 'in-review' && (
                <button
                  onClick={() => {
                    onApprove()
                    setMenuOpen(false)
                  }}
                  disabled={approveDisabled}
                  className="flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Stamp className="h-3.5 w-3.5 flex-shrink-0" />
                  force approve
                </button>
              )}
              <button
                onClick={() => {
                  onDelete()
                  setMenuOpen(false)
                }}
                disabled={deleteDisabled}
                className="flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
                delete job
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center px-4 pb-2.5">
        <div className="flex flex-1 items-center gap-2 text-[11px] text-[var(--dim)]">
          {job.agentId && <span className="max-w-[120px] truncate">{job.agentId}</span>}
          {job.branchName && <span className="max-w-[160px] truncate font-mono">{job.branchName}</span>}
          {!job.agentId && !job.branchName && <span>unassigned</span>}
        </div>

        <div className="flex items-center gap-5">
          <Switch
            label="auto-merge"
            value={job.autoMerge}
            onChange={next => onToggle('autoMerge', next)}
          />
          <Switch
            label="require-review"
            value={job.requireReview}
            onChange={next => onToggle('requireReview', next)}
          />
        </div>

        <div className="flex-1" />
      </div>
    </div>
  )
}
