import { Elysia, t } from 'elysia'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { jobs, comments, jobDependencies, jobReferences, repos } from '../db/schema'
import { wsManager } from '../wsManager'
import { randomId } from '../lib/ids'
import { now } from '../lib/time'
import { assertImplFields } from '../lib/validate'
import {
  worktreeCreate,
  worktreeRemove,
  worktreePath,
  getDiff,
  getCommits,
  checkConflicts,
  mergeBranch,
  createBranch,
  type DiffType,
} from '../git'

type Repo = typeof repos.$inferSelect
const jobStatusSchema = t.Union([
  t.Literal('open'),
  t.Literal('in-progress'),
  t.Literal('blocked'),
  t.Literal('in-review'),
  t.Literal('approved'),
  t.Literal('done'),
])

function loadRepo(repoId: string): Repo {
  const repo = db.select().from(repos).where(eq(repos.id, repoId)).get()
  if (!repo) throw new Error(`repo ${repoId} not found`)
  return repo
}

function nextRefNum(): number {
  const row = db.select({ max: sql<number | null>`max(${jobs.refNum})` }).from(jobs).get()
  return (row?.max ?? 0) + 1
}

function resolveBaseBranch(job: { baseBranch?: string | null }, repo: Repo): string {
  return job.baseBranch ?? repo.baseBranch
}

type ReviewVerdict = 'approve' | 'request-changes'

