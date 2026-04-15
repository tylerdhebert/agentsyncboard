import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { initDb } from './db'
import { wsManager } from './wsManager'
import { jobsRoutes } from './routes/jobs'
import { reposRoutes } from './routes/repos'
import { inputRoutes } from './routes/input'
import { buildRoutes } from './routes/build'
import { foldersRoutes } from './routes/folders'
import { fsRoutes } from './routes/fs'
import { refsRoutes } from './routes/refs'
import { mandatesRoutes } from './routes/mandates'

initDb()

export const app = new Elysia()
  .use(cors())
  .onError(({ error, set }) => {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'not found') {
      set.status = 404
      return { error: message }
    }
    set.status = 400
    return { error: message }
  })
  .ws('/ws', {
    open(ws: { send(data: string): void }) {
      wsManager.add(ws)
    },
    close(ws: { send(data: string): void }) {
      wsManager.remove(ws)
    },
    message() {},
  })
  .group('/api', app =>
    app
      .use(jobsRoutes)
      .use(refsRoutes)
      .use(reposRoutes)
      .use(inputRoutes)
      .use(buildRoutes)
      .use(foldersRoutes)
      .use(fsRoutes)
      .use(mandatesRoutes)
  )

export type App = typeof app
