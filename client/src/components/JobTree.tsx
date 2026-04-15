import { useQuery } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import type { Folder, Job } from '../api/types'

const STATUS_DOT: Record<Job['status'], string> = {
  open: 'bg-slate-500',
  'in-progress': 'bg-amber-400',
  blocked: 'bg-rose-400',
  'in-review': 'bg-violet-400',
  done: 'bg-emerald-400',
}

const TYPE_BADGE: Record<Job['type'], string> = {
  goal: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  plan: 'border-violet-400/25 bg-violet-400/10 text-violet-200',
  review: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200',
  analysis: 'border-slate-400/25 bg-slate-400/10 text-slate-200',
  impl: 'border-stone-400/25 bg-stone-400/10 text-stone-200',
}

function JobRow({ job, depth }: { job: Job; depth: number }) {
  const selectedJobId = useStore(state => state.selectedJobId)
  const setSelectedJobId = useStore(state => state.setSelectedJobId)
  const setActiveTab = useStore(state => state.setActiveTab)

  const isSelected = selectedJobId === job.id

  return (
    <button
      onClick={() => {
        setSelectedJobId(job.id)
        setActiveTab('detail')
      }}
      className={[
        'group flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition',
        isSelected
          ? 'border-[rgba(125,211,252,0.26)] bg-[rgba(56,189,248,0.11)] shadow-[0_12px_28px_rgba(0,0,0,0.2)]'
          : 'border-transparent bg-transparent hover:border-[var(--border)] hover:bg-white/[0.03]',
      ].join(' ')}
      style={{ marginLeft: depth * 14 }}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[job.status]}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9rem] text-[var(--ink)]">
          {job.type === 'impl' && job.branchName ? job.branchName : job.title}
        </span>
        <span className="block truncate font-[var(--font-ui)] text-[0.63rem] uppercase tracking-[0.24em] text-[var(--muted)]">
          #{job.refNum}
          {job.agentId ? ` · ${job.agentId}` : ''}
        </span>
      </span>
      <span className={`rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.2em] ${TYPE_BADGE[job.type]}`}>
        {job.type}
      </span>
      {job.conflictedAt && (
        <span className="rounded-full border border-[rgba(245,185,76,0.25)] bg-[rgba(245,185,76,0.12)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[var(--warn)]">
          conflict
        </span>
      )}
      {job.status === 'blocked' && (
        <span className="rounded-full border border-[rgba(248,113,113,0.24)] bg-[rgba(248,113,113,0.12)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[var(--bad)]">
          blocked
        </span>
      )}
    </button>
  )
}

function JobBranch({ job, jobs, depth }: { job: Job; jobs: Job[]; depth: number }) {
  const children = jobs
    .filter(entry => entry.parentJobId === job.id)
    .sort((a, b) => a.refNum - b.refNum)

  return (
    <div className="space-y-1">
      <JobRow job={job} depth={depth} />
      {children.map(child => (
        <JobBranch key={child.id} job={child} jobs={jobs} depth={depth + 1} />
      ))}
    </div>
  )
}

function FolderBranch({
  folder,
  folders,
  jobs,
  depth,
}: {
  folder: Folder
  folders: Folder[]
  jobs: Job[]
  depth: number
}) {
  const childFolders = folders
    .filter(entry => entry.parentFolderId === folder.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const childJobs = jobs
    .filter(entry => entry.folderId === folder.id && !entry.parentJobId)
    .sort((a, b) => a.refNum - b.refNum)

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2"
        style={{ marginLeft: depth * 14 }}
      >
        <span
          className="h-2.5 w-2.5 rounded-sm border border-[rgba(125,211,252,0.25)]"
          style={{ backgroundColor: folder.color ?? 'rgba(125, 211, 252, 0.18)' }}
        />
        <span className="min-w-0 flex-1 truncate text-[0.84rem] text-[var(--ink)]">{folder.name}</span>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.22em] text-[var(--muted)]">
          folder
        </span>
      </div>

      <div className="space-y-1">
        {childFolders.map(child => (
          <FolderBranch key={child.id} folder={child} folders={folders} jobs={jobs} depth={depth + 1} />
        ))}
        {childJobs.map(job => (
          <JobBranch key={job.id} job={job} jobs={jobs} depth={depth + 1} />
        ))}
      </div>
    </div>
  )
}

export function JobTree() {
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: queryKeys.jobs,
    queryFn: () => requestJson<Job[]>('/jobs'),
    refetchInterval: 30_000,
  })

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: queryKeys.folders,
    queryFn: () => requestJson<Folder[]>('/folders'),
    refetchInterval: 60_000,
  })

  const rootFolders = folders
    .filter(folder => !folder.parentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const rootJobs = jobs
    .filter(job => !job.folderId && !job.parentJobId)
    .sort((a, b) => a.refNum - b.refNum)

  if (jobs.length === 0 && folders.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-[var(--muted)]">
        No jobs yet. Create the first one with <span className="text-[var(--ink)]">+ job</span>.
      </div>
    )
  }

  return (
    <div className="space-y-4 px-3 py-3">
      {rootFolders.map(folder => (
        <FolderBranch key={folder.id} folder={folder} folders={folders} jobs={jobs} depth={0} />
      ))}
      {rootJobs.map(job => (
        <JobBranch key={job.id} job={job} jobs={jobs} depth={0} />
      ))}
    </div>
  )
}
