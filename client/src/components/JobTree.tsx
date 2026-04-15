import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import type { Folder, Job } from '../api/types'

const STATUS_ACCENT: Record<Job['status'], string> = {
  open: '#64748b',
  'in-progress': '#f59e0b',
  blocked: '#f87171',
  'in-review': '#a78bfa',
  done: '#34d399',
}

const TYPE_LABEL: Record<Job['type'], string> = {
  goal: 'text-sky-400',
  plan: 'text-violet-400',
  review: 'text-fuchsia-400',
  analysis: 'text-slate-400',
  impl: 'text-slate-300',
}

function JobRow({
  job,
  depth,
  dragJobId,
  setDragJobId,
}: {
  job: Job
  depth: number
  dragJobId: string | null
  setDragJobId: (id: string | null) => void
}) {
  const selectedJobId = useStore(state => state.selectedJobId)
  const setSelectedJobId = useStore(state => state.setSelectedJobId)
  const setActiveTab = useStore(state => state.setActiveTab)

  const isSelected = selectedJobId === job.id
  const isDragging = dragJobId === job.id
  const isSubJob = !!job.parentJobId

  return (
    <button
      draggable={!isSubJob}
      onDragStart={isSubJob ? undefined : (e: React.DragEvent<HTMLButtonElement>) => {
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
        'group relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition',
        isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
        isDragging ? 'opacity-50' : '',
      ].join(' ')}
    >
      {isSelected && (
        <span
          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
          style={{ background: STATUS_ACCENT[job.status] }}
        />
      )}
      <span
        className="ml-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full"
        style={{ background: STATUS_ACCENT[job.status] }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[var(--ink)]">{job.title}</span>
        <span className="block truncate text-[11px] text-[var(--dim)]">
          #{job.refNum}{job.branchName ? ` · ${job.branchName}` : ''}{job.agentId ? ` · ${job.agentId.slice(0, 8)}` : ''}
        </span>
      </span>
      {/* Fixed-width type badge so it never gets clipped */}
      <span className={`w-[30px] flex-shrink-0 text-right text-[10px] font-mono ${TYPE_LABEL[job.type]}`}>
        {job.type.slice(0, 4)}
      </span>
      {job.conflictedAt && (
        <span className="flex-shrink-0 text-[10px] text-amber-400">!</span>
      )}
    </button>
  )
}

function JobBranch({
  job,
  jobs,
  depth,
  dragJobId,
  setDragJobId,
}: {
  job: Job
  jobs: Job[]
  depth: number
  dragJobId: string | null
  setDragJobId: (id: string | null) => void
}) {
  const children = jobs
    .filter(entry => entry.parentJobId === job.id)
    .sort((a, b) => a.refNum - b.refNum)

  return (
    <div className="space-y-1">
      <JobRow job={job} depth={depth} dragJobId={dragJobId} setDragJobId={setDragJobId} />
      {children.map(child => (
        <JobBranch
          key={child.id}
          job={child}
          jobs={jobs}
          depth={depth + 1}
          dragJobId={dragJobId}
          setDragJobId={setDragJobId}
        />
      ))}
    </div>
  )
}

function countJobsInFolder(folderId: string, allFolders: Folder[], allJobs: Job[]): number {
  const direct = allJobs.filter(j => j.folderId === folderId).length
  const subFolders = allFolders.filter(f => f.parentFolderId === folderId)
  return direct + subFolders.reduce((sum, f) => sum + countJobsInFolder(f.id, allFolders, allJobs), 0)
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
}) {
  const [collapsed, setCollapsed] = useState(false)

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
        onClick={() => setCollapsed(v => !v)}
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
          className="h-2 w-2 flex-shrink-0 rounded-sm"
          style={{ backgroundColor: folder.color ?? 'rgba(125, 211, 252, 0.4)' }}
        />
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

  const queryClient = useQueryClient()

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

  const moveMutation = useMutation({
    mutationFn: ({ jobId, folderId }: { jobId: string; folderId: string | null }) =>
      requestJson<Job>(`/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ folderId: folderId ?? null }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
  })

  const moveFolderMutation = useMutation({
    mutationFn: ({ folderId, parentFolderId }: { folderId: string; parentFolderId: string | null }) =>
      requestJson<Folder>(`/folders/${folderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ parentFolderId }),
      }),
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
    <div className="space-y-4 px-3 py-3">
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
