import type { Job } from '../api/types'

const STATUS_COLOR: Record<Job['status'], string> = {
  open: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
  'in-progress': 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  blocked: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  'in-review': 'border-violet-400/20 bg-violet-400/10 text-violet-100',
  done: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
}

const TYPE_COLOR: Record<Job['type'], string> = {
  goal: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
  plan: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
  review: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100',
  analysis: 'border-slate-400/20 bg-slate-400/10 text-slate-100',
  impl: 'border-stone-400/20 bg-stone-400/10 text-stone-100',
}

function Toggle({
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
      onClick={() => onChange(!value)}
      className={[
        'flex items-center gap-2 rounded-full border px-3 py-1.5 font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.25em] transition',
        value
          ? 'border-[rgba(125,211,252,0.35)] bg-[rgba(56,189,248,0.14)] text-[var(--ink)]'
          : 'border-[var(--border)] bg-white/5 text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]',
      ].join(' ')}
    >
      <span className={`h-2 w-2 rounded-full ${value ? 'bg-[var(--accent)]' : 'bg-[rgba(148,163,184,0.45)]'}`} />
      {label}
    </button>
  )
}

export function JobHeader({
  job,
  onToggle,
}: {
  job: Job
  onToggle: (field: 'autoMerge' | 'requireReview', value: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[rgba(8,11,16,0.82)] px-5 py-4 backdrop-blur-xl">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="rounded-full border border-[var(--border)] bg-white/5 px-2.5 py-1 font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.28em] text-[var(--muted)]">
          #{job.refNum}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[var(--ink)]">{job.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            <span>{job.agentId ?? 'unassigned'}</span>
            {job.repoId && <span>repo {job.repoId}</span>}
            {job.branchName && <span>{job.branchName}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-[0.62rem] uppercase tracking-[0.25em] ${TYPE_COLOR[job.type]}`}>
          {job.type}
        </span>
        <span className={`rounded-full border px-3 py-1 text-[0.62rem] uppercase tracking-[0.25em] ${STATUS_COLOR[job.status]}`}>
          {job.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-l border-[var(--border)] pl-3">
        <Toggle label="auto-merge" value={job.autoMerge} onChange={next => onToggle('autoMerge', next)} />
        <Toggle label="require-review" value={job.requireReview} onChange={next => onToggle('requireReview', next)} />
      </div>
    </div>
  )
}
