import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WS_URL } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import { sendNotification } from '../lib/notify'

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
    let socket: WebSocket
    let pingInterval: ReturnType<typeof setInterval>
    let reconnectTimeout: ReturnType<typeof setTimeout>
    let unmounted = false

    function connect() {
      socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        setWsConnected(true)
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ event: 'ping' }))
          }
        }, 30_000)
      }

      socket.onclose = () => {
        setWsConnected(false)
        clearInterval(pingInterval)
        if (!unmounted) {
          reconnectTimeout = setTimeout(connect, 3_000)
        }
      }

      socket.onerror = () => {
        socket.close()
      }

      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as Message

          if (message.event === 'pong') return

          if (message.event.startsWith('job:')) {
            queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
            const jobId = readJobId(message.data)
            if (jobId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) })
              queryClient.invalidateQueries({ queryKey: queryKeys.refs(jobId) })
            }
            if (message.event === 'job:in-review') {
              const data = message.data as { title?: string }
              sendNotification('Ready for review', data.title)
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
            const data = message.data as { id?: string; jobId?: string; prompt?: string }
            if (data.id) addPendingInput(data.id)
            queryClient.invalidateQueries({ queryKey: queryKeys.inputPending })
            queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
            if (data.jobId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.job(data.jobId) })
            }
            sendNotification('Agent needs input', data.prompt)
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
    }

    connect()

    return () => {
      unmounted = true
      clearInterval(pingInterval)
      clearTimeout(reconnectTimeout)
      socket.close()
    }
  }, [addPendingInput, queryClient, removePendingInput, setSelectedJobId, setWsConnected])
}
