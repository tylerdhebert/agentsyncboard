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
  const setSelectedJobId = useStore(state => state.setSelectedJobId)
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

  const deleteMutation = useMutation({
    mutationFn: () =>
      requestJson<{ ok: boolean }>(`/jobs/${selectedJobId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      setSelectedJobId(null)
    },
  })

  if (!selectedJobId) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <div className="max-w-xl text-center">
          <div className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">no job selected</div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--ink)]">
            Pick a job from the tree or create a new one.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            The right side becomes the job workspace once a row is selected.
          </p>
        </div>
      </div>
    )
  }

  if (isPending || !job) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <div className="text-sm text-[var(--muted)]">Loading job...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <JobHeader
        job={job}
        onToggle={(field, value) => toggleMutation.mutate({ field, value })}
        onDelete={() => deleteMutation.mutate()}
      />

      <div
        className="flex flex-shrink-0 items-end border-b border-[var(--border)] px-4"
        style={{ background: 'rgba(10, 13, 20, 0.7)' }}
      >
        {TABS.map(tab => {
          if (tab.id !== 'detail' && job.type !== 'impl') {
            return null
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                '-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition',
                activeTab === tab.id
                  ? 'border-[var(--accent)] text-[var(--ink)]'
                  : 'border-transparent text-[var(--dim)] hover:text-[var(--muted)]',
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
