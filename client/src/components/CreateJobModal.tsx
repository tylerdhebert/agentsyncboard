import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import type { Job, Repo } from '../api/types'

type JobType = 'goal' | 'plan' | 'review' | 'analysis' | 'arch' | 'convo' | 'impl'

const JOB_TYPES: { id: JobType; label: string; description: string; color: string }[] = [
  { id: 'goal', label: 'Goal', description: 'High-level objective', color: 'border-sky-400/30 bg-sky-400/8 text-sky-300' },
  { id: 'plan', label: 'Plan', description: 'Planning & design work', color: 'border-violet-400/30 bg-violet-400/8 text-violet-300' },
  { id: 'review', label: 'Review', description: 'Code or artifact review', color: 'border-fuchsia-400/30 bg-fuchsia-400/8 text-fuchsia-300' },
  { id: 'analysis', label: 'Analysis', description: 'Research & investigation', color: 'border-slate-400/30 bg-slate-400/8 text-slate-300' },
  { id: 'arch', label: 'Arch', description: 'Architecture and system design', color: 'border-cyan-400/30 bg-cyan-400/8 text-cyan-300' },
  { id: 'convo', label: 'Convo', description: 'Conversation, discovery, or alignment', color: 'border-orange-400/30 bg-orange-400/8 text-orange-300' },
  { id: 'impl', label: 'Impl', description: 'Implementation with worktree', color: 'border-emerald-400/30 bg-emerald-400/8 text-emerald-300' },
]

const inputCls =
  'w-full rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--dim)] transition focus:border-[var(--border-strong)] focus:bg-[rgba(255,255,255,0.06)]'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CreateJobModal({ onClose }: { onClose: () => void }) {
  const setSelectedJobId = useStore(state => state.setSelectedJobId)
  const setActiveTab = useStore(state => state.setActiveTab)
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [type, setType] = useState<JobType>('goal')
  const [repoId, setRepoId] = useState('')
  const [branchName, setBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('main')

  const { data: repos = [] } = useQuery<Repo[]>({
    queryKey: queryKeys.repos,
    queryFn: () => requestJson<Repo[]>('/repos'),
  })

  // Auto-fill branch name from title
  useEffect(() => {
    if (type === 'impl') {
      setBranchName(`agent/${slugify(title)}`)
    } else if (type === 'goal') {
      setBranchName(`feature/${slugify(title)}`)
    }
  }, [title, type])

  // Auto-fill base branch when repo is selected
  useEffect(() => {
    const repo = repos.find(r => r.id === repoId)
    if (repo) setBaseBranch(repo.baseBranch)
  }, [repoId, repos])

  // Default to first repo
  useEffect(() => {
    if ((type === 'impl' || type === 'goal') && !repoId && repos.length > 0) {
      setRepoId(repos[0].id)
    }
  }, [type, repos, repoId])

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (type === 'impl') return !!repoId && !!branchName.trim()
    if (type === 'goal' && repoId) return !!branchName.trim()
    return true
  }, [title, type, repoId, branchName])

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = { title: title.trim(), type }
      if (type === 'impl') {
        body.repoId = repoId
        body.branchName = branchName.trim()
        body.baseBranch = baseBranch.trim() || 'main'
      }
      if (type === 'goal' && repoId) {
        body.repoId = repoId
        if (branchName.trim()) {
          body.branchName = branchName.trim()
          body.baseBranch = baseBranch.trim() || 'main'
        }
      }
      return requestJson<Job>('/jobs', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      setSelectedJobId(created.id)
      setActiveTab('detail')
      onClose()
    },
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
        createMutation.mutate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, canSubmit, createMutation])

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 7, 12, 0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{ background: '#111520' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">New job</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Title */}
          <div className="mb-4">
            <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">Title</div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputCls}
              placeholder="What needs to be done?"
            />
          </div>

          {/* Type selector */}
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium text-[var(--muted)]">Type</div>
            <div className="grid grid-cols-3 gap-1.5">
              {JOB_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={[
                    'flex flex-col items-center gap-1 rounded-md border py-2 transition',
                    type === t.id
                      ? t.color
                      : 'border-[var(--border)] bg-transparent text-[var(--dim)] hover:border-[var(--border-strong)] hover:text-[var(--muted)]',
                  ].join(' ')}
                >
                  <span className="text-[12px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--dim)]">
              {JOB_TYPES.find(t => t.id === type)?.description}
            </p>
          </div>

          {/* Goal optional repo+branch */}
          {type === 'goal' && (
            <div className="mb-4 space-y-3 rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-3">
              <div className="text-[11px] text-[var(--dim)]">
                Optional: attach a repo to create an integration branch when this goal is claimed.
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">Repository</div>
                <select
                  value={repoId}
                  onChange={e => setRepoId(e.target.value)}
                  className={inputCls + ' cursor-pointer'}
                >
                  <option value="">None</option>
                  {repos.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              {repoId && (
                <div>
                  <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">Integration branch</div>
                  <input
                    value={branchName}
                    onChange={e => setBranchName(e.target.value)}
                    className={inputCls + ' font-mono'}
                    placeholder="feature/my-feature"
                  />
                </div>
              )}
            </div>
          )}

          {/* Impl-only fields */}
          {type === 'impl' && (
            <div className="mb-4 space-y-3 rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-3">
              <div>
                <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">Repository</div>
                {repos.length === 0 ? (
                  <div className="text-[12px] text-rose-400">
                    No repos configured. Add one in Settings first.
                  </div>
                ) : (
                  <select
                    value={repoId}
                    onChange={e => setRepoId(e.target.value)}
                    className={inputCls + ' cursor-pointer'}
                  >
                    {repos.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">Branch name</div>
                <input
                  value={branchName}
                  onChange={e => setBranchName(e.target.value)}
                  className={inputCls + ' font-mono'}
                  placeholder="agent/my-feature"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">Base branch</div>
                <input
                  value={baseBranch}
                  onChange={e => setBaseBranch(e.target.value)}
                  className={inputCls + ' font-mono'}
                  placeholder="main"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-[var(--dim)]">⌘↵ to create</span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="rounded-md bg-[var(--accent-strong)] px-3 py-1.5 text-[12px] font-medium text-[#0a0c11] transition hover:opacity-90 disabled:opacity-40"
              >
                {createMutation.isPending ? 'Creating…' : 'Create job'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
