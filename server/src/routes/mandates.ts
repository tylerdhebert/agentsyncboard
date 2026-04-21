import { Elysia, t } from 'elysia'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db'
import { jobTypeMandates } from '../db/schema'
import { randomId } from '../lib/ids'
import { now } from '../lib/time'

export const mandatesRoutes = new Elysia({ prefix: '/mandates' })
  .get('/', ({ query }) => {
    if (query.repoId !== undefined) {
      const repoId = query.repoId === 'global' ? null : query.repoId
      if (repoId === null) {
        return db.select().from(jobTypeMandates).where(isNull(jobTypeMandates.repoId)).all()
      }
      return db.select().from(jobTypeMandates).where(eq(jobTypeMandates.repoId, repoId)).all()
    }
    return db.select().from(jobTypeMandates).all()
  }, {
    query: t.Object({
      repoId: t.Optional(t.String()),
    }),
  })

  .put('/', async ({ body }) => {
    const repoId = body.repoId ?? null
    const existing = repoId === null
      ? db.select().from(jobTypeMandates)
          .where(and(eq(jobTypeMandates.type, body.type), isNull(jobTypeMandates.repoId)))
          .get()
      : db.select().from(jobTypeMandates)
          .where(and(eq(jobTypeMandates.type, body.type), eq(jobTypeMandates.repoId, repoId)))
          .get()

    const ts = now()
    if (existing) {
      await db.update(jobTypeMandates)
        .set({ filePath: body.filePath, updatedAt: ts })
        .where(eq(jobTypeMandates.id, existing.id))
      return db.select().from(jobTypeMandates).where(eq(jobTypeMandates.id, existing.id)).get()!
    }

    const id = randomId()
    await db.insert(jobTypeMandates).values({
      id,
      type: body.type,
      repoId,
      filePath: body.filePath,
      updatedAt: ts,
    })
    return db.select().from(jobTypeMandates).where(eq(jobTypeMandates.id, id)).get()!
  }, {
    body: t.Object({
      type: t.Union([
        t.Literal('impl'),
        t.Literal('plan'),
        t.Literal('review'),
        t.Literal('goal'),
        t.Literal('convo'),
      ]),
      repoId: t.Optional(t.String()),
      filePath: t.String(),
    }),
  })

  .delete('/:id', async ({ params }) => {
    await db.delete(jobTypeMandates).where(eq(jobTypeMandates.id, params.id))
    return { ok: true }
  })
