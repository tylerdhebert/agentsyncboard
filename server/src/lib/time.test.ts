import { describe, it, expect } from 'bun:test'
import { now } from './time'

describe('now', () => {
  it('returns an ISO 8601 string', () => {
    const t = now()
    expect(() => new Date(t)).not.toThrow()
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
