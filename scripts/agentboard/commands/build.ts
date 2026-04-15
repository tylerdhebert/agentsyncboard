import { parseArgs } from '../args'
import { apiGet, apiPost, resolveJob } from '../api'

export async function buildCommands(subcommand: string, argv: string[]) {
  const args = parseArgs(argv)

  if (subcommand === 'run') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)
    const result = await apiPost<{ id: string; status: string }>(`/build/${job.id}`)
    console.log(`Build started (id: ${result.id}). Check status with: agentboard build status --job ${args.job}`)
    return
  }

  if (subcommand === 'status') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)
    const result = await apiGet<{
      id: string
      status: string
      output: string
      triggeredAt: string
      completedAt: string | null
    } | null>(`/build/${job.id}`)

    if (!result) {
      console.log('No build results for this job.')
      return
    }

    console.log(`Status:  ${result.status}`)
    console.log(`Started: ${result.triggeredAt}`)
    if (result.completedAt) console.log(`Ended:   ${result.completedAt}`)
    if (result.output) {
      console.log(`\nOutput:\n${result.output}`)
    }
    return
  }

  throw new Error(`Unknown build subcommand: ${subcommand}`)
}
