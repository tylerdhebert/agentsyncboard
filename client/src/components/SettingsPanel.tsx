import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { queryKeys } from '../api/keys'
import type { JobType, Repo, JobTypeMandate } from '../api/types'
import { PathPicker } from './PathPicker'
import { useStore } from '../store'

const SHIKI_THEMES = [
  { id: 'github-dark-dimmed', label: 'GitHub Dimmed' },
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'one-dark-pro', label: 'One Dark Pro' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord', label: 'Nord' },
  { id: 'tokyo-night', label: 'Tokyo Night' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'night-owl', label: 'Night Owl' },
  { id: 'rose-pine', label: 'Rosé Pine' },
  { id: 'synthwave-84', label: 'Synthwave \'84' },
  { id: 'kanagawa-wave', label: 'Kanagawa Wave' },
  { id: 'vitesse-dark', label: 'Vitesse Dark' },
  { id: 'vesper', label: 'Vesper' },
  { id: 'material-theme-darker', label: 'Material Darker' },
  { id: 'min-dark', label: 'Min Dark' },
] as const

const THEME_ACCENTS: Record<string, string> = {
  'github-dark-dimmed': '#539bf5',
  'github-dark': '#58a6ff',
  'one-dark-pro': '#61afef',
  'dracula': '#bd93f9',
  'nord': '#88c0d0',
  'tokyo-night': '#7aa2f7',
  'catppuccin-mocha': '#89b4fa',
  'monokai': '#a6e22e',
  'night-owl': '#82aaff',
  'rose-pine': '#c4a7e7',
  'synthwave-84': '#ff7edb',
  'kanagawa-wave': '#7e9cd8',
  'vitesse-dark': '#4d9375',
  'vesper': '#ffc799',
  'material-theme-darker': '#82aaff',
  'min-dark': '#6699cc',
}

