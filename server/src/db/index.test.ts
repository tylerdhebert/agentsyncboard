import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb, db } from './index'
import { repos } from './schema'

beforeAll(() => {
  initDb()
})

describe('initDb', () => {
  it('creates tables without error', () => {
    const result = db.select().from(repos).all()
    expect(Array.isArray(result)).toBe(true)
  })
})
