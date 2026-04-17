export type JobType = 'impl' | 'plan' | 'review' | 'analysis' | 'goal' | 'arch' | 'convo'
export type JobStatus = 'open' | 'in-progress' | 'blocked' | 'in-review' | 'approved' | 'done'
export type InputType = 'yesno' | 'choice' | 'text'
export type InputStatus = 'pending' | 'answered' | 'timeout'
export type BuildStatus = 'running' | 'passed' | 'failed'

export type Repo = {
  id: string
  name: string
  path: string
  baseBranch: string
  buildCommand: string | null
  createdAt: string
  updatedAt: string
}

export type Folder = {
  id: string
  name: string
  color: string | null
  parentFolderId: string | null
  createdAt: string
}

export type Job = {
  id: string
  refNum: number
  type: JobType
  title: string
  description: string | null
  repoId: string | null
  branchName: string | null
  baseBranch: string | null
  parentJobId: string | null
  folderId: string | null
  status: JobStatus
  agentId: string | null
  autoMerge: boolean
  requireReview: boolean
  plan: string | null
  latestUpdate: string | null
  artifact: string | null
  handoffSummary: string | null
  blockedReason: string | null
  conflictedAt: string | null
  conflictDetails: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type JobDependency = {
  id: string
  blockerJobId: string
  blockedJobId: string
  createdAt: string
}

export type Comment = {
  id: string
  jobId: string
  author: 'agent' | 'user'
  agentId: string | null
  body: string
  createdAt: string
}

export type InputRequest = {
  id: string
  jobId: string
  agentId: string
  type: InputType
  prompt: string
  choices: string | null
  allowFreeText: boolean
  answer: string | null
  status: InputStatus
  previousStatus: string | null
  timeoutSecs: number | null
  requestedAt: string
  answeredAt: string | null
  jobType: string | null
}

export type BuildResult = {
  id: string
  jobId: string
  status: BuildStatus
  output: string
  triggeredAt: string
  completedAt: string | null
}

export type JobTypeMandate = {
  id: string
  type: JobType
  repoId: string | null
  filePath: string
  updatedAt: string
}

export type JobReference = {
  id: string
  jobId: string
  type: 'job' | 'file'
  targetJobId: string | null
  filePath: string | null
  label: string | null
  createdAt: string
  targetJob: {
    id: string
    refNum: number
    title: string
    artifact: string | null
  } | null
}
