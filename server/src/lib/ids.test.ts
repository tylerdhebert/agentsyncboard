import { describe, it, expect } from 'bun:test'
import { randomId } from './ids'

describe('randomId', () => {
  it('returns a valid UUID string', () => {
    const id = randomId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('returns unique values', () => {
    expect(randomId()).not.toBe(randomId())
  })
})