function parseReviewVerdict(artifact: string | null): ReviewVerdict | null {
  if (!artifact) return null
  const normalized = artifact.toLowerCase()
  const verdictSection = normalized.match(/## verdict\s+([\s\S]*?)(?:\n## |\s*$)/)
  const verdictText = verdictSection?.[1] ?? normalized
  if (verdictText.includes('request changes') || verdictText.includes('blocking issue')) {
    return 'request-changes'
  }
  if (verdictText.includes('approve')) {
    return 'approve'
  }
  return null
}

async function addUserComment(jobId: string, body: string) {
  const comment = {
    id: randomId(),
    jobId,
    author: 'user' as const,
    body,
    createdAt: now(),
  }
  await db.insert(comments).values(comment)
  const saved = db.select().from(comments).where(eq(comments.id, comment.id)).get()!
  wsManager.broadcast('comment:created', saved)
  return saved
}

async function refreshSiblingConflicts(job: typeof jobs.$inferSelect) {
  const repo = job.repoId ? loadRepo(job.repoId) : null
  const resolvedBaseBranch = job.repoId ? resolveBaseBranch(job, repo!) : null
  if (!repo || !resolvedBaseBranch) return

  const siblings = db.select().from(jobs)
    .where(
      and(
        eq(jobs.repoId, repo.id),
        eq(jobs.baseBranch, resolvedBaseBranch),
        eq(jobs.type, 'impl'),
      )
    ).all()
    .filter(sibling => sibling.id !== job.id && sibling.status !== 'done')

  for (const sibling of siblings) {
    if (!sibling.branchName) continue
    const result = await checkConflicts(repo.path, sibling.branchName, resolvedBaseBranch)
    if (result.hasConflicts) {
      const details = JSON.stringify({ output: result.details, files: result.files })
      await db.update(jobs)
        .set({ conflictedAt: now(), conflictDetails: details, updatedAt: now() })
        .where(eq(jobs.id, sibling.id))
      await addUserComment(
        sibling.id,
        `Conflict detected after merge of ${job.branchName}. Affected files: ${result.files.join(', ')}. Resolve in your worktree and re-run agentboard job ready.`
      )
      wsManager.broadcast('job:conflicted', { id: sibling.id, files: result.files })
    } else {
      await db.update(jobs)
        .set({ conflictedAt: null, conflictDetails: null, updatedAt: now() })
        .where(eq(jobs.id, sibling.id))
    }
  }
}

async function applyAcceptedReviewToParent(reviewJob: typeof jobs.$inferSelect) {
  if (reviewJob.type !== 'review' || !reviewJob.parentJobId) return

  const parent = db.select().from(jobs).where(eq(jobs.id, reviewJob.parentJobId)).get()
  if (!parent || parent.type !== 'impl') return

  const verdict = parseReviewVerdict(reviewJob.artifact)
  if (!verdict) throw new Error('review job artifact must include an approve or request changes verdict')

  if (verdict === 'request-changes') {
    await db.update(jobs)
      .set({ status: 'in-progress', completedAt: null, reviewOutcome: 'changes-requested', updatedAt: now() })
      .where(eq(jobs.id, parent.id))
    await addUserComment(parent.id, `Accepted review #${reviewJob.refNum}: changes requested.`)
    const updatedParent = db.select().from(jobs).where(eq(jobs.id, parent.id)).get()!
    wsManager.broadcast('job:updated', updatedParent)
    return
  }

  if (parent.autoMerge && parent.repoId && parent.branchName) {
    const repo = loadRepo(parent.repoId)
    const baseBranch = resolveBaseBranch(parent, repo)
    await mergeBranch(repo.path, parent.branchName, baseBranch)
    await worktreeRemove(repo.path, parent.branchName)
    await db.update(jobs)
      .set({ status: 'done', completedAt: now(), conflictedAt: null, conflictDetails: null, reviewOutcome: 'approved', updatedAt: now() })
      .where(eq(jobs.id, parent.id))
    const updatedParent = db.select().from(jobs).where(eq(jobs.id, parent.id)).get()!
    wsManager.broadcast('job:updated', updatedParent)
    await refreshSiblingConflicts(updatedParent)
    return
  }

  await db.update(jobs)
    .set({ status: 'approved', completedAt: null, reviewOutcome: 'approved', updatedAt: now() })
    .where(eq(jobs.id, parent.id))
  const updatedParent = db.select().from(jobs).where(eq(jobs.id, parent.id)).get()!
  wsManager.broadcast('job:updated', updatedParent)
}

export const jobsRoutes = new Elysia({ prefix: '/jobs' })

  .get('/', ({ query }) => {
    let q = db.select().from(jobs).$dynamic()
    const filters = []
    if (query.status) filters.push(eq(jobs.status, query.status as never))
    if (query.type) filters.push(eq(jobs.type, query.type as never))
    if (query.repoId) filters.push(eq(jobs.repoId, query.repoId))
    if (query.parentJobId) filters.push(eq(jobs.parentJobId, query.parentJobId))
    if (query.agentId) filters.push(eq(jobs.agentId, query.agentId))
    if (filters.length) q = q.where(and(...filters))
    return q.all()
  }, {
    query: t.Object({
      status: t.Optional(t.String()),
      type: t.Optional(t.String()),
      repoId: t.Optional(t.String()),
      parentJobId: t.Optional(t.String()),
      agentId: t.Optional(t.String()),
    }),
  })

  .post('/', async ({ body }) => {
    if (body.type === 'impl') assertImplFields(body)

    let repo: Repo | null = null
    if (body.repoId) {
      repo = loadRepo(body.repoId)
    }

    const id = randomId()
    const ts = now()
    const baseBranch = body.baseBranch ?? repo?.baseBranch ?? null
    const requireReview = body.requireReview ?? (body.type !== 'impl')

    await db.insert(jobs).values({
      id,
      refNum: nextRefNum(),
      type: body.type,
      title: body.title,
      description: body.description ?? null,
      repoId: body.repoId ?? null,
      branchName: body.branchName ?? null,
      baseBranch,
      parentJobId: body.parentJobId ?? null,
      folderId: body.folderId ?? null,
      status: 'open',
      agentId: body.agentId ?? null,
      autoMerge: body.autoMerge ?? false,
      requireReview,
      plan: null,
      latestUpdate: null,
      artifact: null,
      handoffSummary: null,
      blockedReason: null,
      conflictedAt: null,
      conflictDetails: null,
      completedAt: null,
      createdAt: ts,
      updatedAt: ts,
    })

    const job = db.select().from(jobs).where(eq(jobs.id, id)).get()!
    wsManager.broadcast('job:created', job)
    return job
  }, {
    body: t.Object({
      type: t.Union([
        t.Literal('impl'),
        t.Literal('plan'),
        t.Literal('review'),
        t.Literal('analysis'),
        t.Literal('goal'),
        t.Literal('arch'),
        t.Literal('convo'),
      ]),
      title: t.String(),
      description: t.Optional(t.String()),
      repoId: t.Optional(t.String()),
      branchName: t.Optional(t.String()),
      baseBranch: t.Optional(t.String()),
      parentJobId: t.Optional(t.String()),
      folderId: t.Optional(t.String()),
      agentId: t.Optional(t.String()),
      autoMerge: t.Optional(t.Boolean()),
      requireReview: t.Optional(t.Boolean()),
    }),
  })

  .get('/:id', ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    return job
  })

  .patch('/:id', async ({ params, body }) => {
    await db.update(jobs)
      .set({ ...body, updatedAt: now() })
      .where(eq(jobs.id, params.id))
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', job)
    return job
  }, {
    body: t.Partial(t.Object({
      title: t.String(),
      description: t.String(),
      status: jobStatusSchema,
      agentId: t.String(),
      folderId: t.Union([t.String(), t.Null()]),
      parentJobId: t.Union([t.String(), t.Null()]),
      autoMerge: t.Boolean(),
      requireReview: t.Boolean(),
      plan: t.String(),
      latestUpdate: t.String(),
      artifact: t.String(),
      scratchpad: t.String(),
      handoffSummary: t.String(),
      blockedReason: t.String(),
    })),
  })

  .delete('/:id', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.type === 'impl' && job.repoId && job.branchName) {
      try {
        const repo = loadRepo(job.repoId)
        await worktreeRemove(repo.path, job.branchName)
      } catch {
        // Best effort cleanup.
      }
    }
    await db.delete(jobs).where(eq(jobs.id, params.id))
    wsManager.broadcast('job:deleted', { id: params.id })
    return { ok: true }
  })

  .post('/:id/claim', async ({ params, body }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.status !== 'open') throw new Error('job is not open')

    let wtPath: string | undefined
    if (job.type === 'impl') {
      if (!job.repoId || !job.branchName) throw new Error('impl job missing repoId or branchName')
      const repo = loadRepo(job.repoId)
      const baseBranch = resolveBaseBranch(job, repo)
      wtPath = await worktreeCreate(repo.path, job.branchName, baseBranch)
    }

    if (job.type === 'goal' && job.repoId && job.branchName) {
      const repo = loadRepo(job.repoId)
      const baseBranch = resolveBaseBranch(job, repo)
      await createBranch(repo.path, job.branchName, baseBranch)
    }

    await db.update(jobs)
      .set({ agentId: body.agentId, status: 'in-progress', reviewOutcome: null, updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)

    return { job: updated, worktreePath: wtPath ?? null }
  }, {
    body: t.Object({
      agentId: t.String(),
    }),
  })

  .post('/:id/ready', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.status !== 'in-progress') throw new Error('job is not in-progress')

    if (job.type === 'impl' && job.repoId && job.branchName) {
      const repo = loadRepo(job.repoId)
      const baseBranch = resolveBaseBranch(job, repo)
      const result = await checkConflicts(repo.path, job.branchName, baseBranch)

      if (result.hasConflicts) {
        const details = JSON.stringify({ output: result.details, files: result.files })
        await db.update(jobs)
          .set({ conflictedAt: now(), conflictDetails: details, updatedAt: now() })
          .where(eq(jobs.id, params.id))

        await addUserComment(
          params.id,
          `Conflict detected against ${baseBranch}. Affected files: ${result.files.join(', ')}. Resolve in your worktree at ${worktreePath(repo.path, job.branchName)} and re-run agentboard job ready.`
        )

        wsManager.broadcast('job:conflicted', { id: params.id, files: result.files })
        return { status: 'conflicted', files: result.files, details: result.details }
      }

      await db.update(jobs)
        .set({ conflictedAt: null, conflictDetails: null, updatedAt: now() })
        .where(eq(jobs.id, params.id))
    }

    await db.update(jobs)
      .set({ status: 'in-review', reviewOutcome: null, updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:in-review', updated)

    return { status: 'in-review', job: updated }
  })

  .post('/:id/lgtm', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.status !== 'in-review') throw new Error('job is not in-review')
    if (!job.requireReview) throw new Error('job does not require human review')

    await addUserComment(params.id, 'LGTM')

    if (job.type === 'impl') {
      await db.update(jobs)
        .set({ reviewOutcome: 'lgtm', updatedAt: now() })
        .where(eq(jobs.id, params.id))
      const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
      wsManager.broadcast('job:updated', updated)
      return { ok: true as const, job: updated }
    }

    await db.update(jobs)
      .set({ status: 'done', completedAt: now(), reviewOutcome: 'approved', updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)

    if (job.type === 'review' && job.parentJobId) {
      const parent = db.select().from(jobs).where(eq(jobs.id, job.parentJobId)).get()
      if (parent?.type === 'impl') {
        await db.insert(jobReferences).values({
          id: randomId(),
          jobId: parent.id,
          type: 'job',
          targetJobId: updated.id,
          filePath: null,
          label: 'accepted review',
          createdAt: now(),
        })
      }
    }

    if (job.type === 'review') {
      await applyAcceptedReviewToParent(updated)
    }

    return { ok: true, job: updated }
  })

  .post('/:id/approve', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.status !== 'in-review') throw new Error('job is not in-review')

    if (job.type === 'impl' && job.autoMerge && job.repoId && job.branchName) {
      const repo = loadRepo(job.repoId)
      const baseBranch = resolveBaseBranch(job, repo)
      await mergeBranch(repo.path, job.branchName, baseBranch)
      await worktreeRemove(repo.path, job.branchName)

      await db.update(jobs)
        .set({ status: 'done', completedAt: now(), conflictedAt: null, conflictDetails: null, reviewOutcome: 'approved', updatedAt: now() })
        .where(eq(jobs.id, params.id))

      const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
      wsManager.broadcast('job:updated', updated)
      await refreshSiblingConflicts(updated)
      return { ok: true, job: updated }
    }

    const nextStatus = job.type === 'impl' ? 'approved' : 'done'
    await db.update(jobs)
      .set({
        status: nextStatus,
        completedAt: nextStatus === 'done' ? now() : null,
        reviewOutcome: 'approved',
        updatedAt: now(),
      })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)

    return { ok: true, job: updated }
  })

  .post('/:id/merge', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.type !== 'impl') throw new Error('only impl jobs can be merged')
    if (job.status !== 'approved') throw new Error('job is not approved')
    if (!job.branchName || !job.repoId) throw new Error('job has no branch or repo')

    const repo = loadRepo(job.repoId)
    const baseBranch = resolveBaseBranch(job, repo)

    const conflicts = await checkConflicts(repo.path, job.branchName, baseBranch)
    if (conflicts.hasConflicts) {
      throw new Error(`Merge conflicts in: ${conflicts.files?.join(', ') ?? 'unknown files'}`)
    }

    await mergeBranch(repo.path, job.branchName, baseBranch)
    await worktreeRemove(repo.path, job.branchName)

    await db.update(jobs)
      .set({ status: 'done', completedAt: now(), conflictedAt: null, conflictDetails: null, updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)
    await refreshSiblingConflicts(updated)

    return { ok: true as const, job: updated }
  })

  .post('/:id/request-changes', async ({ params, body }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.status !== 'in-review') throw new Error('job is not in-review')

    if (body.comment) await addUserComment(params.id, body.comment)

    await db.update(jobs)
      .set({ status: 'in-progress', reviewOutcome: 'changes-requested', updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)

    return { ok: true, job: updated }
  }, {
    body: t.Object({
      comment: t.Optional(t.String()),
    }),
  })

  .post('/:id/scratch', async ({ params, body }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')

    const entry = `[${now()} ${body.agentId}] ${body.text}`
    const updated_scratchpad = job.scratchpad ? `${job.scratchpad}\n${entry}` : entry

    await db.update(jobs)
      .set({ scratchpad: updated_scratchpad, updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)
    return { ok: true }
  }, {
    body: t.Object({
      agentId: t.String(),
      text: t.String(),
    }),
  })

  .post('/:id/reopen', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')

    await db.update(jobs)
      .set({ status: 'in-progress', completedAt: null, reviewOutcome: null, updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)
    return { ok: true, job: updated }
  })

  .post('/:id/done', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')

    await db.update(jobs)
      .set({ status: 'done', completedAt: now(), updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)
    return { ok: true, job: updated }
  })

  .get('/:id/diff', async ({ params, query }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.type !== 'impl' || !job.repoId || !job.branchName) {
      throw new Error('diff only available for impl jobs with a worktree')
    }
    const repo = loadRepo(job.repoId)
    const baseBranch = resolveBaseBranch(job, repo)
    const diffType = (query.type ?? 'branch') as DiffType
    const diff = await getDiff(repo.path, job.branchName, baseBranch, diffType)
    return { diff }
  }, {
    query: t.Object({
      type: t.Optional(t.Union([t.Literal('uncommitted'), t.Literal('branch'), t.Literal('combined')])),
    }),
  })

  .get('/:id/commits', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.type !== 'impl' || !job.repoId || !job.branchName) {
      throw new Error('commits only available for impl jobs')
    }
    const repo = loadRepo(job.repoId)
    const baseBranch = resolveBaseBranch(job, repo)
    const log = await getCommits(repo.path, job.branchName, baseBranch)
    const commits = log.split('\n').filter(Boolean).map(line => {
      const [sha, ...rest] = line.split(' ')
      return { sha, message: rest.join(' ') }
    })
    return { commits }
  })

  .post('/:id/recheck-conflicts', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.type !== 'impl' || !job.repoId || !job.branchName) {
      throw new Error('recheck only available for impl jobs')
    }
    const repo = loadRepo(job.repoId)
    const baseBranch = resolveBaseBranch(job, repo)
    const result = await checkConflicts(repo.path, job.branchName, baseBranch)

    if (result.hasConflicts) {
      const details = JSON.stringify({ output: result.details, files: result.files })
      await db.update(jobs)
        .set({ conflictedAt: now(), conflictDetails: details, updatedAt: now() })
        .where(eq(jobs.id, params.id))
      wsManager.broadcast('job:conflicted', { id: params.id, files: result.files })
      return { hasConflicts: true, files: result.files }
    }

    await db.update(jobs)
      .set({ conflictedAt: null, conflictDetails: null, updatedAt: now() })
      .where(eq(jobs.id, params.id))
    wsManager.broadcast('job:updated', db.select().from(jobs).where(eq(jobs.id, params.id)).get())
    return { hasConflicts: false }
  })

  .get('/:id/comments', ({ params }) =>
    db.select().from(comments).where(eq(comments.jobId, params.id)).all()
  )

  .post('/:id/comments', async ({ params, body }) => {
    const comment = {
      id: randomId(),
      jobId: params.id,
      author: body.author,
      agentId: body.agentId ?? null,
      body: body.body,
      createdAt: now(),
    }
    await db.insert(comments).values(comment)
    const saved = db.select().from(comments).where(eq(comments.id, comment.id)).get()!
    wsManager.broadcast('comment:created', saved)
    return saved
  }, {
    body: t.Object({
      author: t.Union([t.Literal('agent'), t.Literal('user')]),
      agentId: t.Optional(t.String()),
      body: t.String(),
    }),
  })

  .get('/:id/dependencies', ({ params }) =>
    db.select().from(jobDependencies).where(eq(jobDependencies.blockedJobId, params.id)).all()
  )

  .post('/:id/dependencies', async ({ params, body }) => {
    const dep = {
      id: randomId(),
      blockerJobId: body.blockerJobId,
      blockedJobId: params.id,
      createdAt: now(),
    }
    await db.insert(jobDependencies).values(dep)
    wsManager.broadcast('job:dependency:added', dep)
    return dep
  }, {
    body: t.Object({ blockerJobId: t.String() }),
  })

  .delete('/:id/dependencies/:depId', async ({ params }) => {
    await db.delete(jobDependencies).where(eq(jobDependencies.id, params.depId))
    wsManager.broadcast('job:dependency:removed', { id: params.depId })
    return { ok: true }
  })
