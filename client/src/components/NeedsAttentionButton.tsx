import { useRef, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api, unwrap } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import type { InputRequest, Job } from '../api/types'

function formatElapsed(updatedAt: string): string {
  const diffMs = Date.now() - new Date(updatedAt).getTime()
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

type AttentionItem = {
  job: Job
  reason: 'review' | 'input'
}

export function NeedsAttentionButton() {
  const setSelectedJobId = useStore(state => state.setSelectedJobId)
  const setActiveTab = useStore(state => state.setActiveTab)
  const setRevealJobId = useStore(state => state.setRevealJobId)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: queryKeys.jobs,
    queryFn: () => unwrap(api.jobs.get()),
    refetchInterval: 30_000,
  })

  const { data: pendingInputs = [] } = useQuery<InputRequest[]>({
    queryKey: queryKeys.inputPending,
    queryFn: () => unwrap(api.input.pending.get()),
    refetchInterval: 5_000,
  })

  const pendingInputJobIds = new Set(pendingInputs.map((i: InputRequest) => i.jobId))

  const items: AttentionItem[] = []

  for (const job of jobs) {
    const needsReview = job.status === 'in-review' && job.requireReview
    const needsInput = pendingInputJobIds.has(job.id)

    if (needsReview && !needsInput) {
      items.push({ job, reason: 'review' })
    } else if (needsInput) {
      // input takes priority in label; deduplicate if also in-review
      items.push({ job, reason: 'input' })
    }
  }

  // sort by most recently updated first
  items.sort((a, b) => new Date(b.job.updatedAt).getTime() - new Date(a.job.updatedAt).getTime())

  const count = items.length

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleItemClick(job: Job) {
    setSelectedJobId(job.id)
    setActiveTab('detail')
    setRevealJobId(job.id)
    setOpen(false)
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        title="needs attention"
        className={[
          'relative flex h-6 w-6 items-center justify-center rounded text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]',
          open ? 'bg-white/6 text-[var(--ink)]' : '',
        ].join(' ')}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-[2px] font-mono text-[9px] font-bold leading-none text-[#0a0c11]">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-8 z-50 flex min-w-[260px] max-w-[320px] flex-col overflow-hidden rounded-lg border border-[var(--border-strong)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          style={{ background: '#111520' }}
        >
          <div className="border-b border-[var(--border)] px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              needs attention
            </span>
          </div>

          {items.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-[var(--dim)]">
              nothing needs attention
            </div>
          ) : (
            <div className="flex flex-col">
              {items.map(({ job, reason }) => (
                <button
                  key={job.id}
                  onClick={() => handleItemClick(job)}
                  className="flex items-baseline gap-2 px-3 py-2 text-left transition hover:bg-white/5"
                >
                  <span className="font-mono text-[11px] text-[var(--dim)] flex-shrink-0">
                    #{job.refNum}
                  </span>
                  <span className={[
                    'flex-shrink-0 text-[10px] font-medium rounded px-1 py-px leading-none',
                    reason === 'review'
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'bg-amber-500/15 text-amber-300',
                  ].join(' ')}>
                    {reason === 'review' ? 'review' : 'input'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink)]">
                    {job.title}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-[var(--dim)]">
                    {formatElapsed(job.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
