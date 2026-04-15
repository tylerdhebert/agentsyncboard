import type { Job } from '../api/types'

const STATUS_ACCENT: Record<Job['status'], string> = {
  open: '#64748b',
  'in-progress': '#f59e0b',
  blocked: '#f87171',
  'in-review': '#a78bfa',
  done: '#34d399',
}

const STATUS_COLOR: Record<Job['status'], string> = {
  open: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  'in-progress': 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  blocked: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  'in-review': 'border-violet-400/20 bg-violet-400/10 text-violet-200',
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
      {/* Track */}
      <span
        className={[
          'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border transition-colors duration-200',
          value
            ? 'border-sky-400/40 bg-sky-500/30'
            : 'border-white/10 bg-white/[0.06]',
        ].join(' ')}
      >
        {/* Thumb */}
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
  onDelete,
}: {
  job: Job
  onToggle: (field: 'autoMerge' | 'requireReview', value: boolean) => void
  onDelete: () => void
}) {
  return (
    <div
      className="flex flex-col border-b border-[var(--border)]"
      style={{
        background: 'rgba(10, 13, 20, 0.9)',
        borderLeft: `3px solid ${STATUS_ACCENT[job.status]}`,
      }}
    >
      {/* Row 1: ref · title · badges (tight together) · spacer · trash */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="flex-shrink-0 font-mono text-[11px] text-[var(--dim)]">#{job.refNum}</span>
        {/* Title truncates, badges follow immediately after it */}
        <h2 className="min-w-0 shrink truncate text-[15px] font-semibold text-[var(--ink)]">
          {job.title}
        </h2>
        <span className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${TYPE_COLOR[job.type]}`}>
          {job.type}
        </span>
        <span className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${STATUS_COLOR[job.status]}`}>
          {job.status}
        </span>
        {/* Push trash to far right */}
        <span className="flex-1" />
        <button
          onClick={onDelete}
          title="Delete job"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--dim)] transition hover:bg-rose-500/10 hover:text-rose-400"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z" />
            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z" />
          </svg>
        </button>
      </div>

      {/* Row 2: meta left, switches centered, spacer right */}
      <div className="flex items-center px-4 pb-2.5">
        {/* Left: agent / branch */}
        <div className="flex flex-1 items-center gap-2 text-[11px] text-[var(--dim)]">
          {job.agentId && <span className="truncate max-w-[120px]">{job.agentId}</span>}
          {job.branchName && <span className="font-mono truncate max-w-[160px]">{job.branchName}</span>}
          {!job.agentId && !job.branchName && <span>unassigned</span>}
        </div>

        {/* Center: switches */}
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

        {/* Right spacer to balance the left flex-1 */}
        <div className="flex-1" />
      </div>
    </div>
  )
}
