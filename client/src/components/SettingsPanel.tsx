import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Repo } from '../api/types'

type RepoForm = {
  name: string
  path: string
  baseBranch: string
  buildCommand: string
}

function RepoRow({ repo }: { repo: Repo }) {
  const queryClient = useQueryClient()
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

  const isDirty = useMemo(() => {
    return (
      draft.name.trim() !== repo.name ||
      draft.path.trim() !== repo.path ||
      draft.baseBranch.trim() !== repo.baseBranch ||
      draft.buildCommand.trim() !== (repo.buildCommand ?? '')
    )
  }, [draft, repo])

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
      await queryClient.invalidateQueries({ queryKey: queryKeys.repos })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => requestJson<{ ok: boolean }>(`/repos/${repo.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.repos })
    },
  })

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--ink)]">{repo.name}</div>
          <div className="mt-1 break-all font-[var(--font-mono)] text-[0.68rem] leading-relaxed text-[var(--muted)]">
            {repo.path}
          </div>
        </div>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="rounded-full border border-[rgba(248,113,113,0.22)] bg-[rgba(248,113,113,0.08)] px-3 py-1 text-[0.58rem] uppercase tracking-[0.25em] text-[var(--bad)] transition hover:bg-[rgba(248,113,113,0.14)] disabled:opacity-50"
        >
          delete
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <input
          value={draft.name}
          onChange={event => setDraft(state => ({ ...state, name: event.target.value }))}
          placeholder="Repository name"
          className="w-full rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.78)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
        />
        <input
          value={draft.path}
          onChange={event => setDraft(state => ({ ...state, path: event.target.value }))}
          placeholder="Absolute path"
          className="w-full rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.78)] px-3 py-2 font-[var(--font-mono)] text-[0.8rem] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={draft.baseBranch}
            onChange={event => setDraft(state => ({ ...state, baseBranch: event.target.value }))}
            placeholder="Base branch"
            className="w-full rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.78)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
          />
          <input
            value={draft.buildCommand}
            onChange={event => setDraft(state => ({ ...state, buildCommand: event.target.value }))}
            placeholder="Build command"
            className="w-full rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.78)] px-3 py-2 font-[var(--font-mono)] text-[0.8rem] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-[var(--font-ui)] text-[0.56rem] uppercase tracking-[0.3em] text-[var(--muted)]">
            update repo settings
          </span>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!isDirty || updateMutation.isPending}
            className="rounded-full border border-[rgba(125,211,252,0.28)] bg-[rgba(56,189,248,0.16)] px-4 py-2 text-[0.62rem] uppercase tracking-[0.25em] text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.22)] disabled:opacity-50"
          >
            save
          </button>
        </div>
      </div>
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-[rgba(2,4,8,0.78)] px-4 py-5 backdrop-blur-2xl"
      onClick={onClose}
    >
      <div
        className="glass-panel flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border-[rgba(125,211,252,0.16)] bg-[rgba(9,12,18,0.96)] shadow-[0_30px_100px_rgba(0,0,0,0.45)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <div className="font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.35em] text-[var(--accent)]">
              settings
            </div>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ink)]">Repositories</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1.5 font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.25em] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          >
            close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {repos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-6 text-sm text-[var(--muted)]">
                No repos configured yet.
              </div>
            ) : (
              repos.map(repo => <RepoRow key={repo.id} repo={repo} />)
            )}
          </div>

          <div className="mt-6 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.32em] text-[var(--muted)]">
              add repository
            </div>
            <div className="mt-4 grid gap-3">
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Name"
                className="w-full rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.78)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
              />
              <input
                value={path}
                onChange={event => setPath(event.target.value)}
                placeholder="Absolute path"
                className="w-full rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.78)] px-3 py-2 font-[var(--font-mono)] text-[0.8rem] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={baseBranch}
                  onChange={event => setBaseBranch(event.target.value)}
                  placeholder="Base branch"
                  className="w-full rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.78)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
                />
                <input
                  value={buildCommand}
                  onChange={event => setBuildCommand(event.target.value)}
                  placeholder="Build command (optional)"
                  className="w-full rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.78)] px-3 py-2 font-[var(--font-mono)] text-[0.8rem] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-[var(--font-ui)] text-[0.56rem] uppercase tracking-[0.3em] text-[var(--muted)]">
                  add a new repo for impl worktrees
                </span>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!name.trim() || !path.trim() || createMutation.isPending}
                  className="rounded-full border border-[rgba(125,211,252,0.28)] bg-[rgba(56,189,248,0.16)] px-4 py-2 text-[0.62rem] uppercase tracking-[0.25em] text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.22)] disabled:opacity-50"
                >
                  add repo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
