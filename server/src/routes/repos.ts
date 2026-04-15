import { Elysia, t } from 'elysia'
import { eq } from 'drizzle-orm'
import { $ } from 'bun'
import { db } from '../db'
import { repos } from '../db/schema'
import { wsManager } from '../wsManager'
import { randomId } from '../lib/ids'
import { now } from '../lib/time'

export const reposRoutes = new Elysia({ prefix: '/repos' })
  .get('/', () => db.select().from(repos).all())

  .post('/', async ({ body }) => {
    const id = randomId()
    const ts = now()
    await db.insert(repos).values({
      id,
      name: body.name,
      path: body.path,
      baseBranch: body.baseBranch ?? 'main',
      buildCommand: body.buildCommand ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    const repo = db.select().from(repos).where(eq(repos.id, id)).get()!
    wsManager.broadcast('repo:created', repo)
    return repo
  }, {
    body: t.Object({
      name: t.String(),
      path: t.String(),
      baseBranch: t.Optional(t.String()),
      buildCommand: t.Optional(t.String()),
    }),
  })

  .get('/:id', ({ params }) => {
    const repo = db.select().from(repos).where(eq(repos.id, params.id)).get()
    if (!repo) throw new Error('not found')
    return repo
  })

  .patch('/:id', async ({ params, body }) => {
    await db.update(repos)
      .set({ ...body, updatedAt: now() })
      .where(eq(repos.id, params.id))
    const repo = db.select().from(repos).where(eq(repos.id, params.id)).get()!
    wsManager.broadcast('repo:updated', repo)
    return repo
  }, {
    body: t.Partial(t.Object({
      name: t.String(),
      path: t.String(),
      baseBranch: t.String(),
      buildCommand: t.String(),
    })),
  })

  .delete('/:id', async ({ params }) => {
    await db.delete(repos).where(eq(repos.id, params.id))
    wsManager.broadcast('repo:deleted', { id: params.id })
    return { ok: true }
  })

  .get('/:id/branches', async ({ params }) => {
    const repo = db.select().from(repos).where(eq(repos.id, params.id)).get()
    if (!repo) throw new Error('not found')
    const output = await $`git -C ${repo.path} branch -a --format=%(refname:short)`.text()
    const branches = output.split('\n').map(branch => branch.trim()).filter(Boolean)
    return { branches }
  })
