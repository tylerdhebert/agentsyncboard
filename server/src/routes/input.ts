import { Elysia, t } from 'elysia'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { inputRequests, jobs } from '../db/schema'
import { wsManager } from '../wsManager'
import { pollRegistry } from '../pollRegistry'
import { randomId } from '../lib/ids'
import { now } from '../lib/time'

export const inputRoutes = new Elysia({ prefix: '/input' })

  .post('/', async ({ body }) => {
    const job = db.select().from(jobs).where(eq(jobs.id, body.jobId)).get()
    if (!job) throw new Error('job not found')

    const id = randomId()
    const previousStatus = job.status

    await db.insert(inputRequests).values({
      id,
      jobId: body.jobId,
      agentId: body.agentId,
      type: body.type,
      prompt: body.prompt,
      choices: body.choices ? JSON.stringify(body.choices) : null,
      allowFreeText: body.allowFreeText ?? false,
      answer: null,
      status: 'pending',
      previousStatus,
      timeoutSecs: body.timeoutSecs ?? 900,
      requestedAt: now(),
      answeredAt: null,
    })

    await db.update(jobs)
      .set({ status: 'blocked', blockedReason: body.prompt, updatedAt: now() })
      .where(eq(jobs.id, body.jobId))

    const saved = db.select().from(inputRequests).where(eq(inputRequests.id, id)).get()!
    wsManager.broadcast('input:created', saved)

    return saved
  }, {
    body: t.Object({
      jobId: t.String(),
      agentId: t.String(),
      type: t.Union([t.Literal('yesno'), t.Literal('choice'), t.Literal('text')]),
      prompt: t.String(),
      choices: t.Optional(t.Array(t.Object({ value: t.String(), label: t.String() }))),
      allowFreeText: t.Optional(t.Boolean()),
      timeoutSecs: t.Optional(t.Number()),
    }),
  })

  .post('/:id/answer', async ({ params, body }) => {
    const input = db.select().from(inputRequests).where(eq(inputRequests.id, params.id)).get()
    if (!input) throw new Error('not found')
    if (input.status !== 'pending') throw new Error('already answered')

    await db.update(inputRequests)
      .set({ answer: body.answer, status: 'answered', answeredAt: now() })
      .where(eq(inputRequests.id, params.id))

    const otherPending = db.select().from(inputRequests)
      .where(and(
        eq(inputRequests.jobId, input.jobId),
        eq(inputRequests.status, 'pending'),
      )).all()
      .filter(request => request.id !== params.id)

    if (otherPending.length === 0 && input.previousStatus) {
      await db.update(jobs)
        .set({ status: input.previousStatus as never, blockedReason: null, updatedAt: now() })
        .where(eq(jobs.id, input.jobId))
    }

    pollRegistry.resolve(`input:${params.id}`, body.answer)

    const updated = db.select().from(inputRequests).where(eq(inputRequests.id, params.id)).get()!
    wsManager.broadcast('input:answered', updated)

    return updated
  }, {
    body: t.Object({
      answer: t.String(),
    }),
  })

  .get('/:id', ({ params }) => {
    const input = db.select().from(inputRequests).where(eq(inputRequests.id, params.id)).get()
    if (!input) throw new Error('not found')
    return input
  })

  .post('/:id/wait', async ({ params }) => {
    const input = db.select().from(inputRequests).where(eq(inputRequests.id, params.id)).get()
    if (!input) throw new Error('not found')
    if (input.status === 'answered') return { answer: input.answer }

    const timeoutMs = (input.timeoutSecs ?? 900) * 1000
    try {
      const answer = await pollRegistry.park<string>(`input:${params.id}`, timeoutMs)
      return { answer }
    } catch {
      await db.update(inputRequests)
        .set({ status: 'timeout' })
        .where(eq(inputRequests.id, params.id))
      return { answer: null, timedOut: true }
    }
  })

  .get('/pending', () => {
    const pending = db.select().from(inputRequests)
      .where(eq(inputRequests.status, 'pending'))
      .all()
    return pending.map(input => {
      const job = db.select({ type: jobs.type }).from(jobs)
        .where(eq(jobs.id, input.jobId)).get()
      return { ...input, jobType: job?.type ?? null }
    })
  })
