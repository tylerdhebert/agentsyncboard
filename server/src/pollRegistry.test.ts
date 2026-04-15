import { describe, it, expect } from 'bun:test'
import { pollRegistry } from './pollRegistry'

describe('pollRegistry', () => {
  it('resolves a parked promise', async () => {
    const promise = pollRegistry.park<string>('test-key-1')
    const resolved = pollRegistry.resolve('test-key-1', 'hello')
    expect(resolved).toBe(true)
    expect(await promise).toBe('hello')
  })

  it('returns false when key not found', () => {
    expect(pollRegistry.resolve('nonexistent', 'x')).toBe(false)
  })

  it('has() returns true while parked', () => {
    pollRegistry.park<string>('test-key-2')
    expect(pollRegistry.has('test-key-2')).toBe(true)
    pollRegistry.resolve('test-key-2', 'done')
    expect(pollRegistry.has('test-key-2')).toBe(false)
  })
})
