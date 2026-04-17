import path from 'path'
import { parseArgs } from '../args'
import { apiDelete, apiGet, apiPatch, apiPost, resolveJob, type Job } from '../api'

type Mandate = { type: string; filePath: string }

async function fetchMandateContent(jobType: string, repoId: string | null): Promise<string | null> {
  try {
    if (repoId) {
      const mandates = await apiGet<Mandate[]>(`/mandates?repoId=${repoId}`)
      const match = mandates.find(m => m.type === jobType)
      if (match) {
        try { return await Bun.file(match.filePath).text() } catch { /* fall through */ }
      }
    }
    const globals = await apiGet<Mandate[]>('/mandates?repoId=global')
    const match = globals.find(m => m.type === jobType)
    if (match) {
      try { return await Bun.file(match.filePath).text() } catch { return null }
    }
    return null
  } catch {
    return null
  }
}

type JobRef = {
  id: string
  type: 'job' | 'file'
  targetJobId: string | null
  filePath: string | null
  label: string | null
  targetJob: { id: string; refNum: number; title: string; artifact: string | null } | null
}

type Comment = {
  id: string
  author: string
  agentId: string | null
  body: string
  createdAt: string
}

function printJob(job: Job) {
  console.log(`\n#${job.refNum} ${job.title}`)
  console.log(`  type:    ${job.type}`)
  console.log(`  status:  ${job.status}`)
  if (job.agentId) console.log(`  agent:   ${job.agentId}`)
  if (job.branchName) console.log(`  branch:  ${job.branchName}`)
  if (job.description) {
    console.log('\n--- DESCRIPTION ---')
    console.log(job.description)
    console.log('--- END DESCRIPTION ---')
  }
  if (job.plan) {
    console.log('\n--- PLAN ---')
    console.log(job.plan)
    console.log('--- END PLAN ---')
  }
  if (job.latestUpdate) {
    console.log('\n--- LATEST UPDATE ---')
    console.log(job.latestUpdate)
    console.log('--- END LATEST UPDATE ---')
  }
  if (job.artifact) {
    console.log('\n--- ARTIFACT ---')
    console.log(job.artifact)
    console.log('--- END ARTIFACT ---')
  }
  if ((job as Record<string, unknown>).scratchpad) {
    console.log('\n--- SCRATCHPAD ---')
    console.log((job as Record<string, unknown>).scratchpad)
    console.log('--- END SCRATCHPAD ---')
  }
  if (job.conflictedAt) console.log(`\nCONFLICTED: ${job.conflictDetails}`)
}

/** Read text from a positional arg or --from-file, whichever is provided. */
async function resolveText(args: ReturnType<typeof parseArgs>, name: string): Promise<string> {
  if (args['from-file']) {
    const filePath = args['from-file'] as string
    try {
      return (await Bun.file(filePath).text()).trimEnd()
    } catch {
      throw new Error(`Could not read file: ${filePath}`)
    }
  }
  const text = args._[0]
  if (!text) throw new Error(`${name} text is required as a positional argument or --from-file <path>`)
  return text
}

