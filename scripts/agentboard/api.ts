const BASE = process.env.AGENTSYNCBOARD_URL ?? 'http://localhost:31377/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  return request<T>(path)
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

export type Job = {
  id: string
  refNum: number
  type: string
  title: string
  description: string | null
  repoId: string | null
  branchName: string | null
  baseBranch: string | null
  parentJobId: string | null
  folderId: string | null
  status: string
  agentId: string | null
  autoMerge: boolean
  requireReview: boolean
  plan: string | null
  latestUpdate: string | null
  artifact: string | null
  scratchpad: string | null
  handoffSummary: string | null
  blockedReason: string | null
  conflictedAt: string | null
  conflictDetails: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Resolve a job ref (number, "#42", or UUID) to a full Job object. */
export async function resolveJob(ref: string): Promise<Job> {
  const clean = ref.replace(/^#/, '')

  if (/^[0-9a-f-]{36}$/i.test(clean)) {
    return apiGet<Job>(`/jobs/${clean}`)
  }

  const num = Number.parseInt(clean, 10)
  if (Number.isNaN(num)) {
    throw new Error(`Invalid job ref: ${ref}`)
  }

  const jobs = await apiGet<Job[]>('/jobs')
  const job = jobs.find(entry => entry.refNum === num)
  if (!job) {
    throw new Error(`No job with ref #${num}`)
  }
  return job
}
