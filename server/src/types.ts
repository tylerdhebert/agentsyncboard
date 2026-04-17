/**
 * Type-only app instance for Eden treaty inference in the client build.
 * Mirrors the route structure of app.ts but omits cors and ws, which widen
 * Elysia's ~Routes type to generic string keys and break treaty inference.
 *
 * This file must NOT import anything with bun-native modules at runtime —
 * it is only ever used via `import type { App }` and is erased by Vite.
 */
import { Elysia } from 'elysia'
import { jobsRoutes } from './routes/jobs'
import { refsRoutes } from './routes/refs'
import { reposRoutes } from './routes/repos'
import { inputRoutes } from './routes/input'
import { buildRoutes } from './routes/build'
import { foldersRoutes } from './routes/folders'
import { fsRoutes } from './routes/fs'
import { mandatesRoutes } from './routes/mandates'

const _app = new Elysia()
  .use(jobsRoutes)
  .use(refsRoutes)
  .use(reposRoutes)
  .use(inputRoutes)
  .use(buildRoutes)
  .use(foldersRoutes)
  .use(fsRoutes)
  .use(mandatesRoutes)

export type App = typeof _app
