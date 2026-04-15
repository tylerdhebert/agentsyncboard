import { describe, expect, it } from 'bun:test'
import { parseArgs } from './args'

describe('parseArgs', () => {
  it('parses --key value pairs', () => {
    const result = parseArgs(['--job', '42', '--agent', 'impl-1'])
    expect(result.job).toBe('42')
    expect(result.agent).toBe('impl-1')
  })

  it('parses --key=value style', () => {
    const result = parseArgs(['--type=yesno'])
    expect(result.type).toBe('yesno')
  })

  it('collects positional args in _', () => {
    const result = parseArgs(['--job', '1', 'some message here'])
    expect(result._[0]).toBe('some message here')
  })

  it('handles boolean flags', () => {
    const result = parseArgs(['--allow-free-text'])
    expect(result['allow-free-text']).toBe('true')
  })
})
