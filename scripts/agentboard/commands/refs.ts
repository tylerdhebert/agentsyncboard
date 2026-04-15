import { parseArgs } from '../args'
import { apiDelete, apiGet, apiPost, resolveJob } from '../api'

type JobRef = {
  id: string
  type: 'job' | 'file'
  targetJobId: string | null
  filePath: string | null
  label: string | null
  targetJob: { id: string; refNum: number; title: string; artifact: string | null } | null
}

export async function refCommands(subcommand: string, argv: string[]) {
  const args = parseArgs(argv)

  if (subcommand === 'add') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)

    if (!args['job-ref'] && !args.file) {
      throw new Error('Either --job-ref <ref> or --file <path> is required')
    }

    if (args['job-ref']) {
      const targetJob = await resolveJob(args['job-ref'])
      const ref = await apiPost<JobRef>(`/jobs/${job.id}/refs`, {
        type: 'job',
        targetJobId: targetJob.id,
        label: args.label ?? null,
      })
      console.log(`Added reference to job #${targetJob.refNum} (ref id: ${ref.id})`)
      return
    }

    if (args.file) {
      const ref = await apiPost<JobRef>(`/jobs/${job.id}/refs`, {
        type: 'file',
        filePath: args.file,
        label: args.label ?? null,
      })
      console.log(`Added file reference: ${args.file} (ref id: ${ref.id})`)
      return
    }
  }

  if (subcommand === 'remove') {
    if (!args.job) throw new Error('--job is required')
    if (!args.ref) throw new Error('--ref <ref-id> is required')
    const job = await resolveJob(args.job)
    await apiDelete(`/jobs/${job.id}/refs/${args.ref}`)
    console.log(`Reference ${args.ref} removed.`)
    return
  }

  if (subcommand === 'list') {
    if (!args.job) throw new Error('--job is required')
    const job = await resolveJob(args.job)
    const refs = await apiGet<JobRef[]>(`/jobs/${job.id}/refs`)

    if (refs.length === 0) {
      console.log('No references on this job.')
      return
    }

    for (const ref of refs) {
      const label = ref.label ? ` "${ref.label}"` : ''
      if (ref.type === 'job' && ref.targetJob) {
        console.log(`  ${ref.id}  [job]  #${ref.targetJob.refNum} ${ref.targetJob.title}${label}`)
      } else if (ref.type === 'file') {
        console.log(`  ${ref.id}  [file] ${ref.filePath}${label}`)
      }
    }
    return
  }

  throw new Error(`Unknown ref subcommand: ${subcommand}`)
}
