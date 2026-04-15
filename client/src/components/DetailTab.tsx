import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Comment, Job, JobDependency, Repo } from '../api/types'
import { CommentThread } from './CommentThread'

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null

  return (
    <section>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{value}</p>
    </section>
  )
}

function ArtifactField({ job }: { job: Job }) {
  const queryClient = useQueryClient()
  const canEdit = job.type !== 'impl' && job.status === 'in-review'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(job.artifact ?? '')

  useEffect(() => {
    setDraft(job.artifact ?? '')
    setEditing(false)
  }, [job.id, job.artifact])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await requestJson<Job>(`/jobs/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ artifact: draft }),
      })
      await requestJson<Comment>(`/jobs/${job.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          author: 'user',
          body: `Human edited artifact at ${new Date().toISOString()}`,
        }),
      })
    },
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.job(job.id) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.comments(job.id) })
    },
  })

  if (!job.artifact && !canEdit) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          artifact
        </h3>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] uppercase tracking-wider text-[var(--accent)] transition hover:text-[var(--ink)]"
          >
            edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            rows={10}
            className="w-full rounded-lg border border-[var(--border)] bg-[rgba(5,8,12,0.72)] px-3 py-2 font-mono text-sm leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded border border-[rgba(125,211,252,0.32)] bg-[rgba(56,189,248,0.18)] px-3 py-1.5 text-xs text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.24)] disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setDraft(job.artifact ?? '')
              }}
              className="rounded border border-[var(--border)] bg-white/5 px-3 py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : job.artifact ? (
        <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
            {job.artifact}
          </pre>
        </div>
      ) : null}
    </section>
  )
}

