import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import type { DiffType } from '../store'
import type { Job } from '../api/types'

const DIFF_TYPES: { id: DiffType; label: string }[] = [
  { id: 'uncommitted', label: 'uncommitted' },
  { id: 'branch', label: 'branch' },
  { id: 'combined', label: 'combined' },
]

function splitDiff(diff: string) {
  const blocks: { header: string; lines: string[] }[] = []
  let current: { header: string; lines: string[] } | null = null

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = { header: line, lines: [line] }
      blocks.push(current)
      continue
    }

    if (!current) {
      current = { header: 'diff', lines: [] }
      blocks.push(current)
    }

    current.lines.push(line)
  }

  return blocks.filter(block => block.lines.some(line => line.trim().length > 0))
}

function DiffBlock({ block, diffType }: { block: { header: string; lines: string[] }; diffType: DiffType }) {
  const fileLabel = useMemo(() => {
    const match = block.header.match(/ b\/(.+)$/)
    return match ? match[1] : block.header.replace(/^diff --git\s+/, '')
  }, [block.header])

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-4 py-2">
        <div className="font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.28em] text-[var(--ink)]">
          {fileLabel}
        </div>
        {diffType === 'uncommitted' && (
          <div className="rounded-full border border-[rgba(245,185,76,0.22)] bg-[rgba(245,185,76,0.08)] px-2 py-0.5 font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.24em] text-[var(--warn)]">
            warning uncommitted changes
          </div>
        )}
      </div>

      <pre className="overflow-x-auto p-4 font-[var(--font-mono)] text-[0.75rem] leading-relaxed text-[var(--ink)]">
        {block.lines.map((line, index) => {
          let tone = 'text-[var(--muted)]'
          if (line.startsWith('+++') || line.startsWith('---')) tone = 'text-slate-400'
          else if (line.startsWith('+') && !line.startsWith('+++')) tone = 'bg-[rgba(74,222,128,0.08)] text-emerald-200'
          else if (line.startsWith('-') && !line.startsWith('---')) tone = 'bg-[rgba(248,113,113,0.08)] text-rose-200'
          else if (line.startsWith('@@')) tone = 'text-sky-200'
          else if (line.startsWith('diff --git')) tone = 'text-[var(--ink)]'

          return (
            <div key={`${index}-${line}`} className={`whitespace-pre-wrap rounded px-1.5 ${tone}`}>
              {line || ' '}
            </div>
          )
        })}
      </pre>
    </section>
  )
}

export function DiffTab({ job }: { job: Pick<Job, 'id' | 'branchName' | 'baseBranch' | 'type'> }) {
  const diffType = useStore(state => state.diffType)
  const setDiffType = useStore(state => state.setDiffType)

  const { data, isLoading } = useQuery<{ diff: string }>({
    queryKey: queryKeys.diff(job.id, diffType),
    queryFn: () => requestJson<{ diff: string }>(`/jobs/${job.id}/diff?type=${diffType}`),
    enabled: job.type === 'impl' && !!job.branchName,
  })

  if (job.type !== 'impl' || !job.branchName) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[0.92rem] text-[var(--muted)]">
        Diff view is only available for implementation jobs with a worktree.
      </div>
    )
  }

  const blocks = splitDiff(data?.diff ?? '')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[rgba(8,11,16,0.8)] px-5 py-3">
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/5 p-1">
          {DIFF_TYPES.map(option => (
            <button
              key={option.id}
              onClick={() => setDiffType(option.id)}
              className={[
                'rounded-full px-3 py-1.5 font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.25em] transition',
                diffType === option.id
                  ? 'bg-[rgba(56,189,248,0.18)] text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="ml-auto font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.28em] text-[var(--muted)]">
          {job.branchName} → {job.baseBranch ?? 'main'}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-[0.92rem] text-[var(--muted)]">
            Loading diff...
          </div>
        ) : blocks.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-[0.92rem] text-[var(--muted)]">
            No changes.
          </div>
        ) : (
          <div className="space-y-4">
            {blocks.map(block => (
              <DiffBlock key={block.header} block={block} diffType={diffType} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
