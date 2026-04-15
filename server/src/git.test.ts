import { describe, it, expect } from 'bun:test'
import { worktreePath } from './git'
import path from 'path'

describe('worktreePath', () => {
  it('derives path correctly', () => {
    const result = worktreePath('/home/user/repos/myapp', 'feat/auth')
    const expected = path.join('/home/user/repos/myapp', '..', '.git-worktrees', 'feat/auth')
    expect(result).toBe(expected)
  })
})