function ReviewActions({ job }: { job: Job }) {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState('')

  const approveMutation = useMutation({
    mutationFn: () => requestJson<{ ok: boolean }>(`/jobs/${job.id}/approve`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      await queryClient.invalidateQueries({ queryKey: queryKeys.job(job.id) })
    },
  })

  const changesMutation = useMutation({
    mutationFn: () =>
      requestJson<{ ok: boolean }>(`/jobs/${job.id}/request-changes`, {
        method: 'POST',
        body: JSON.stringify({ comment: feedback.trim() || undefined }),
      }),
    onSuccess: async () => {
      setFeedback('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      await queryClient.invalidateQueries({ queryKey: queryKeys.job(job.id) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.comments(job.id) })
    },
  })

  if (job.type === 'impl' || job.status !== 'in-review' || !job.requireReview) return null

  return (
    <section className="space-y-3 rounded-lg border border-[rgba(125,211,252,0.16)] bg-[rgba(56,189,248,0.06)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[rgba(125,211,252,0.9)]">
          human review
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          approve or request changes
        </span>
      </div>

      <textarea
        value={feedback}
        onChange={event => setFeedback(event.target.value)}
        placeholder="Optional note for Request Changes..."
        rows={3}
        className="w-full rounded-lg border border-[var(--border)] bg-[rgba(5,8,12,0.72)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending}
          className="rounded border border-[rgba(74,222,128,0.32)] bg-[rgba(74,222,128,0.12)] px-4 py-1.5 text-xs text-[var(--ink)] transition hover:bg-[rgba(74,222,128,0.2)] disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => changesMutation.mutate()}
          disabled={changesMutation.isPending}
          className="rounded border border-[var(--border)] bg-white/5 px-4 py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--ink)] disabled:opacity-50"
        >
          Request changes
        </button>
      </div>
    </section>
  )
}

function MetaLine({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null

  return (
    <div>
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="break-all font-mono text-xs text-[var(--ink)]">{value}</div>
    </div>
  )
}

export function DetailTab({ job }: { job: Job }) {
  const queryClient = useQueryClient()
  const { data: repos = [] } = useQuery<Repo[]>({
    queryKey: queryKeys.repos,
    queryFn: () => requestJson<Repo[]>('/repos'),
  })
  const { data: dependencies = [] } = useQuery<JobDependency[]>({
    queryKey: queryKeys.jobDependencies(job.id),
    queryFn: () => requestJson<JobDependency[]>(`/jobs/${job.id}/dependencies`),
  })
  const { data: parentJob } = useQuery<Job>({
    queryKey: queryKeys.job(job.parentJobId ?? 'none'),
    queryFn: () => requestJson<Job>(`/jobs/${job.parentJobId}`),
    enabled: !!job.parentJobId,
  })

  const repo = useMemo(() => repos.find(entry => entry.id === job.repoId) ?? null, [job.repoId, repos])

  const runBuildMutation = useMutation({
    mutationFn: () => requestJson<{ id: string; status: string }>(`/build/${job.id}`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.build(job.id) })
    },
  })

  const recheckMutation = useMutation({
    mutationFn: () => requestJson<{ hasConflicts: boolean }>(`/jobs/${job.id}/recheck-conflicts`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      await queryClient.invalidateQueries({ queryKey: queryKeys.job(job.id) })
    },
  })

  const conflictDetails = useMemo(() => {
    if (!job.conflictDetails) return null
    try {
      return JSON.parse(job.conflictDetails) as { output?: string; files?: string[] }
    } catch {
      return null
    }
  }, [job.conflictDetails])

  return (
    <div className="h-full grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-h-0 overflow-y-auto p-5 lg:p-6">
        <div className="space-y-5">
          <Field label="Description" value={job.description} />
          <Field label="Plan" value={job.plan} />
          <Field label="Latest update" value={job.latestUpdate} />
          <Field label="Handoff summary" value={job.handoffSummary} />
          {job.blockedReason && <Field label="Blocked reason" value={job.blockedReason} />}

          <ArtifactField job={job} />
          <ReviewActions job={job} />

          {job.type === 'impl' && job.status === 'in-review' && (
            <div className="rounded-lg border border-[rgba(245,185,76,0.18)] bg-[rgba(245,185,76,0.08)] px-4 py-3 text-sm text-[var(--warn)]">
              Implementation jobs are reviewed through the worktree flow. Use the build tab and CLI approval path to finish the turn.
            </div>
          )}

          {job.conflictedAt && (
            <section className="space-y-2 rounded-lg border border-[rgba(245,185,76,0.24)] bg-[rgba(245,185,76,0.08)] p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--warn)]">conflict</div>
              <div className="text-sm text-[var(--ink)]">
                Conflicts were detected. Re-run the recheck after resolving the worktree.
              </div>
              {conflictDetails?.files?.length ? (
                <div className="font-mono text-xs text-[var(--warn)]">
                  {conflictDetails.files.join(', ')}
                </div>
              ) : null}
            </section>
          )}

          <CommentThread jobId={job.id} />
        </div>
      </div>

      <aside className="min-h-0 overflow-y-auto border-l border-[var(--border)] bg-[rgba(4,6,10,0.72)] p-4">
        <div className="space-y-4">
          <MetaLine label="Branch" value={job.branchName} />
          <MetaLine label="Base branch" value={job.baseBranch} />
          <MetaLine label="Repo" value={repo ? `${repo.name}\n${repo.path}` : job.repoId} />
          <MetaLine label="Parent job" value={parentJob ? `#${parentJob.refNum} ${parentJob.title}` : job.parentJobId} />
          <MetaLine label="Created" value={new Date(job.createdAt).toLocaleString()} />
          <MetaLine label="Updated" value={new Date(job.updatedAt).toLocaleString()} />
        </div>

        {job.type === 'impl' && (
          <div className="mt-3 flex flex-col gap-1 border-t border-[var(--border)] pt-3">
            <button
              onClick={() => runBuildMutation.mutate()}
              disabled={runBuildMutation.isPending}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)] disabled:opacity-50"
            >
              <span>▶</span> Run build
            </button>
            {job.conflictedAt && (
              <button
                onClick={() => recheckMutation.mutate()}
                disabled={recheckMutation.isPending}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-amber-400 transition hover:bg-amber-500/8 disabled:opacity-50"
              >
                <span>⟳</span> Recheck conflicts
              </button>
            )}
          </div>
        )}

        {dependencies.length > 0 && (
          <section className="mt-5 space-y-2 border-t border-[var(--border)] pt-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              dependencies
            </div>
            <div className="space-y-1">
              {dependencies.map(dep => (
                <div key={dep.id} className="rounded border border-[var(--border)] bg-[rgba(5,8,12,0.7)] px-3 py-2 font-mono text-xs text-[var(--ink)]">
                  blocker {dep.blockerJobId}
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  )
}
