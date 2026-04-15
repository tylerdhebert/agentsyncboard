import { Elysia } from 'elysia'
import { eq } from 'drizzle-orm'
import { $ } from 'bun'
import { db } from '../db'
import { buildResults, jobs, repos } from '../db/schema'
import { wsManager } from '../wsManager'
import { worktreePath } from '../git'
import { randomId } from '../lib/ids'
import { now } from '../lib/time'

export const buildRoutes = new Elysia({ prefix: '/build' })

  .post('/:jobId', async ({ params }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, params.jobId)).get()
    if (!job) throw new Error('job not found')
    if (job.type !== 'impl' || !job.repoId || !job.branchName) {
      throw new Error('build only available for impl jobs with a worktree')
    }

    const repo = db.select().from(repos).where(eq(repos.id, job.repoId)).get()
    if (!repo?.buildCommand) throw new Error('no buildCommand configured on repo')

    const id = randomId()
    await db.insert(buildResults).values({
      id,
      jobId: params.jobId,
      status: 'running',
      output: '',
      triggeredAt: now(),
      completedAt: null,
    })
    wsManager.broadcast('build:started', { id, jobId: params.jobId })

    const wtPath = worktreePath(repo.path, job.branchName)

    ;(async () => {
      let output = ''
      let status: 'passed' | 'failed' = 'passed'
      try {
        const proc = $`bash -c ${repo.buildCommand}`.cwd(wtPath)
        for await (const chunk of proc.stdout) {
          const text = new TextDecoder().decode(chunk)
          output += text
          wsManager.broadcast('build:output', { id, chunk: text })
        }
        await proc
      } catch (error) {
        status = 'failed'
        output += String(error)
      }
      const completedAt = now()
      await db.update(buildResults)
        .set({ status, output, completedAt })
        .where(eq(buildResults.id, id))
      wsManager.broadcast('build:completed', { id, jobId: params.jobId, status })
    })()

    return { id, status: 'running' }
  })

  .get('/:jobId', ({ params }) => {
    const result = db.select().from(buildResults)
      .where(eq(buildResults.jobId, params.jobId))
      .orderBy(buildResults.triggeredAt)
      .all()
      .at(-1) ?? null
    return result
  })
