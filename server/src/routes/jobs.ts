import { Elysia, t } from 'elysia'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { jobs, comments, jobDependencies, repos } from '../db/schema'
import { wsManager } from '../wsManager'
import { pollRegistry } from '../pollRegistry'
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
  type DiffType,
} from '../git'

type Repo = typeof repos.$inferSelect

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
      status: t.String(),
      agentId: t.String(),
      folderId: t.String(),
      parentJobId: t.String(),
      autoMerge: t.Boolean(),
      requireReview: t.Boolean(),
      plan: t.String(),
      latestUpdate: t.String(),
      artifact: t.String(),
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

    await db.update(jobs)
      .set({ agentId: body.agentId, status: 'in-progress', updatedAt: now() })
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

        await db.insert(comments).values({
          id: randomId(),
          jobId: params.id,
          author: 'user',
          body: `Conflict detected against ${baseBranch}. Affected files: ${result.files.join(', ')}. Resolve in your worktree at ${worktreePath(repo.path, job.branchName)} and re-run agentboard job ready.`,
          createdAt: now(),
        })

        wsManager.broadcast('job:conflicted', { id: params.id, files: result.files })
        return { status: 'conflicted', files: result.files, details: result.details }
      }

      await db.update(jobs)
        .set({ conflictedAt: null, conflictDetails: null, updatedAt: now() })
        .where(eq(jobs.id, params.id))
    }

    await db.update(jobs)
      .set({ status: 'in-review', updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)

    return { status: 'in-review', job: updated }
  })

  .post('/:id/await-review', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.status !== 'in-review') throw new Error('job is not in-review')
    if (!job.requireReview) return { outcome: 'approved' }

    try {
      const result = await pollRegistry.park<{ outcome: string; comment?: string }>(
        `review:${params.id}`,
        1_800_000
      )
      return result
    } catch {
      return { outcome: 'timeout' }
    }
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
    }

    await db.update(jobs)
      .set({ status: 'done', completedAt: now(), updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)

    pollRegistry.resolve(`review:${params.id}`, { outcome: 'approved' })

    const repo = job.repoId ? loadRepo(job.repoId) : null
    const resolvedBaseBranch = job.repoId ? resolveBaseBranch(job, repo!) : null
    if (repo && resolvedBaseBranch) {
      const siblings = db.select().from(jobs)
        .where(
          and(
            eq(jobs.repoId, job.repoId),
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
          await db.insert(comments).values({
            id: randomId(),
            jobId: sibling.id,
            author: 'user',
            body: `Conflict detected after merge of ${job.branchName}. Affected files: ${result.files.join(', ')}. Resolve in your worktree and re-run agentboard job ready.`,
            createdAt: now(),
          })
          wsManager.broadcast('job:conflicted', { id: sibling.id, files: result.files })
        } else {
          await db.update(jobs)
            .set({ conflictedAt: null, conflictDetails: null, updatedAt: now() })
            .where(eq(jobs.id, sibling.id))
        }
      }
    }

    return { ok: true, job: updated }
  })

  .post('/:id/request-changes', async ({ params, body }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get()
    if (!job) throw new Error('not found')
    if (job.status !== 'in-review') throw new Error('job is not in-review')

    if (body.comment) {
      await db.insert(comments).values({
        id: randomId(),
        jobId: params.id,
        author: 'user',
        body: body.comment,
        createdAt: now(),
      })
    }

    await db.update(jobs)
      .set({ status: 'in-progress', updatedAt: now() })
      .where(eq(jobs.id, params.id))

    const updated = db.select().from(jobs).where(eq(jobs.id, params.id)).get()!
    wsManager.broadcast('job:updated', updated)

    pollRegistry.resolve(`review:${params.id}`, {
      outcome: 'changes-requested',
      comment: body.comment ?? '',
    })

    return { ok: true, job: updated }
  }, {
    body: t.Object({
      comment: t.Optional(t.String()),
    }),
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
