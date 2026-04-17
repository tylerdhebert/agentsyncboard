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

// Unwrap an Eden treaty response, throwing on error
export async function unwrap<T>(result: Promise<{ data: T | null; error: unknown } & Record<string, unknown>>): Promise<T> {
  const { data, error } = await result
  if (error) {
    const val = (error as Record<string, unknown>).value
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