function AppearanceTab() {
  const codeTheme = useStore(state => state.codeTheme)
  const setCodeTheme = useStore(state => state.setCodeTheme)

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">theme</div>
        <div className="grid grid-cols-2 gap-1.5">
          {SHIKI_THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => setCodeTheme(t.id)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-[12px] font-medium transition ${
                codeTheme === t.id
                  ? 'border-[var(--accent)] bg-[rgba(125,211,252,0.08)] text-[var(--ink)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]'
              }`}
            >
              <span
                className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: THEME_ACCENTS[t.id] }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

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
      unwrap(api.repos({ id: repo.id }).patch({
        name: draft.name.trim(),
        path: draft.path.trim(),
        baseBranch: draft.baseBranch.trim(),
        ...(draft.buildCommand.trim() ? { buildCommand: draft.buildCommand.trim() } : {}),
      })),
    onSuccess: async () => {
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.repos })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => unwrap(api.repos({ id: repo.id }).delete()),
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
              <Label>name</Label>
              <input value={draft.name} onChange={e => setDraft(s => ({ ...s, name: e.target.value }))} className={inputCls} placeholder="repository name" />
            </div>
            <div>
              <Label>path</Label>
              <PathPicker value={draft.path} onChange={p => setDraft(s => ({ ...s, path: p }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>base branch</Label>
                <input value={draft.baseBranch} onChange={e => setDraft(s => ({ ...s, baseBranch: e.target.value }))} className={inputCls} placeholder="main" />
              </div>
              <div>
                <Label>build command</Label>
                <input value={draft.buildCommand} onChange={e => setDraft(s => ({ ...s, buildCommand: e.target.value }))} className={monoInputCls} placeholder="bun run build" />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={!isDirty || updateMutation.isPending}
                className="rounded-md bg-[var(--accent-strong)] px-3 py-1.5 text-[12px] font-medium text-[#0a0c11] transition hover:opacity-90 disabled:opacity-40"
              >
                save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const JOB_TYPES = ['impl', 'plan', 'review', 'goal', 'convo'] as const

function JobInstructionsTab({ repos }: { repos: Repo[] }) {
  const queryClient = useQueryClient()
  const [selectedContext, setSelectedContext] = useState('global')
  const [savedType, setSavedType] = useState<string | null>(null)
  const [removedType, setRemovedType] = useState<string | null>(null)

  const { data: mandates = [] } = useQuery<JobTypeMandate[]>({
    queryKey: queryKeys.mandates(selectedContext),
    queryFn: () => unwrap(api.mandates.get({ query: { repoId: selectedContext } })),
  })

  const saveMutation = useMutation({
    mutationFn: ({ type, filePath }: { type: JobType; filePath: string }) =>
      unwrap(api.mandates.put({
        type,
        ...(selectedContext !== 'global' ? { repoId: selectedContext } : {}),
        filePath,
      })),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.mandates(selectedContext) })
      setSavedType(variables.type)
      setTimeout(() => setSavedType(t => t === variables.type ? null : t), 2000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string; type: string }) =>
      unwrap(api.mandates({ id }).delete()),
    onSuccess: async (_, variables: { id: string; type: string }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.mandates(selectedContext) })
      setSavedType(t => (t === variables.type ? null : t))
      setRemovedType(variables.type)
      setTimeout(() => setRemovedType(t => (t === variables.type ? null : t)), 2000)
    },
  })

  return (
    <div className="space-y-4">
      <select
        value={selectedContext}
        onChange={e => setSelectedContext(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--border-strong)]"
      >
        <option value="global">global</option>
        {repos.map(repo => (
          <option key={repo.id} value={repo.id}>{repo.name}</option>
        ))}
      </select>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="pb-2 pr-4 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--dim)] w-28">job type</th>
            <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">instructions file</th>
          </tr>
        </thead>
        <tbody>
          {JOB_TYPES.map(type => {
            const mandate = mandates.find(m => m.type === type)
            const isDeleting = mandate ? deleteMutation.isPending && deleteMutation.variables?.id === mandate.id : false
            return (
              <tr key={type} className="border-b border-[var(--border)] last:border-0">
                <td className="py-3 pr-4 text-[13px] text-[var(--ink)] align-top w-28">{type}</td>
                <td className="py-3 align-top">
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <PathPicker
                          selectFiles
                          value={mandate?.filePath ?? ''}
                          onChange={filePath => {
                            if (filePath) saveMutation.mutate({ type, filePath })
                          }}
                          placeholder="no file configured"
                        />
                      </div>
                      {mandate && (
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate({ id: mandate.id, type })}
                          disabled={isDeleting}
                          className="rounded-md border border-rose-500/20 bg-rose-500/6 px-2.5 py-2 text-[11px] text-rose-300 transition hover:bg-rose-500/12 hover:text-rose-200 disabled:opacity-40"
                        >
                          {isDeleting ? 'removing...' : 'remove'}
                        </button>
                      )}
                    </div>
                    {savedType === type && (
                      <div className="text-[11px] text-emerald-400/80">saved</div>
                    )}
                    {removedType === type && (
                      <div className="text-[11px] text-rose-300/80">removed</div>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'repos' | 'instructions' | 'appearance'>('repos')
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [baseBranch, setBaseBranch] = useState('main')
  const [buildCommand, setBuildCommand] = useState('')

  const { data: repos = [] } = useQuery<Repo[]>({
    queryKey: queryKeys.repos,
    queryFn: () => unwrap(api.repos.get()),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      unwrap(api.repos.post({
        name: name.trim(),
        path: path.trim(),
        baseBranch: baseBranch.trim() || 'main',
        ...(buildCommand.trim() ? { buildCommand: buildCommand.trim() } : {}),
      })),
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
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{ background: '#111520', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--ink)]">settings</h2>
            <p className="mt-0.5 text-[12px] text-[var(--dim)]">manage repositories for impl jobs</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex flex-shrink-0 border-b border-[var(--border)] px-5">
          <button
            onClick={() => setTab('repos')}
            className={`px-4 py-3 text-[12px] font-medium transition border-b-2 -mb-px ${
              tab === 'repos'
                ? 'border-[var(--accent)] text-[var(--ink)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            repositories
          </button>
          <button
            onClick={() => setTab('instructions')}
            className={`px-4 py-3 text-[12px] font-medium transition border-b-2 -mb-px ${
              tab === 'instructions'
                ? 'border-[var(--accent)] text-[var(--ink)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            job instructions
          </button>
          <button
            onClick={() => setTab('appearance')}
            className={`px-4 py-3 text-[12px] font-medium transition border-b-2 -mb-px ${
              tab === 'appearance'
                ? 'border-[var(--accent)] text-[var(--ink)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            appearance
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'repos' && (
            <>
              {/* Existing repos */}
              {repos.length > 0 ? (
                <div className="mb-6 space-y-2">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">repositories</div>
                  {repos.map(repo => <RepoCard key={repo.id} repo={repo} />)}
                </div>
              ) : (
                <div className="mb-6 rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-[13px] text-[var(--dim)]">
                  no repositories yet.
                </div>
              )}

              {/* Add new */}
              <div>
                <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">add repository</div>
                <div className="grid gap-3">
                  <div>
                    <Label>name</Label>
                    <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="my-repo" />
                  </div>
                  <div>
                    <Label>path</Label>
                    <PathPicker value={path} onChange={setPath} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>base branch</Label>
                      <input value={baseBranch} onChange={e => setBaseBranch(e.target.value)} className={inputCls} placeholder="main" />
                    </div>
                    <div>
                      <Label>build command</Label>
                      <input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} className={monoInputCls} placeholder="bun run build" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => createMutation.mutate()}
                      disabled={!name.trim() || !path.trim() || createMutation.isPending}
                      className="rounded-md bg-[var(--accent-strong)] px-3 py-1.5 text-[12px] font-medium text-[#0a0c11] transition hover:opacity-90 disabled:opacity-40"
                    >
                      {createMutation.isPending ? 'adding…' : 'add repository'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'instructions' && (
            <JobInstructionsTab repos={repos} />
          )}

          {tab === 'appearance' && (
            <AppearanceTab />
          )}
        </div>
      </div>
    </div>
  )
}
