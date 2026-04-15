import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WS_URL } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'

type Message = { event: string; data: unknown }

function readJobId(data: unknown) {
  if (!data || typeof data !== 'object') return null
  const payload = data as { id?: unknown; jobId?: unknown }
  const value = payload.jobId ?? payload.id
  return typeof value === 'string' && value.trim() ? value : null
}

export function useWebSocket() {
  const queryClient = useQueryClient()
  const setWsConnected = useStore(state => state.setWsConnected)
  const addPendingInput = useStore(state => state.addPendingInput)
  const removePendingInput = useStore(state => state.removePendingInput)
  const setSelectedJobId = useStore(state => state.setSelectedJobId)

  useEffect(() => {
    const socket = new WebSocket(WS_URL)

    socket.onopen = () => setWsConnected(true)
    socket.onclose = () => setWsConnected(false)
    socket.onerror = () => setWsConnected(false)

    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as Message

        if (message.event.startsWith('job:')) {
          queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
          const jobId = readJobId(message.data)
          if (jobId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) })
          }
        }

        if (message.event.startsWith('comment:')) {
          queryClient.invalidateQueries({ queryKey: queryKeys.commentsAll })
          const jobId = readJobId(message.data)
          if (jobId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.comments(jobId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) })
          }
        }

        if (message.event.startsWith('build:')) {
          queryClient.invalidateQueries({ queryKey: queryKeys.builds })
          const jobId = readJobId(message.data)
          if (jobId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.build(jobId) })
          }
        }

        if (message.event === 'input:created') {
          const data = message.data as { id?: string; jobId?: string }
          if (data.id) addPendingInput(data.id)
          queryClient.invalidateQueries({ queryKey: queryKeys.inputPending })
          queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
          if (data.jobId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.job(data.jobId) })
          }
        }

        if (message.event === 'input:answered') {
          const data = message.data as { id?: string; jobId?: string }
          if (data.id) removePendingInput(data.id)
          queryClient.invalidateQueries({ queryKey: queryKeys.inputPending })
          queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
          if (data.jobId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.job(data.jobId) })
          }
        }

        if (message.event.startsWith('repo:')) {
          queryClient.invalidateQueries({ queryKey: queryKeys.repos })
        }

        if (message.event === 'job:deleted') {
          const data = message.data as { id?: string }
          if (data.id) {
            queryClient.removeQueries({ queryKey: queryKeys.job(data.id) })
            queryClient.removeQueries({ queryKey: queryKeys.comments(data.id) })
            queryClient.removeQueries({ queryKey: queryKeys.build(data.id) })
            queryClient.removeQueries({ queryKey: queryKeys.jobDependencies(data.id) })
            const selectedJobId = useStore.getState().selectedJobId
            setSelectedJobId(selectedJobId === data.id ? null : selectedJobId)
          }
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    }

    return () => {
      socket.close()
    }
  }, [addPendingInput, queryClient, removePendingInput, setSelectedJobId, setWsConnected])
}
