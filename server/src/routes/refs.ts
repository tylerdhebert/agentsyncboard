import { Elysia, t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { jobs, jobReferences } from '../db/schema'
import { randomId } from '../lib/ids'
import { now } from '../lib/time'

// Resolve refs for a job, enriching job-type refs with target job metadata
async function resolveRefs(jobId: string) {
  const refs = db.select().from(jobReferences).where(eq(jobReferences.jobId, jobId)).all()

  return Promise.all(refs.map(async ref => {
    if (ref.type === 'job' && ref.targetJobId) {
      const targetJob = db.select().from(jobs).where(eq(jobs.id, ref.targetJobId)).get()
      return {
        ...ref,
        targetJob: targetJob
          ? { id: targetJob.id, refNum: targetJob.refNum, title: targetJob.title, artifact: targetJob.artifact }
          : null,
      }
    }
    return { ...ref, targetJob: null }
  }))
}

export const refsRoutes = new Elysia({ prefix: '/jobs' })

  .get('/:id/refs', ({ params }) => resolveRefs(params.id))

  .post('/:id/refs', async ({ params, body }) => {
    if (body.type === 'job' && !body.targetJobId) {
      throw new Error('targetJobId is required for job-type references')
    }
    if (body.type === 'file' && !body.filePath) {
      throw new Error('filePath is required for file-type references')
    }

    const id = randomId()
    await db.insert(jobReferences).values({
      id,
      jobId: params.id,
      type: body.type,
      targetJobId: body.targetJobId ?? null,
      filePath: body.filePath ?? null,
      label: body.label ?? null,
      createdAt: now(),
    })

    const refs = await resolveRefs(params.id)
    return refs.find(r => r.id === id)!
  }, {
    body: t.Object({
      type: t.Union([t.Literal('job'), t.Literal('file')]),
      targetJobId: t.Optional(t.String()),
      filePath: t.Optional(t.String()),
      label: t.Optional(t.String()),
    }),
  })

  .delete('/:id/refs/:refId', async ({ params }) => {
    await db.delete(jobReferences).where(eq(jobReferences.id, params.refId))
    return { ok: true }
  })