export async function jobCommands(subcommand: string, argv: string[]) {
  const args = parseArgs(argv)

  if (subcommand === 'list') {
    const params = new URLSearchParams()
    if (args.agent) params.set('agentId', args.agent)
    if (args.status) params.set('status', args.status)
    if (args.type) params.set('type', args.type)
    if (args.parent) {
      const parentJob = await resolveJob(args.parent)
      params.set('parentJobId', parentJob.id)
    }
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

    const mandateContent = await fetchMandateContent(job.type, job.repoId)
    if (mandateContent) {
      console.log('--- AGENT INSTRUCTIONS ---')
      console.log(mandateContent.trimEnd())
      console.log('--- END INSTRUCTIONS ---')
    }

    printJob(job)

    const [comments, refs] = await Promise.all([
      apiGet<Comment[]>(`/jobs/${job.id}/comments`),
      apiGet<JobRef[]>(`/jobs/${job.id}/refs`),
    ])

    if (refs.length > 0) {
      console.log('\n--- REFERENCES ---')
      for (const ref of refs) {
        if (ref.type === 'job' && ref.targetJob) {
          const label = ref.label ? ` (${ref.label})` : ''
          console.log(`[job #${ref.targetJob.refNum}] ${ref.targetJob.title}${label}`)
          // Fetch full job to get branch for impl refs
          try {
            const fullRef = await apiGet<{ type: string; branchName: string | null }>(`/jobs/${ref.targetJobId}`)
            if (fullRef.type === 'impl' && fullRef.branchName) {
              console.log(`  branch: ${fullRef.branchName}`)
            }
          } catch { /* best effort */ }
          if (ref.targetJob.artifact) {
            console.log(`  artifact:\n  ${ref.targetJob.artifact.replace(/\n/g, '\n  ')}`)
          }
        } else if (ref.type === 'file') {
          const label = ref.label ? ` (${ref.label})` : ''
          console.log(`[file] ${ref.filePath}${label}`)
          try {
            const content = await Bun.file(ref.filePath!).text()
            console.log(`  ---\n  ${content.replace(/\n/g, '\n  ')}`)
          } catch {
            console.log(`  (could not read file)`)
          }
        }
      }
      console.log('--- END REFERENCES ---')
    }

    if (comments.length > 0) {
      console.log('\n--- COMMENTS ---')
      for (const comment of comments) {
        const who = comment.author === 'agent' ? (comment.agentId ?? 'agent') : 'you'
        console.log(`[${who}] ${comment.body}`)
      }
      console.log('--- END COMMENTS ---')
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
    console.log(`created job`)
    console.log(`  ref:    #${job.refNum}`)
    console.log(`  id:     ${job.id}`)
    console.log(`  title:  ${job.title}`)
    console.log(`  type:   ${job.type}`)
    console.log(`  status: ${job.status}`)

    // Collect --ref-job and --ref-label from raw argv
    const refJobArgs: string[] = []
    const refLabelArgs: string[] = []
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--ref-job' && i + 1 < argv.length) refJobArgs.push(argv[++i])
      else if (argv[i] === '--ref-label' && i + 1 < argv.length) refLabelArgs.push(argv[++i])
    }

    for (let i = 0; i < refJobArgs.length; i++) {
      const refJob = await resolveJob(refJobArgs[i])
      await apiPost(`/jobs/${job.id}/refs`, {
        type: 'job',
        targetJobId: refJob.id,
        label: refLabelArgs[i] ?? null,
      })
    }
    if (refJobArgs.length > 0) {
      console.log(`  refs:   ${refJobArgs.length} attached`)
    }
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
    if (result.job.type === 'goal' && result.job.branchName) {
      console.log(`Integration branch: ${result.job.branchName}`)
      console.log(`Use --base ${result.job.branchName} when creating impl sub-jobs.`)
    }
    return
  }

  if (subcommand === 'plan') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    const text = await resolveText(args, 'plan')
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
    const text = await resolveText(args, 'checkpoint')
    const job = await resolveJob(args.job)
    await apiPatch(`/jobs/${job.id}`, { latestUpdate: text })
    await apiPost(`/jobs/${job.id}/comments`, {
      author: 'agent',
      agentId: args.agent,
      body: text,
    })

    const allComments = await apiGet<Comment[]>(`/jobs/${job.id}/comments`)
    const humanComments = allComments.filter(comment => comment.author === 'user')
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
    const text = await resolveText(args, 'artifact')
    const job = await resolveJob(args.job)
    await apiPatch(`/jobs/${job.id}`, { artifact: text })
    console.log(`Artifact written to job #${job.refNum}.`)
    return
  }

  if (subcommand === 'comment') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    const text = await resolveText(args, 'comment')
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
      const reviewResult = await apiPost<{ outcome: string; comment?: string }>(`/jobs/${updatedJob.id}/await-review`)
      clearInterval(timer)
      process.stdout.write('\n')

      if (reviewResult.outcome === 'lgtm') {
        console.log(`  OK  LGTM received. Job #${updatedJob.refNum} remains in-review for downstream review work.`)
      } else if (reviewResult.outcome === 'approved') {
        const finalState = updatedJob.type === 'impl' ? 'approved' : 'done'
        console.log(`  OK  Approved. Job #${updatedJob.refNum} moved to ${finalState}.`)
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

  if (subcommand === 'edit') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)
    const patch: Record<string, string> = {}
    if (args.title) patch.title = args.title
    if (args.description) patch.description = args.description
    if (Object.keys(patch).length === 0) throw new Error('at least one of --title or --description is required')
    await apiPatch(`/jobs/${job.id}`, patch)
    console.log(`Updated job #${job.refNum}.`)
    return
  }

  if (subcommand === 'scratch') {
    if (!args.job) throw new Error('--job is required')
    if (!args.agent) throw new Error('--agent is required')
    const text = await resolveText(args, 'scratch')
    const job = await resolveJob(args.job)
    await apiPost(`/jobs/${job.id}/scratch`, { agentId: args.agent, text })
    console.log(`Scratch note added to job #${job.refNum}.`)
    return
  }

  if (subcommand === 'reopen') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)
    await apiPost(`/jobs/${job.id}/reopen`)
    console.log(`Job #${job.refNum} moved back to in-progress.`)
    return
  }

  if (subcommand === 'done') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)
    await apiPost(`/jobs/${job.id}/done`)
    console.log(`Job #${job.refNum} marked done.`)
    return
  }

  throw new Error(`Unknown job subcommand: ${subcommand}`)
}
