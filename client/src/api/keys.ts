import type { DiffType } from '../store'

export const queryKeys = {
  jobs: ['jobs'] as const,
  job: (jobId: string) => ['job', jobId] as const,
  jobDependencies: (jobId: string) => ['job', jobId, 'dependencies'] as const,
  comments: (jobId: string) => ['comments', jobId] as const,
  commentsAll: ['comments'] as const,
  diff: (jobId: string, type: DiffType) => ['diff', jobId, type] as const,
  commits: (jobId: string) => ['commits', jobId] as const,
  build: (jobId: string) => ['build', jobId] as const,
  builds: ['build'] as const,
  inputPending: ['input', 'pending'] as const,
  repos: ['repos'] as const,
  folders: ['folders'] as const,
  ws: ['ws'] as const,
}
