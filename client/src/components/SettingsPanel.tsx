import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Repo } from '../api/types'
import { PathPicker } from './PathPicker'

type RepoForm = {
  name: string
  path: string
  baseBranch: string
  buildCommand: string
}

const inputCls =
  'w-full rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--dim)] transition focus:border-[var(--border-strong)] focus:bg-[rgba(255,255,255,0.06)]'

const monoInputCls = inputCls + ' font-mono'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">{children}</div>
  )
}

function RepoCard({ repo }: { repo: Repo }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<RepoForm>({
    name: repo.name,
    path: repo.path,
    baseBranch: repo.baseBranch,
    buildCommand: repo.buildCommand ?? '',
  })

  useEffect(() => {
    setDraft({
      name: repo.name,
      path: repo.path,
      baseBranch: repo.baseBranch,
      buildCommand: repo.buildCommand ?? '',
    })
  }, [repo])

  const isDirty = useMemo(
    () =>
      draft.name.trim() !== repo.name ||
      draft.path.trim() !== repo.path ||
      draft.baseBranch.trim() !== repo.baseBranch ||
      draft.buildCommand.trim() !== (repo.buildCommand ?? ''),
    [draft, repo],
  )

  const updateMutation = useMutation({
    mutationFn: () =>
      requestJson<Repo>(`/repos/${repo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name.trim(),
          path: draft.path.trim(),
          baseBranch: draft.baseBranch.trim(),
          ...(draft.buildCommand.trim() ? { buildCommand: draft.buildCommand.trim() } : {}),
        }),
      }),
    onSuccess: async () => {
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.repos })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => requestJson<{ ok: boolean }>(`/repos/${repo.id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.repos }),
  })

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[var(--ink)]">{repo.name}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--dim)]">{repo.path}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOpen(v => !v)}
            className="rounded px-2.5 py-1 text-[11px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)]"
          >
            {open ? 'cancel' : 'edit'}
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="rounded px-2.5 py-1 text-[11px] text-rose-400/70 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
          >
            delete
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
          <div className="grid gap-3">
            <div>
              <Label>Name</Label>
              <input value={draft.name} onChange={e => setDraft(s => ({ ...s, name: e.target.value }))} className={inputCls} placeholder="Repository name" />
            </div>
            <div>
              <Label>Path</Label>
              <PathPicker value={draft.path} onChange={p => setDraft(s => ({ ...s, path: p }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Base branch</Label>
                <input value={draft.baseBranch} onChange={e => setDraft(s => ({ ...s, baseBranch: e.target.value }))} className={inputCls} placeholder="main" />
              </div>
              <div>
                <Label>Build command</Label>
                <input value={draft.buildCommand} onChange={e => setDraft(s => ({ ...s, buildCommand: e.target.value }))} className={monoInputCls} placeholder="bun run build" />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={!isDirty || updateMutation.isPending}
                className="rounded-md bg-[var(--accent-strong)] px-3 py-1.5 text-[12px] font-medium text-[#0a0c11] transition hover:opacity-90 disabled:opacity-40"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [baseBranch, setBaseBranch] = useState('main')
  const [buildCommand, setBuildCommand] = useState('')

  const { data: repos = [] } = useQuery<Repo[]>({
    queryKey: queryKeys.repos,
    queryFn: () => requestJson<Repo[]>('/repos'),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      requestJson<Repo>('/repos', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          path: path.trim(),
          baseBranch: baseBranch.trim() || 'main',
          ...(buildCommand.trim() ? { buildCommand: buildCommand.trim() } : {}),
        }),
      }),
    onSuccess: async () => {
      setName('')
      setPath('')
      setBaseBranch('main')
      setBuildCommand('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.repos })
    },
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 7, 12, 0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{ background: '#111520', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--ink)]">Settings</h2>
            <p className="mt-0.5 text-[12px] text-[var(--dim)]">Manage repositories for impl jobs</p>
          </div>
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
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Existing repos */}
          {repos.length > 0 ? (
            <div className="mb-6 space-y-2">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">Repositories</div>
              {repos.map(repo => <RepoCard key={repo.id} repo={repo} />)}
            </div>
          ) : (
            <div className="mb-6 rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-[13px] text-[var(--dim)]">
              No repositories yet.
            </div>
          )}

          {/* Add new */}
          <div>
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">Add repository</div>
            <div className="grid gap-3">
              <div>
                <Label>Name</Label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="my-repo" />
              </div>
              <div>
                <Label>Path</Label>
                <PathPicker value={path} onChange={setPath} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Base branch</Label>
                  <input value={baseBranch} onChange={e => setBaseBranch(e.target.value)} className={inputCls} placeholder="main" />
                </div>
                <div>
                  <Label>Build command</Label>
                  <input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} className={monoInputCls} placeholder="bun run build" />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!name.trim() || !path.trim() || createMutation.isPending}
                  className="rounded-md bg-[var(--accent-strong)] px-3 py-1.5 text-[12px] font-medium text-[#0a0c11] transition hover:opacity-90 disabled:opacity-40"
                >
                  {createMutation.isPending ? 'Adding…' : 'Add repository'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
