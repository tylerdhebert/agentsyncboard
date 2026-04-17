import { treaty } from '@elysiajs/eden'
import type { App } from '@server'

export const API_BASE = '/api'
export const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

export const api = treaty<App>(API_BASE, {
  keepDomain: true,
  fetch: {
    credentials: 'include',
  },
})

// EdenResult<T> matches the TreatyResponse shape from @elysiajs/eden treaty2.
// error.status is unknown (not number) when no explicit error codes are defined on the route.
type EdenResult<T> = Promise<{ data: T | null; error: { status: unknown; value: unknown } | null } & Record<string, unknown>>

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
