import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Comment, Job, JobDependency, JobReference, Repo } from '../api/types'
import { CommentThread } from './CommentThread'
import { PathPicker } from './PathPicker'
import { Merge } from 'lucide-react'

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
      await unwrap(api.jobs({ id: job.id }).patch({ artifact: draft }))
      await unwrap(api.jobs({ id: job.id }).comments.post({
        author: 'user',
        body: `human edited artifact at ${new Date().toISOString()}`,
      }))
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
              save
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setDraft(job.artifact ?? '')
              }}
              className="rounded border border-[var(--border)] bg-white/5 px-3 py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              cancel
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

  const lgtmMutation = useMutation({
    mutationFn: () => unwrap(api.jobs({ id: job.id }).lgtm.post()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      await queryClient.invalidateQueries({ queryKey: queryKeys.job(job.id) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.comments(job.id) })
    },
  })

  const changesMutation = useMutation({
    mutationFn: () =>
      unwrap(api.jobs({ id: job.id })['request-changes'].post({ comment: feedback.trim() || undefined })),
    onSuccess: async () => {
      setFeedback('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      await queryClient.invalidateQueries({ queryKey: queryKeys.job(job.id) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.comments(job.id) })
    },
  })

  if (job.status !== 'in-review' || !job.requireReview) return null

  const heading = job.type === 'review' ? 'review signoff' : 'human review'
  const sublabel = job.type === 'impl'
    ? 'record lgtm or send the impl back'
    : job.type === 'review'
      ? 'accept the review or request changes'
      : 'lgtm or request changes'
  const helperText = job.type === 'impl'
    ? 'lgtm records your signoff and ends the impl agent turn. the impl job stays in review until the accepted review outcome moves it forward.'
    : job.type === 'review'
      ? 'lgtm accepts this review pass and applies its verdict to the parent impl job.'
      : null

  return (
    <section className="space-y-3 rounded-lg border border-[rgba(125,211,252,0.16)] bg-[rgba(56,189,248,0.06)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[rgba(125,211,252,0.9)]">
          {heading}
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          {sublabel}
        </span>
      </div>

      {helperText && (
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {helperText}
        </p>
      )}

      <textarea
        value={feedback}
        onChange={event => setFeedback(event.target.value)}
        placeholder="optional note for request changes..."
        rows={3}
        className="w-full rounded-lg border border-[var(--border)] bg-[rgba(5,8,12,0.72)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => lgtmMutation.mutate()}
          disabled={lgtmMutation.isPending}
          className="rounded border border-[rgba(74,222,128,0.32)] bg-[rgba(74,222,128,0.12)] px-4 py-1.5 text-xs text-[var(--ink)] transition hover:bg-[rgba(74,222,128,0.2)] disabled:opacity-50"
        >
          lgtm
        </button>
        <button
          onClick={() => changesMutation.mutate()}
          disabled={changesMutation.isPending}
          className="rounded border border-[var(--border)] bg-white/5 px-4 py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--ink)] disabled:opacity-50"
        >
          request changes
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
    queryFn: () => unwrap(api.repos.get()),
  })
  const { data: dependencies = [] } = useQuery<JobDependency[]>({
    queryKey: queryKeys.jobDependencies(job.id),
    queryFn: () => unwrap(api.jobs({ id: job.id }).dependencies.get()),
  })
  const { data: parentJob } = useQuery<Job>({
    queryKey: queryKeys.job(job.parentJobId ?? 'none'),
    queryFn: () => unwrap(api.jobs({ id: job.parentJobId! }).get()),
    enabled: !!job.parentJobId,
  })

  const { data: refs = [] } = useQuery<JobReference[]>({
    queryKey: queryKeys.refs(job.id),
    queryFn: () => unwrap(api.jobs({ id: job.id }).refs.get()),
  })

  const addRefMutation = useMutation({
    mutationFn: (body: { type: 'job' | 'file'; targetJobId?: string; filePath?: string; label?: string }) =>
      unwrap(api.jobs({ id: job.id }).refs.post(body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.refs(job.id) }),
  })

  const removeRefMutation = useMutation({
    mutationFn: (refId: string) =>
      unwrap(api.jobs({ id: job.id }).refs({ refId }).delete()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.refs(job.id) }),
  })

  const [addingRef, setAddingRef] = useState(false)
  const [refType, setRefType] = useState<'job' | 'file'>('job')
  const [refJobInput, setRefJobInput] = useState('')
  const [refFileInput, setRefFileInput] = useState('')
  const [refLabel, setRefLabel] = useState('')

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: queryKeys.jobs,
    queryFn: () => unwrap(api.jobs.get()),
    enabled: addingRef && refType === 'job',
  })

  function submitRef() {
    if (refType === 'job' && refJobInput) {
      addRefMutation.mutate({
        type: 'job',
        targetJobId: refJobInput,
        label: refLabel || undefined,
      })
    } else if (refType === 'file' && refFileInput) {
      addRefMutation.mutate({
        type: 'file',
        filePath: refFileInput,
        label: refLabel || undefined,
      })
    }
    setAddingRef(false)
    setRefJobInput('')
    setRefFileInput('')
    setRefLabel('')
  }

  const repo = useMemo(() => repos.find(entry => entry.id === job.repoId) ?? null, [job.repoId, repos])

  const runBuildMutation = useMutation({
    mutationFn: () => unwrap(api.build({ jobId: job.id }).post()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.build(job.id) })
    },
  })

  const recheckMutation = useMutation({
    mutationFn: () => unwrap(api.jobs({ id: job.id })['recheck-conflicts'].post()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      await queryClient.invalidateQueries({ queryKey: queryKeys.job(job.id) })
    },
  })

  const mergeMutation = useMutation({
    mutationFn: () => unwrap(api.jobs({ id: job.id }).merge.post()),
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
          <Field label="description" value={job.description} />
          <Field label="plan" value={job.plan} />
          <Field label="latest update" value={job.latestUpdate} />
          <Field label="handoff summary" value={job.handoffSummary} />
          {job.blockedReason && <Field label="blocked reason" value={job.blockedReason} />}

          <ArtifactField job={job} />
          <ReviewActions job={job} />

          {job.type === 'impl' && job.status === 'in-review' && (
            <div className="rounded-lg border border-[rgba(245,185,76,0.18)] bg-[rgba(245,185,76,0.08)] px-4 py-3 text-sm text-[var(--warn)]">
              implementation jobs stay in review until an accepted review pass moves them to <code>approved</code> or back to <code>in-progress</code>.
            </div>
          )}

          {job.conflictedAt && (
            <section className="space-y-2 rounded-lg border border-[rgba(245,185,76,0.24)] bg-[rgba(245,185,76,0.08)] p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--warn)]">conflict</div>
              <div className="text-sm text-[var(--ink)]">
                conflicts were detected. re-run the recheck after resolving the worktree.
              </div>
              {conflictDetails?.files?.length ? (
                <div className="font-mono text-xs text-[var(--warn)]">
                  {conflictDetails.files.join(', ')}
                </div>
              ) : null}
            </section>
          )}

          <CommentThread jobId={job.id} jobType={job.type} />
        </div>
      </div>

      <aside className="min-h-0 overflow-y-auto border-l border-[var(--border)] bg-[rgba(4,6,10,0.72)] p-4">
        <div className="space-y-4">
          <MetaLine label="branch" value={job.branchName} />
          <MetaLine label="base branch" value={job.baseBranch} />
          <MetaLine label="repo" value={repo ? `${repo.name}\n${repo.path}` : job.repoId} />
          <MetaLine label="parent job" value={parentJob ? `#${parentJob.refNum} ${parentJob.title}` : job.parentJobId} />
          <MetaLine label="created" value={new Date(job.createdAt).toLocaleString()} />
          <MetaLine label="updated" value={new Date(job.updatedAt).toLocaleString()} />
        </div>

        {job.type === 'impl' && (
          <div className="mt-3 flex flex-col gap-1 border-t border-[var(--border)] pt-3">
            <button
              onClick={() => runBuildMutation.mutate()}
              disabled={runBuildMutation.isPending}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)] disabled:opacity-50"
            >
              <span>▶</span> run build
            </button>
            {job.repoId && (
              <button
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending || mergeMutation.isSuccess || job.status !== 'approved'}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)] disabled:opacity-50"
              >
                <Merge className="h-3.5 w-3.5 flex-shrink-0" />
                {mergeMutation.isPending ? 'merging…' : mergeMutation.isSuccess ? 'merged' : 'merge branch'}
              </button>
            )}
            {mergeMutation.isError && (
              <span className="px-2 text-[11px] text-rose-400">
                {(mergeMutation.error as Error).message}
              </span>
            )}
            {job.conflictedAt && (
              <button
                onClick={() => recheckMutation.mutate()}
                disabled={recheckMutation.isPending}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-amber-400 transition hover:bg-amber-500/8 disabled:opacity-50"
              >
                <span>⟳</span> recheck conflicts
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

        {/* References */}
        <section className="mt-5 space-y-2 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">references</div>
            <button
              onClick={() => setAddingRef(v => !v)}
              className="text-[10px] text-[var(--accent)] transition hover:text-[var(--ink)]"
            >
              {addingRef ? 'cancel' : '+ add'}
            </button>
          </div>

          {addingRef && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[rgba(5,8,12,0.5)] p-3">
              <div className="flex gap-1">
                {(['job', 'file'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setRefType(t)}
                    className={[
                      'rounded px-2 py-0.5 text-[11px] transition',
                      refType === t
                        ? 'bg-white/10 text-[var(--ink)]'
                        : 'text-[var(--dim)] hover:text-[var(--muted)]',
                    ].join(' ')}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {refType === 'job' ? (
                <select
                  value={refJobInput}
                  onChange={e => setRefJobInput(e.target.value)}
                  className="w-full rounded border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none"
                >
                  <option value="">select a job…</option>
                  {allJobs
                    .filter(j => j.id !== job.id && !refs.some(r => r.targetJobId === j.id))
                    .map(j => (
                      <option key={j.id} value={j.id}>#{j.refNum} {j.title}</option>
                    ))}
                </select>
              ) : (
                <PathPicker
                  selectFiles
                  value={refFileInput}
                  onChange={setRefFileInput}
                  placeholder="/absolute/path/to/file"
                />
              )}

              <input
                value={refLabel}
                onChange={e => setRefLabel(e.target.value)}
                placeholder="label (optional)"
                className="w-full rounded border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--dim)]"
              />

              <button
                onClick={submitRef}
                disabled={addRefMutation.isPending || (refType === 'job' ? !refJobInput : !refFileInput)}
                className="w-full rounded bg-[var(--accent-strong)] py-1.5 text-[11px] font-medium text-[#0a0c11] transition hover:opacity-90 disabled:opacity-40"
              >
                add reference
              </button>
            </div>
          )}

          {refs.length > 0 && (
            <div className="space-y-1">
              {refs.map(ref => (
                <div key={ref.id} className="group flex items-start gap-2 rounded border border-[var(--border)] bg-[rgba(5,8,12,0.5)] px-2.5 py-2">
                  <span className="mt-0.5 flex-shrink-0 rounded bg-white/5 px-1 py-px text-[9px] uppercase tracking-wider text-[var(--dim)]">
                    {ref.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    {ref.type === 'job' && ref.targetJob ? (
                      <div className="truncate text-[12px] text-[var(--ink)]">
                        #{ref.targetJob.refNum} {ref.targetJob.title}
                      </div>
                    ) : (
                      <div className="truncate font-mono text-[11px] text-[var(--ink)]">{ref.filePath}</div>
                    )}
                    {ref.label && (
                      <div className="truncate text-[10px] text-[var(--dim)]">{ref.label}</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeRefMutation.mutate(ref.id)}
                    className="flex-shrink-0 text-[10px] text-[var(--dim)] opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {refs.length === 0 && !addingRef && (
            <div className="text-[11px] text-[var(--dim)]">no references yet.</div>
          )}
        </section>
      </aside>
    </div>
  )
}
