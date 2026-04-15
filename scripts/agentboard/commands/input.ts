import { parseArgs } from '../args'
import { apiGet, apiPost, resolveJob } from '../api'

type Choice = { value: string; label: string }

export async function inputCommands(subcommand: string, argv: string[]) {
  const args = parseArgs(argv)

  if (subcommand === 'request') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    if (!args.type) throw new Error('--type is required (yesno|choice|text)')
    if (!args.prompt) throw new Error('--prompt is required')

    const job = await resolveJob(args.job)

    let choices: Choice[] | undefined
    if (args.choices) {
      choices = args.choices.split('|').map(pair => {
        const index = pair.indexOf(':')
        if (index === -1) {
          const value = pair.trim()
          return { value, label: value }
        }
        return {
          value: pair.slice(0, index).trim(),
          label: pair.slice(index + 1).trim(),
        }
      })
    }

    const input = await apiPost<{ id: string }>('/input', {
      jobId: job.id,
      agentId: args.agent,
      type: args.type,
      prompt: args.prompt,
      choices,
      allowFreeText: args['allow-free-text'] === 'true',
    })

    console.log(`Input request created (${input.id}). Waiting for human response...`)

    const result = await apiPost<{ answer: string | null; timedOut?: boolean }>(
      `/input/${input.id}/wait`
    )

    if (result.timedOut) {
      console.error('Input request timed out.')
      process.exit(1)
    }

    console.log(result.answer ?? '')
    return
  }

  if (subcommand === 'wait') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)

    const pending = await apiGet<Array<{ id: string; jobId?: string; prompt: string; status: string }>>(
      '/input/pending'
    )
    const mine = pending.filter(request => request.jobId === job.id)

    if (mine.length === 0) {
      console.log('No pending input requests for this job.')
      return
    }

    const input = mine[0]
    console.log(`Re-attaching to input: "${input.prompt}"`)

    const result = await apiPost<{ answer: string | null; timedOut?: boolean }>(
      `/input/${input.id}/wait`
    )

    if (result.timedOut) {
      console.error('Input request timed out.')
      process.exit(1)
    }

    console.log(result.answer ?? '')
    return
  }

  throw new Error(`Unknown input subcommand: ${subcommand}`)
}
