import path from 'path'
import { parseArgs } from '../args'
import { apiGet, apiPatch, apiPost, resolveJob, type Job } from '../api'

function printJob(job: Job) {
  console.log(`\n#${job.refNum} ${job.title}`)
  console.log(`  type:    ${job.type}`)
  console.log(`  status:  ${job.status}`)
  if (job.agentId) console.log(`  agent:   ${job.agentId}`)
  if (job.branchName) console.log(`  branch:  ${job.branchName}`)
  if (job.description) console.log(`\n  description:\n  ${job.description}`)
  if (job.plan) console.log(`\n  plan:\n  ${job.plan}`)
  if (job.latestUpdate) console.log(`\n  latest update:\n  ${job.latestUpdate}`)
  if (job.artifact) console.log(`\n  artifact:\n  ${job.artifact}`)
  if (job.conflictedAt) console.log(`\n  CONFLICTED: ${job.conflictDetails}`)
}

export async function jobCommands(subcommand: string, argv: string[]) {
  const args = parseArgs(argv)

  if (subcommand === 'list') {
    const params = new URLSearchParams()
    if (args.agent) params.set('agentId', args.agent)
    if (args.status) params.set('status', args.status)
    const query = params.toString()
    const jobs = await apiGet<Job[]>(`/jobs${query ? `?${query}` : ''}`)
    if (jobs.length === 0) {
      console.log('No jobs found.')
      return
    }
    for (const job of jobs) {
      const conflict = job.conflictedAt ? ' !' : ''
      console.log(`#${job.refNum}  ${job.status.padEnd(12)}  [${job.type}]  ${job.title}${conflict}`)
    }
    return
  }

  if (subcommand === 'context') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)
    printJob(job)

    const comments = await apiGet<Array<{
      id: string
      author: string
      agentId: string | null
      body: string
      createdAt: string
    }>>(`/jobs/${job.id}/comments`)

    if (comments.length > 0) {
      console.log('\n  comments:')
      for (const comment of comments) {
        const who = comment.author === 'agent' ? (comment.agentId ?? 'agent') : 'you'
        console.log(`  [${who}] ${comment.body}`)
      }
    }
    return
  }

  if (subcommand === 'create') {
    if (!args.title) throw new Error('--title is required')
    if (!args.type) throw new Error('--type is required')

    const body: Record<string, unknown> = {
      title: args.title,
      type: args.type,
    }

    if (args.parent) {
      const parent = await resolveJob(args.parent)
      body.parentJobId = parent.id
    }
    if (args.repo) body.repoId = args.repo
    if (args.branch) body.branchName = args.branch
    if (args.base) body.baseBranch = args.base
    if (args.description) body.description = args.description

    const job = await apiPost<Job>('/jobs', body)
    console.log(`Created job #${job.refNum}: ${job.title}`)
    return
  }

  if (subcommand === 'claim') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    const job = await resolveJob(args.job)
    const result = await apiPost<{ job: Job; worktreePath: string | null }>(
      `/jobs/${job.id}/claim`,
      { agentId: args.agent }
    )
    console.log(`Claimed job #${result.job.refNum}: ${result.job.title}`)
    if (result.worktreePath) {
      console.log(`Worktree: ${result.worktreePath}`)
    }
    return
  }

  if (subcommand === 'plan') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    const text = args._[0]
    if (!text) throw new Error('plan text is required as a positional argument')
    const job = await resolveJob(args.job)
    await apiPatch(`/jobs/${job.id}`, { plan: text })
    await apiPost(`/jobs/${job.id}/comments`, {
      author: 'agent',
      agentId: args.agent,
      body: `[plan] ${text}`,
    })
    console.log(`Plan written to job #${job.refNum}.`)
    return
  }

  if (subcommand === 'checkpoint') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    const text = args._[0]
    if (!text) throw new Error('checkpoint text is required as a positional argument')
    const job = await resolveJob(args.job)
    await apiPatch(`/jobs/${job.id}`, { latestUpdate: text })
    await apiPost(`/jobs/${job.id}/comments`, {
      author: 'agent',
      agentId: args.agent,
      body: text,
    })

    const comments = await apiGet<Array<{
      author: string
      agentId: string | null
      body: string
    }>>(`/jobs/${job.id}/comments`)
    const humanComments = comments.filter(comment => comment.author === 'user')
    if (humanComments.length > 0) {
      console.log('\nCheckpoint saved. Human comments on this job:')
      for (const comment of humanComments) {
        console.log(`  > ${comment.body}`)
      }
    } else {
      console.log('Checkpoint saved.')
    }
    return
  }

  if (subcommand === 'artifact') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    const text = args._[0]
    if (!text) throw new Error('artifact text is required as a positional argument')
    const job = await resolveJob(args.job)
    await apiPatch(`/jobs/${job.id}`, { artifact: text })
    console.log(`Artifact written to job #${job.refNum}.`)
    return
  }

  if (subcommand === 'comment') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    const text = args._[0]
    if (!text) throw new Error('comment text is required as a positional argument')
    const job = await resolveJob(args.job)
    await apiPost(`/jobs/${job.id}/comments`, {
      author: 'agent',
      agentId: args.agent,
      body: text,
    })
    console.log(`Comment posted on job #${job.refNum}.`)
    return
  }

  if (subcommand === 'ready') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)

    const result = await apiPost<{
      status: 'in-review' | 'conflicted'
      files?: string[]
      details?: string
      job?: Job
    }>(`/jobs/${job.id}/ready`)

    if (result.status === 'conflicted') {
      console.error('\n  X Conflicts detected against base branch.')
      if (result.files?.length) {
        for (const file of result.files) {
          console.error(`     ${file}`)
        }
      }
      if (result.details) {
        console.error('\n  Conflict details:')
        console.error(result.details)
      }
      console.error('\n  Resolve conflicts in your worktree and re-run agentboard job ready.')
      process.exit(1)
    }

    const updatedJob = result.job ?? (await resolveJob(args.job))
    if (!updatedJob.requireReview) {
      console.log(`  OK  Job #${updatedJob.refNum} moved to in-review.`)
      return
    }

    console.log('  ... In review - waiting for human approval')
    let elapsed = 0
    const timer = setInterval(() => {
      elapsed += 1
      process.stdout.write(`\r     ${elapsed} seconds elapsed...  `)
    }, 1000)

    try {
      const reviewResult = await apiPost<{ outcome: string; comment?: string }>(
        `/jobs/${job.id}/await-review`
      )
      clearInterval(timer)
      process.stdout.write('\n')

      if (reviewResult.outcome === 'approved') {
        console.log(`  OK  Approved. Job #${updatedJob.refNum} marked done.`)
      } else if (reviewResult.outcome === 'changes-requested') {
        console.log('\n  Return changes requested.')
        if (reviewResult.comment) {
          console.log(`     "${reviewResult.comment}"`)
        }
        console.log(`     Job #${updatedJob.refNum} moved back to in-progress.`)
        process.exit(1)
      } else {
        console.log('  Timed out waiting for review.')
        process.exit(1)
      }
    } catch (error) {
      clearInterval(timer)
      process.stdout.write('\n')
      throw error
    }
    return
  }

  if (subcommand === 'worktree') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)
    if (job.type !== 'impl' || !job.repoId || !job.branchName) {
      throw new Error('worktree path only available for impl jobs with a branch')
    }
    const repo = await apiGet<{ path: string }>(`/repos/${job.repoId}`)
    const wtPath = path.join(repo.path, '..', '.git-worktrees', job.branchName)
    console.log(wtPath)
    return
  }

  throw new Error(`Unknown job subcommand: ${subcommand}`)
}
