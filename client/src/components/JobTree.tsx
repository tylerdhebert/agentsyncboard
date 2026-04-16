import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import type { Folder, InputRequest, Job } from '../api/types'

const STATUS_ACCENT: Record<Job['status'], string> = {
  open: '#64748b',
  'in-progress': '#f59e0b',
  blocked: '#f87171',
  'in-review': '#a78bfa',
  done: '#34d399',
}

const STATUS_TEXT: Record<Job['status'], string> = {
  open: 'text-slate-400',
  'in-progress': 'text-amber-400',
  blocked: 'text-rose-400',
  'in-review': 'text-violet-400',
  done: 'text-emerald-400',
}

const STATUS_LABEL: Record<Job['status'], string> = {
  open: 'open',
  'in-progress': 'running',
  blocked: 'blocked',
  'in-review': 'review',
  done: 'done',
}

const TYPE_COLOR: Record<Job['type'], string> = {
  goal: 'text-sky-400',
  plan: 'text-violet-400',
  review: 'text-fuchsia-400',
  analysis: 'text-slate-400',
  arch: 'text-cyan-400',
  convo: 'text-orange-400',
  impl: 'text-emerald-400',
}

function JobRow({
  job,
  depth,
  dragJobId,
  setDragJobId,
  hasChildren = false,
  collapsed = false,
  onToggle,
  hasPendingInput = false,
}: {
  job: Job
  depth: number
  dragJobId: string | null
  setDragJobId: (id: string | null) => void
  hasChildren?: boolean
  collapsed?: boolean
  onToggle?: () => void
  hasPendingInput?: boolean
}) {
  const selectedJobId = useStore(state => state.selectedJobId)
  const setSelectedJobId = useStore(state => state.setSelectedJobId)
  const setActiveTab = useStore(state => state.setActiveTab)

  const isSelected = selectedJobId === job.id
  const isDragging = dragJobId === job.id
  const isSubJob = !!job.parentJobId

  const showBadges = job.status === 'blocked' || hasPendingInput || !!job.conflictedAt

  return (
    <div
      draggable={!isSubJob}
      onDragStart={isSubJob ? undefined : (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('jobId', job.id)
        setDragJobId(job.id)
      }}
      onDragEnd={isSubJob ? undefined : () => setDragJobId(null)}
      onClick={() => {
        setSelectedJobId(job.id)
        setActiveTab('detail')
      }}
      style={{ marginLeft: depth * 16, cursor: isDragging ? 'grabbing' : 'pointer' }}
      className={[
        'group relative flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition select-none',
        isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
        isDragging ? 'opacity-50' : '',
      ].join(' ')}
    >
      {isSelected && (
        <span
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
          style={{ background: STATUS_ACCENT[job.status] }}
        />
      )}

      {/* Chevron + status dot column */}
      <div className="flex flex-shrink-0 flex-col items-center gap-1 pt-[3px]">
        {hasChildren ? (
          <span
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggle?.() }}
            className="text-[10px] text-[var(--dim)] transition-transform hover:text-[var(--muted)]"
            style={{ display: 'inline-block', transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▸
          </span>
        ) : (
          <span className="text-[10px] opacity-0">▸</span>
        )}
        <span
          className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
          style={{ background: STATUS_ACCENT[job.status] }}
        />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-snug text-[var(--ink)]">
          {job.title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug">
          <span className={TYPE_COLOR[job.type]}>{job.type}</span>
          {job.agentId && (
            <>
              <span className="text-[var(--dim)]"> | </span>
              <span className="text-amber-300/70">{job.agentId.slice(0, 14)}</span>
            </>
          )}
          <span className="text-[var(--dim)]"> | </span>
          <span className={STATUS_TEXT[job.status]}>{STATUS_LABEL[job.status]}</span>
        </span>
        {job.branchName && (
          <span className="mt-0.5 block font-mono text-[10px] text-[var(--dim)]">
            {job.branchName}
          </span>
        )}
      </div>

      {/* Ref number + badges column */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-[11px] text-[var(--dim)]">#{job.refNum}</span>
        {showBadges && (
          <div className="flex flex-col items-end gap-0.5">
            {job.status === 'blocked' && (
              <span title="blocked" className="text-rose-400">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="3.5,0 6.5,0 10,3.5 10,6.5 6.5,10 3.5,10 0,6.5 0,3.5" />
                </svg>
              </span>
            )}
            {hasPendingInput && (
              <span title="waiting for input" className="flex h-[10px] w-[10px] items-center justify-center rounded-full bg-amber-400/20 font-bold text-[8px] leading-none text-amber-400">
                !
              </span>
            )}
            {job.conflictedAt && (
              <span title="merge conflict" className="flex h-[10px] w-[10px] items-center justify-center rounded-full bg-orange-400/20 font-bold text-[8px] leading-none text-orange-400">
                ⚡
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function JobBranch({
  job,
  jobs,
  depth,
  dragJobId,
  setDragJobId,
  collapsedJobIds,
  onToggleCollapsed,
  pendingInputJobIds,
}: {
  job: Job
  jobs: Job[]
  depth: number
  dragJobId: string | null
  setDragJobId: (id: string | null) => void
  collapsedJobIds: Set<string>
  onToggleCollapsed: (id: string) => void
  pendingInputJobIds: Set<string>
}) {
  const children = jobs
    .filter(entry => entry.parentJobId === job.id)
    .sort((a, b) => a.refNum - b.refNum)

  const collapsed = collapsedJobIds.has(job.id)

  return (
    <div className="space-y-0.5">
      <JobRow
        job={job}
        depth={depth}
        dragJobId={dragJobId}
        setDragJobId={setDragJobId}
        hasChildren={children.length > 0}
        collapsed={collapsed}
        onToggle={() => onToggleCollapsed(job.id)}
        hasPendingInput={pendingInputJobIds.has(job.id)}
      />
      {!collapsed && children.map(child => (
        <JobBranch
          key={child.id}
          job={child}
          jobs={jobs}
          depth={depth + 1}
          dragJobId={dragJobId}
          setDragJobId={setDragJobId}
          collapsedJobIds={collapsedJobIds}
          onToggleCollapsed={onToggleCollapsed}
          pendingInputJobIds={pendingInputJobIds}
        />
      ))}
    </div>
  )
}

function countJobBranch(jobId: string, allJobs: Job[]): number {
  const children = allJobs.filter(job => job.parentJobId === jobId)
  return 1 + children.reduce((sum, child) => sum + countJobBranch(child.id, allJobs), 0)
}

function countJobsInFolder(folderId: string, allFolders: Folder[], allJobs: Job[]): number {
  const rootJobs = allJobs.filter(job => job.folderId === folderId && !job.parentJobId)
  const nestedJobCount = rootJobs.reduce((sum, job) => sum + countJobBranch(job.id, allJobs), 0)
  const subFolders = allFolders.filter(folder => folder.parentFolderId === folderId)
  return nestedJobCount + subFolders.reduce((sum, folder) => sum + countJobsInFolder(folder.id, allFolders, allJobs), 0)
}

function isFolderDescendant(folderId: string, potentialParentId: string, allFolders: Folder[]): boolean {
  let current = allFolders.find(folder => folder.id === potentialParentId) ?? null

  while (current) {
    if (current.parentFolderId === folderId) {
      return true
    }
    current = current.parentFolderId
      ? (allFolders.find(folder => folder.id === current?.parentFolderId) ?? null)
      : null
  }

  return false
}

function FolderBranch({
  folder,
  folders,
  jobs,
  depth,
  dragJobId,
  setDragJobId,
  dragFolderId,
  setDragFolderId,
  dropTargetFolderId,
  setDropTargetFolderId,
  onJobDrop,
  onFolderDrop,
  collapsedJobIds,
  onToggleCollapsed,
  pendingInputJobIds,
  collapsedFolderIds,
  onToggleFolderCollapsed,
}: {
  folder: Folder
  folders: Folder[]
  jobs: Job[]
  depth: number
  dragJobId: string | null
  setDragJobId: (id: string | null) => void
  dragFolderId: string | null
  setDragFolderId: (id: string | null) => void
  dropTargetFolderId: string | null
  setDropTargetFolderId: (id: string | null) => void
  onJobDrop: (jobId: string, folderId: string | null) => void
  onFolderDrop: (folderId: string, parentFolderId: string | null) => void
  collapsedJobIds: Set<string>
  onToggleCollapsed: (id: string) => void
  pendingInputJobIds: Set<string>
  collapsedFolderIds: Set<string>
  onToggleFolderCollapsed: (id: string) => void
}) {
  const collapsed = collapsedFolderIds.has(folder.id)

  const childFolders = folders
    .filter(entry => entry.parentFolderId === folder.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const childJobs = jobs
    .filter(entry => entry.folderId === folder.id && !entry.parentJobId)
    .sort((a, b) => a.refNum - b.refNum)

  const isDropTarget = dropTargetFolderId === folder.id
  const hasChildren = childFolders.length > 0 || childJobs.length > 0
  const totalJobCount = countJobsInFolder(folder.id, folders, jobs)

  return (
    <div>
      {/* Folder header — clickable to toggle + droppable for DnD */}
      <button
        onClick={() => onToggleFolderCollapsed(folder.id)}
        draggable
        onDragStart={(e: React.DragEvent<HTMLButtonElement>) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('folderId', folder.id)
          setDragFolderId(folder.id)
        }}
        onDragEnd={() => {
          setDragFolderId(null)
          setDropTargetFolderId(null)
        }}
        onDragOver={(e: React.DragEvent<HTMLButtonElement>) => {
          const draggedFolderId = e.dataTransfer.getData('folderId') || dragFolderId
          if (draggedFolderId) {
            if (draggedFolderId === folder.id || isFolderDescendant(draggedFolderId, folder.id, folders)) {
              return
            }
          }
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropTargetFolderId(folder.id)
        }}
        onDragLeave={() => setDropTargetFolderId(null)}
        onDrop={(e: React.DragEvent<HTMLButtonElement>) => {
          e.preventDefault()
          const jobId = e.dataTransfer.getData('jobId')
          const folderId = e.dataTransfer.getData('folderId')
          if (jobId) onJobDrop(jobId, folder.id)
          if (folderId && folderId !== folder.id && !isFolderDescendant(folderId, folder.id, folders)) {
            onFolderDrop(folderId, folder.id)
          }
          setDropTargetFolderId(null)
          setDragFolderId(null)
        }}
        style={{ marginLeft: depth * 16, cursor: 'pointer' }}
        className={[
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-white/[0.04]',
          isDropTarget ? 'bg-sky-500/15 ring-1 ring-sky-500/30' : '',
        ].join(' ')}
      >
        <span
          className="text-[10px] text-[var(--dim)] transition-transform"
          style={{ display: 'inline-block', transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
        >
          ▸
        </span>
        <span
          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center"
          style={{ color: folder.color ?? 'rgba(125, 211, 252, 0.8)' }}
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
            <path
              d="M1.75 4A1.75 1.75 0 0 1 3.5 2.25h2.39c.557 0 1.018.285 1.4.654.408.393.8.846 1.46.846h3.75A1.75 1.75 0 0 1 14.25 5.5v6A1.75 1.75 0 0 1 12.5 13.25h-9A1.75 1.75 0 0 1 1.75 11.5V4Z"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
            <path
              d="M1.75 5.75h12.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--muted)]">
          {folder.name}
        </span>
        {totalJobCount > 0 && (
          <span className="flex-shrink-0 text-[10px] text-[var(--dim)]">
            {totalJobCount}
          </span>
        )}
      </button>

      {!collapsed && hasChildren && (
        <div className="mt-1 space-y-1" style={{ marginLeft: depth * 16 + 20 }}>
          {childFolders.map(child => (
            <FolderBranch
              key={child.id}
              folder={child}
              folders={folders}
              jobs={jobs}
              depth={0}
              dragJobId={dragJobId}
              setDragJobId={setDragJobId}
              dragFolderId={dragFolderId}
              setDragFolderId={setDragFolderId}
              dropTargetFolderId={dropTargetFolderId}
              setDropTargetFolderId={setDropTargetFolderId}
              onJobDrop={onJobDrop}
              onFolderDrop={onFolderDrop}
              collapsedJobIds={collapsedJobIds}
              onToggleCollapsed={onToggleCollapsed}
              pendingInputJobIds={pendingInputJobIds}
              collapsedFolderIds={collapsedFolderIds}
              onToggleFolderCollapsed={onToggleFolderCollapsed}
            />
          ))}
          {childJobs.map(job => (
            <JobBranch
              key={job.id}
              job={job}
              jobs={jobs}
              depth={0}
              dragJobId={dragJobId}
              setDragJobId={setDragJobId}
              collapsedJobIds={collapsedJobIds}
              onToggleCollapsed={onToggleCollapsed}
              pendingInputJobIds={pendingInputJobIds}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function JobTree() {
  const [dragJobId, setDragJobId] = useState<string | null>(null)
  const [dragFolderId, setDragFolderId] = useState<string | null>(null)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null)
  const [dropTargetRoot, setDropTargetRoot] = useState(false)
  const [collapsedJobIds, setCollapsedJobIds] = useState<Set<string>>(new Set())
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set())

  const queryClient = useQueryClient()

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: queryKeys.jobs,
    queryFn: () => unwrap(api.jobs.get()),
    refetchInterval: 30_000,
  })

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: queryKeys.folders,
    queryFn: () => unwrap(api.folders.get()),
    refetchInterval: 60_000,
  })

  const { data: pendingInputs = [] } = useQuery({
    queryKey: queryKeys.inputPending,
    queryFn: () => unwrap(api.input.pending.get()),
    refetchInterval: 30_000,
  })

  const pendingInputJobIds = new Set(pendingInputs.map((i: InputRequest) => i.jobId))

  function toggleJobCollapsed(jobId: string) {
    setCollapsedJobIds(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  function toggleFolderCollapsed(folderId: string) {
    setCollapsedFolderIds(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const moveMutation = useMutation({
    mutationFn: ({ jobId, folderId }: { jobId: string; folderId: string | null }) =>
      unwrap(api.jobs({ id: jobId }).patch({ folderId: folderId ?? null })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
  })

  const moveFolderMutation = useMutation({
    mutationFn: ({ folderId, parentFolderId }: { folderId: string; parentFolderId: string | null }) =>
      unwrap(api.folders({ id: folderId }).patch({ parentFolderId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.folders }),
  })

  function handleDrop(jobId: string, folderId: string | null) {
    moveMutation.mutate({ jobId, folderId })
  }

  function handleFolderDrop(folderId: string, parentFolderId: string | null) {
    moveFolderMutation.mutate({ folderId, parentFolderId })
  }

  const rootFolders = folders
    .filter(folder => !folder.parentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const rootJobs = jobs
    .filter(job => !job.folderId && !job.parentJobId)
    .sort((a, b) => a.refNum - b.refNum)

  if (jobs.length === 0 && folders.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-[var(--muted)]">
        No jobs yet. Create the first one with <span className="text-[var(--ink)]">+</span>.
      </div>
    )
  }

  return (
    <div className="space-y-2 px-3 py-3">
      {rootFolders.map(folder => (
        <FolderBranch
          key={folder.id}
          folder={folder}
          folders={folders}
          jobs={jobs}
          depth={0}
          dragJobId={dragJobId}
          setDragJobId={setDragJobId}
          dragFolderId={dragFolderId}
          setDragFolderId={setDragFolderId}
          dropTargetFolderId={dropTargetFolderId}
          setDropTargetFolderId={setDropTargetFolderId}
          onJobDrop={handleDrop}
          onFolderDrop={handleFolderDrop}
          collapsedJobIds={collapsedJobIds}
          onToggleCollapsed={toggleJobCollapsed}
          pendingInputJobIds={pendingInputJobIds}
          collapsedFolderIds={collapsedFolderIds}
          onToggleFolderCollapsed={toggleFolderCollapsed}
        />
      ))}
      {rootJobs.map(job => (
        <JobBranch
          key={job.id}
          job={job}
          jobs={jobs}
          depth={0}
          dragJobId={dragJobId}
          setDragJobId={setDragJobId}
          collapsedJobIds={collapsedJobIds}
          onToggleCollapsed={toggleJobCollapsed}
          pendingInputJobIds={pendingInputJobIds}
        />
      ))}

      {(dragJobId || dragFolderId) && (
        <div
          onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault()
            setDropTargetRoot(true)
          }}
          onDragLeave={() => setDropTargetRoot(false)}
          onDrop={(e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault()
            const jobId = e.dataTransfer.getData('jobId')
            const folderId = e.dataTransfer.getData('folderId')
            if (jobId) {
              moveMutation.mutate({ jobId, folderId: null })
            }
            if (folderId) {
              moveFolderMutation.mutate({ folderId, parentFolderId: null })
            }
            setDragJobId(null)
            setDragFolderId(null)
            setDropTargetRoot(false)
          }}
          className={[
            'mx-2 mt-2 rounded-md border border-dashed py-2 text-center text-[10px] text-[var(--dim)] transition',
            dropTargetRoot
              ? 'border-sky-500/40 bg-sky-500/8 text-sky-400'
              : 'border-[var(--border)]',
          ].join(' ')}
        >
          drop here to move to top level
        </div>
      )}
    </div>
  )
}
