import { Elysia, t } from 'elysia'
import fs from 'fs'
import path from 'path'

function browsePath(targetPath?: string, includeFiles = false) {
  const target = targetPath || (process.platform === 'win32' ? 'C:\\' : '/')
  const resolved = path.resolve(target)

  let entries: { name: string; isDir: boolean }[] = []
  try {
    entries = fs.readdirSync(resolved, { withFileTypes: true })
      .filter(entry => entry.isDirectory() || (includeFiles && entry.isFile()))
      .map(entry => ({ name: entry.name, isDir: entry.isDirectory() }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch {
    entries = []
  }

  return {
    path: resolved,
    sep: path.sep,
    parent: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
    entries,
  }
}

export const fsRoutes = new Elysia({ prefix: '/fs' })
  .get('/', ({ query }) => browsePath(query.path, query.files === 'true'), {
    query: t.Object({
      path: t.Optional(t.String()),
      files: t.Optional(t.String()),
    }),
  })
  .get('/browse', ({ query }) => browsePath(query.path, query.files === 'true'), {
    query: t.Object({
      path: t.Optional(t.String()),
      files: t.Optional(t.String()),
    }),
  })
