import { treaty } from '@elysiajs/eden'
import type {
  BuildResult,
  Comment,
  Folder,
  InputRequest,
  Job,
  JobDependency,
  JobReference,
  JobType,
  JobTypeMandate,
  Repo,
} from './types'

export const API_BASE = '/api'
export const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

type EdenResult<T> = Promise<{ data: T | null; error: { status: number; value: unknown } | null }>

type BuildRunResult = { id: string; status: 'running' }
type BrowseResult = { path: string; sep: string; parent: string | null; entries: { name: string; isDir: boolean }[] }
type CommitsResult = { commits: { sha: string; message: string }[] }
type DiffResult = { diff: string }
type RecheckConflictsResult = { hasConflicts: boolean; files?: string[] }
type DeleteResult = { ok: true }
type ApproveResult = { ok: true; job: Job }
type CreateJobBody = {
  type: JobType
  title: string
  description?: string
  repoId?: string
  branchName?: string
  baseBranch?: string
  parentJobId?: string
  folderId?: string
  agentId?: string
  autoMerge?: boolean
  requireReview?: boolean
}
type JobPatchBody = Partial<
  Pick<
    Job,
    | 'title'
    | 'description'
    | 'status'
    | 'agentId'
    | 'folderId'
    | 'parentJobId'
    | 'autoMerge'
    | 'requireReview'
    | 'plan'
    | 'latestUpdate'
    | 'artifact'
    | 'handoffSummary'
    | 'blockedReason'
  >
> & {
  scratchpad?: string
}
type RefBody = {
  type: 'job' | 'file'
  targetJobId?: string
  filePath?: string
  label?: string
}

type ApiClient = {
  build: (params: { jobId: string }) => {
    get: () => EdenResult<BuildResult | null>
    post: () => EdenResult<BuildRunResult>
  }
  fs: {
    browse: {
      get: (options?: { query?: { path?: string; files?: string } }) => EdenResult<BrowseResult>
    }
  }
  folders: {
    get: () => EdenResult<Folder[]>
    post: (body: { name: string; color?: string; parentFolderId?: string }) => EdenResult<Folder>
  } & ((params: { id: string }) => {
    patch: (body: { name?: string; color?: string; parentFolderId?: string | null }) => EdenResult<Folder>
    delete: () => EdenResult<DeleteResult>
  })
  input: {
    pending: {
      get: () => EdenResult<InputRequest[]>
    }
  } & ((params: { id: string }) => {
    answer: {
      post: (body: { answer: string }) => EdenResult<InputRequest>
    }
  })
  jobs: {
    get: () => EdenResult<Job[]>
    post: (body: CreateJobBody) => EdenResult<Job>
  } & ((params: { id: string }) => {
    get: () => EdenResult<Job>
    patch: (body: JobPatchBody) => EdenResult<Job>
    delete: () => EdenResult<DeleteResult>
    approve: {
      post: () => EdenResult<ApproveResult>
    }
    'request-changes': {
      post: (body: { comment?: string }) => EdenResult<ApproveResult>
    }
    'recheck-conflicts': {
      post: () => EdenResult<RecheckConflictsResult>
    }
    comments: {
      get: () => EdenResult<Comment[]>
      post: (body: { author: 'agent' | 'user'; agentId?: string; body: string }) => EdenResult<Comment>
    }
    commits: {
      get: () => EdenResult<CommitsResult>
    }
    dependencies: {
      get: () => EdenResult<JobDependency[]>
    }
    diff: {
      get: (options?: { query?: { type?: 'uncommitted' | 'branch' | 'combined' } }) => EdenResult<DiffResult>
    }
    refs: {
      get: () => EdenResult<JobReference[]>
      post: (body: RefBody) => EdenResult<JobReference>
    } & ((params: { refId: string }) => {
      delete: () => EdenResult<DeleteResult>
    })
  })
  mandates: {
    get: (options?: { query?: { repoId?: string } }) => EdenResult<JobTypeMandate[]>
    put: (body: { type: JobType; repoId?: string; filePath: string }) => EdenResult<JobTypeMandate>
  } & ((params: { id: string }) => {
    delete: () => EdenResult<DeleteResult>
  })
  repos: {
    get: () => EdenResult<Repo[]>
    post: (body: { name: string; path: string; baseBranch?: string; buildCommand?: string }) => EdenResult<Repo>
  } & ((params: { id: string }) => {
    patch: (body: { name?: string; path?: string; baseBranch?: string; buildCommand?: string | null }) => EdenResult<Repo>
    delete: () => EdenResult<DeleteResult>
  })
}

export const api = treaty(API_BASE, {
  keepDomain: true,
  fetch: {
    credentials: 'include',
  },
}) as unknown as ApiClient

// Unwrap an Eden treaty response, throwing on error
export async function unwrap<T>(result: EdenResult<T>): Promise<T> {
  const { data, error } = await result
  if (error) {
    const val = error.value
    let msg: string
    if (typeof val === 'string') msg = val
    else if (val && typeof val === 'object' && 'error' in val) msg = String((val as Record<string, unknown>).error)
    else if (val instanceof Error) msg = val.message
    else msg = JSON.stringify(val)
    throw new Error(msg)
  }
  return data as T
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body !== undefined && !('Content-Type' in (init?.headers ?? {})) && !('content-type' in (init?.headers ?? {}))
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
