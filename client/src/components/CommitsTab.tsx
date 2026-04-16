import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Job } from '../api/types'

type Commit = { sha: string; message: string }

export function CommitsTab({ job }: { job: Pick<Job, 'id' | 'branchName' | 'type'> }) {
  const { data, isLoading } = useQuery<{ commits: Commit[] }>({
    queryKey: queryKeys.commits(job.id),
    queryFn: () => unwrap(api.jobs({ id: job.id }).commits.get()),
    enabled: job.type === 'impl' && !!job.branchName,
  })

  if (job.type !== 'impl' || !job.branchName) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[0.92rem] text-[var(--muted)]">
        Commit history is only available for implementation jobs with a worktree.
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-5">
      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-[0.92rem] text-[var(--muted)]">
            Loading commits...
          </div>
        ) : (data?.commits?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-[0.92rem] text-[var(--muted)]">
            No commits yet on this branch.
          </div>
        ) : (
          data?.commits.map(commit => (
            <article
              key={commit.sha}
              className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-full border border-[rgba(125,211,252,0.2)] bg-[rgba(56,189,248,0.08)] px-2 py-1 font-[var(--font-mono)] text-[0.68rem] text-[var(--accent)]">
                  {commit.sha.slice(0, 7)}
                </span>
                <p className="flex-1 text-[0.95rem] leading-relaxed text-[var(--ink)]">
                  {commit.message}
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
