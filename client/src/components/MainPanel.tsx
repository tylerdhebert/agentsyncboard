import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore, type ActiveTab } from '../store'
import type { Job } from '../api/types'
import { JobHeader } from './JobHeader'
import { DetailTab } from './DetailTab'
import { DiffTab } from './DiffTab'
import { CommitsTab } from './CommitsTab'
import { BuildTab } from './BuildTab'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'detail', label: 'Detail' },
  { id: 'diff', label: 'Diff' },
  { id: 'commits', label: 'Commits' },
  { id: 'build', label: 'Build' },
]

export function MainPanel() {
  const selectedJobId = useStore(state => state.selectedJobId)
  const activeTab = useStore(state => state.activeTab)
  const setActiveTab = useStore(state => state.setActiveTab)
  const queryClient = useQueryClient()

  const { data: job, isPending, error } = useQuery<Job>({
    queryKey: selectedJobId ? queryKeys.job(selectedJobId) : ['job', 'none'],
    queryFn: () => requestJson<Job>(`/jobs/${selectedJobId}`),
    enabled: !!selectedJobId,
  })

  useEffect(() => {
    setActiveTab('detail')
  }, [selectedJobId, setActiveTab])

  const toggleMutation = useMutation({
    mutationFn: ({ field, value }: { field: 'autoMerge' | 'requireReview'; value: boolean }) =>
      requestJson<Job>(`/jobs/${selectedJobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      if (selectedJobId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.job(selectedJobId) })
      }
    },
  })

  if (!selectedJobId) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <div className="max-w-xl rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
          <div className="font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.4em] text-[var(--muted)]">
            no job selected
          </div>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--ink)]">
            Pick a job from the tree or create a new one.
          </h2>
          <p className="mt-3 text-[0.98rem] leading-relaxed text-[var(--muted)]">
            The right side becomes the job workspace once a row is selected.
          </p>
        </div>
      </div>
    )
  }

  if (isPending || !job) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <div className="rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-6 py-5 text-[0.95rem] text-[var(--muted)]">
          Loading job...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <JobHeader
        job={job}
        onToggle={(field, value) => toggleMutation.mutate({ field, value })}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[rgba(8,11,16,0.72)] px-5 py-3">
        {TABS.map(tab => {
          if (tab.id !== 'detail' && job.type !== 'impl') {
            return null
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'rounded-full px-4 py-1.5 font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.28em] transition',
                activeTab === tab.id
                  ? 'border border-[rgba(125,211,252,0.24)] bg-[rgba(56,189,248,0.12)] text-[var(--ink)]'
                  : 'border border-transparent bg-white/0 text-[var(--muted)] hover:border-[var(--border)] hover:bg-white/5 hover:text-[var(--ink)]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {job.type !== 'impl' || activeTab === 'detail' ? (
          <DetailTab job={job} />
        ) : activeTab === 'diff' ? (
          <DiffTab job={job} />
        ) : activeTab === 'commits' ? (
          <CommitsTab job={job} />
        ) : (
          <BuildTab job={job} />
        )}
      </div>

      {error && (
        <div className="border-t border-[var(--border)] bg-[rgba(248,113,113,0.1)] px-5 py-3 text-[0.9rem] text-[var(--bad)]">
          Failed to load the selected job.
        </div>
      )}
    </div>
  )
}
