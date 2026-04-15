import { Elysia, t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { folders, jobs } from '../db/schema'
import { randomId } from '../lib/ids'
import { now } from '../lib/time'

export const foldersRoutes = new Elysia({ prefix: '/folders' })
  .get('/', () => db.select().from(folders).all())

  .post('/', async ({ body }) => {
    const id = randomId()
    await db.insert(folders).values({
      id,
      name: body.name,
      color: body.color ?? null,
      parentFolderId: body.parentFolderId ?? null,
      createdAt: now(),
    })
    return db.select().from(folders).where(eq(folders.id, id)).get()!
  }, {
    body: t.Object({
      name: t.String(),
      color: t.Optional(t.String()),
      parentFolderId: t.Optional(t.String()),
    }),
  })

  .patch('/:id', async ({ params, body }) => {
    await db.update(folders).set(body).where(eq(folders.id, params.id))
    return db.select().from(folders).where(eq(folders.id, params.id)).get()!
  }, {
    body: t.Partial(t.Object({
      name: t.String(),
      color: t.String(),
      parentFolderId: t.String(),
    })),
  })

  .delete('/:id', async ({ params }) => {
    await db.update(folders).set({ parentFolderId: null }).where(eq(folders.parentFolderId, params.id))
    await db.update(jobs).set({ folderId: null }).where(eq(jobs.folderId, params.id))
    await db.delete(folders).where(eq(folders.id, params.id))
    return { ok: true }
  })
