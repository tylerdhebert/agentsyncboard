import { parseArgs } from '../args'
import { apiGet, apiPost, resolveJob } from '../api'

type Choice = { value: string; label: string }
type InputRecord = { id: string; jobId?: string; prompt: string; status: string; answer?: string | null; timeoutSecs?: number }

async function pollUntilAnswered(id: string, timeoutSecs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutSecs * 1000
  while (Date.now() < deadline) {
    await Bun.sleep(3_000)
    const input = await apiGet<InputRecord>(`/input/${id}`)
    if (input.status === 'answered') return input.answer ?? ''
    if (input.status === 'timeout') return null
  }
  return null
}

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

    const input = await apiPost<InputRecord>('/input', {
      jobId: job.id,
      agentId: args.agent,
      type: args.type,
      prompt: args.prompt,
      choices,
      allowFreeText: args['allow-free-text'] === 'true',
    })

    console.log(`Input request created (${input.id}). Waiting for human response...`)

    const answer = await pollUntilAnswered(input.id, input.timeoutSecs ?? 900)

    if (answer === null) {
      console.error('Input request timed out.')
      process.exit(1)
    }

    console.log(answer)
    return
  }

  if (subcommand === 'wait') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)

    const pending = await apiGet<InputRecord[]>('/input/pending')
    const mine = pending.filter(r => r.jobId === job.id)

    if (mine.length === 0) {
      console.log('No pending input requests for this job.')
      return
    }

    const input = mine[0]
    console.log(`Re-attaching to input: "${input.prompt}"`)

    const answer = await pollUntilAnswered(input.id, input.timeoutSecs ?? 900)

    if (answer === null) {
      console.error('Input request timed out.')
      process.exit(1)
    }

    console.log(answer)
    return
  }

  throw new Error(`Unknown input subcommand: ${subcommand}`)
}
