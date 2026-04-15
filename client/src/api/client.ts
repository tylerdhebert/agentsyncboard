import { treaty } from '@elysiajs/eden'
import type { App } from '@server'

export const API_BASE = '/api'
export const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

export const api = treaty<App>('', {
  fetch: {
    credentials: 'include',
  },
})

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
