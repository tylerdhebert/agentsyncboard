import { useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import { JobTree } from './JobTree'
import type { Job, Repo } from '../api/types'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function Sidebar() {
  const sidebarCollapsed = useStore(state => state.sidebarCollapsed)
  const toggleSidebar = useStore(state => state.toggleSidebar)
  const setSelectedJobId = useStore(state => state.setSelectedJobId)
  const setActiveTab = useStore(state => state.setActiveTab)
  const pendingInputIds = useStore(state => state.pendingInputIds)
  const queryClient = useQueryClient()

  const { data: repos = [] } = useQuery<Repo[]>({
    queryKey: queryKeys.repos,
    queryFn: () => requestJson<Repo[]>('/repos'),
  })

  async function createJob() {
    const title = window.prompt('Job title?')
    if (!title?.trim()) return

    const typeRaw = window.prompt('Job type? (goal, plan, review, analysis, impl)', 'goal')
    const type = typeRaw?.trim().toLowerCase()
    if (!type || !['goal', 'plan', 'review', 'analysis', 'impl'].includes(type)) {
      window.alert('Please enter one of: goal, plan, review, analysis, impl.')
      return
    }

    const body: Record<string, string> = { title: title.trim(), type }

    if (type === 'impl') {
      if (repos.length === 0) {
        window.alert('Add a repo in Settings before creating an impl job.')
        return
      }

      const repoHint = repos.map(repo => `${repo.name} (${repo.id})`).join('\n')
      const repoId = window.prompt(`Repo id for the worktree?\n\n${repoHint}`)
      const branchName = window.prompt('Branch name?', `agent/${slugify(title)}`)
      if (!repoId?.trim() || !branchName?.trim()) return

      body.repoId = repoId.trim()
      body.branchName = branchName.trim()

      const repo = repos.find(entry => entry.id === body.repoId)
      const baseBranch = window.prompt('Base branch?', repo?.baseBranch ?? 'main')
      if (baseBranch?.trim()) {
        body.baseBranch = baseBranch.trim()
      }
    }

    const created = await requestJson<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
    setSelectedJobId(created.id)
    setActiveTab('detail')
  }

  if (sidebarCollapsed) {
    return (
      <aside className="flex w-10 flex-col items-center border-r border-[var(--border)] bg-[rgba(6,8,12,0.88)] py-4">
        <button
          onClick={toggleSidebar}
          className="mt-12 rounded-full border border-[var(--border)] bg-white/5 px-2 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:bg-white/10 hover:text-[var(--ink)]"
        >
          open
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex w-[20rem] min-w-[20rem] flex-col border-r border-[var(--border)] bg-[rgba(7,10,15,0.92)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.5em] text-[var(--muted)]">board</div>
          <div className="mt-1 text-xl font-semibold text-[var(--ink)]">agentsyncboard</div>
          <p className="mt-1 max-w-[12rem] text-[0.78rem] leading-relaxed text-[var(--muted)]">
            Nested folders, live jobs, and pending input all stay visible here.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={createJob}
            className="rounded-full border border-[rgba(125,211,252,0.28)] bg-[rgba(56,189,248,0.12)] px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.25em] text-[var(--ink)] transition hover:border-[rgba(125,211,252,0.5)] hover:bg-[rgba(56,189,248,0.2)]"
          >
            + job
          </button>
          <button
            onClick={toggleSidebar}
            className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1 text-[0.65rem] uppercase tracking-[0.25em] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          >
            collapse
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <JobTree />
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <div className="rounded-2xl border border-[rgba(245,185,76,0.18)] bg-[rgba(68,43,8,0.18)] px-3 py-2 text-[0.72rem] text-[var(--warn)] shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.3em] text-[rgba(245,185,76,0.85)]">
            pending input
          </div>
          <div className="mt-1">
            {pendingInputIds.length > 0
              ? `${pendingInputIds.length} blocking request${pendingInputIds.length === 1 ? '' : 's'} waiting for a human answer`
              : 'No blocking requests right now.'}
          </div>
        </div>
      </div>
    </aside>
  )
}
