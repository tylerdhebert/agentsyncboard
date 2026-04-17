import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Job, BuildResult } from '../api/types'

const STATUS_COLOR: Record<BuildResult['status'], string> = {
  running: 'text-amber-300',
  passed: 'text-emerald-300',
  failed: 'text-rose-300',
}

export function BuildTab({ job }: { job: Pick<Job, 'id' | 'type' | 'branchName'> }) {
  const queryClient = useQueryClient()

  const { data: build, isLoading } = useQuery<BuildResult | null>({
    queryKey: queryKeys.build(job.id),
    queryFn: () => unwrap(api.build({ jobId: job.id }).get()),
    enabled: job.type === 'impl' && !!job.branchName,
    refetchInterval: query => (query.state.data?.status === 'running' ? 2000 : false),
  })

  const runMutation = useMutation({
    mutationFn: () => unwrap(api.build({ jobId: job.id }).post()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.build(job.id) })
    },
  })

  if (job.type !== 'impl' || !job.branchName) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[0.92rem] text-[var(--muted)]">
        Build output is only available for implementation jobs with a worktree.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-[rgba(8,11,16,0.8)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || build?.status === 'running'}
            className="rounded-full border border-[rgba(125,211,252,0.28)] bg-[rgba(56,189,248,0.12)] px-4 py-1.5 font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.28em] text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.2)] disabled:opacity-50"
          >
            run build
          </button>
          {build && (
            <>
              <span className={`font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.25em] ${STATUS_COLOR[build.status]}`}>
                {build.status}
              </span>
              <span className="font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.24em] text-[var(--muted)]">
                {new Date(build.triggeredAt).toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-[0.92rem] text-[var(--muted)]">
            loading build results...
          </div>
        ) : !build ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-[0.92rem] text-[var(--muted)]">
            no build results yet.
          </div>
        ) : (
          <pre className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[rgba(5,8,12,0.84)] p-4 font-[var(--font-mono)] text-[0.76rem] leading-relaxed text-[var(--ink)]">
            {build.output || '(no output)'}
          </pre>
        )}
      </div>
    </div>
  )
}
