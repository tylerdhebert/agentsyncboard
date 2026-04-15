/**
 * Parse argv-style flags into a typed map.
 * Supports: --flag value, --flag=value, and positional args.
 */
export function parseArgs(argv: string[]): Record<string, string> & { _: string[] } {
  const result: Record<string, string> & { _: string[] } = { _: [] }
  let i = 0

  while (i < argv.length) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (key.includes('=')) {
        const [k, v] = key.split('=', 2)
        result[k] = v
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        result[key] = argv[i + 1]
        i += 1
      } else {
        result[key] = 'true'
      }
    } else {
      result._.push(arg)
    }
    i += 1
  }

  return result
}
