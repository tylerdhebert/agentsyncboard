import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import type { InputRequest } from '../api/types'

type Choice = { value: string; label: string }

function parseChoices(raw: string | null): Choice[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((choice): choice is Choice => {
      if (!choice || typeof choice !== 'object') return false
      const item = choice as Choice
      return typeof item.value === 'string' && typeof item.label === 'string'
    })
  } catch {
    return []
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.matches('input, textarea, select, [contenteditable="true"]')
}

export function InputOverlay() {
  const queryClient = useQueryClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [textAnswer, setTextAnswer] = useState('')
  const [freeTextValue, setFreeTextValue] = useState('')
  const [showFreeText, setShowFreeText] = useState(false)

  const { data: pending = [] } = useQuery<InputRequest[]>({
    queryKey: queryKeys.inputPending,
    queryFn: () => requestJson<InputRequest[]>('/input/pending'),
    refetchInterval: 5_000,
  })

  const modalPending = pending.filter(input => input.jobType !== 'convo')

  useEffect(() => {
    if (currentIndex >= modalPending.length) {
      setCurrentIndex(0)
    }
  }, [currentIndex, modalPending.length])

  const current = modalPending[currentIndex] ?? null
  const choices = useMemo(() => parseChoices(current?.choices ?? null), [current?.choices])

  useEffect(() => {
    setTextAnswer('')
    setFreeTextValue('')
    setShowFreeText(false)
  }, [current?.id])

  const answerMutation = useMutation({
    mutationFn: ({ id, jobId, answer }: { id: string; jobId: string; answer: string }) =>
      requestJson<InputRequest>(`/input/${id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      }),
    onSuccess: async (_saved, variables) => {
      setTextAnswer('')
      setFreeTextValue('')
      setShowFreeText(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.inputPending })
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
      await queryClient.invalidateQueries({ queryKey: queryKeys.job(variables.jobId) })
      setCurrentIndex(index => Math.min(index, Math.max(0, modalPending.length - 2)))
    },
  })

  const submit = useCallback(
    (answer: string) => {
      if (!current || answerMutation.isPending) return
      const trimmed = answer.trim()
      if (!trimmed && current.type !== 'yesno') return

      answerMutation.mutate({
        id: current.id,
        jobId: current.jobId,
        answer: trimmed || answer,
      })
    },
    [answerMutation, current]
  )

  useEffect(() => {
    if (!current) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        return
      }

      if (isEditableTarget(event.target) && !(event.metaKey || event.ctrlKey)) return

      if (current.type === 'yesno') {
        if (event.key === '1' || event.key.toLowerCase() === 'y') {
          event.preventDefault()
          submit('yes')
        }
        if (event.key === '2' || event.key.toLowerCase() === 'n') {
          event.preventDefault()
          submit('no')
        }
        return
      }

      if (current.type === 'choice') {
        const index = Number.parseInt(event.key, 10) - 1
        if (!Number.isNaN(index) && index >= 0 && index < choices.length) {
          event.preventDefault()
          submit(choices[index].value)
          return
        }

        if (current.allowFreeText && event.key === String(choices.length + 1)) {
          event.preventDefault()
          setShowFreeText(true)
        }
        return
      }

      if (current.type === 'text' && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        submit(textAnswer)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [choices, current, submit, textAnswer])

  if (!current) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(2,4,8,0.74)] px-4 py-5 backdrop-blur-2xl">
      <div className="glass-panel w-full max-w-2xl overflow-hidden rounded-[28px] border-[rgba(125,211,252,0.18)] bg-[rgba(10,14,20,0.94)] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex flex-col">
            <span className="font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.35em] text-[var(--accent)]">
              {current.agentId} needs input
            </span>
            <span className="mt-1 font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.3em] text-[var(--muted)]">
              job #{current.jobId}
            </span>
          </div>
          {modalPending.length > 1 && (
            <div className="ml-auto flex items-center gap-2 text-[0.58rem] uppercase tracking-[0.3em] text-[var(--muted)]">
              <button
                onClick={() => setCurrentIndex(index => (index - 1 + modalPending.length) % modalPending.length)}
                className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1 transition hover:border-[var(--border-strong)] hover:bg-white/10 hover:text-[var(--ink)]"
              >
                {'<-'} prev
              </button>
              <span>{currentIndex + 1}/{modalPending.length}</span>
              <button
                onClick={() => setCurrentIndex(index => (index + 1) % modalPending.length)}
                className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1 transition hover:border-[var(--border-strong)] hover:bg-white/10 hover:text-[var(--ink)]"
              >
                next {'->'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-5 px-5 py-5">
          <p className="text-[0.98rem] leading-relaxed text-[var(--ink)]">{current.prompt}</p>

          {current.type === 'yesno' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => submit('yes')}
                disabled={answerMutation.isPending}
                className="rounded-2xl border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.1)] px-4 py-4 text-left transition hover:bg-[rgba(74,222,128,0.16)] disabled:opacity-50"
              >
                <span className="block font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.3em] text-[rgba(74,222,128,0.9)]">
                  1 / y
                </span>
                <span className="mt-2 block text-lg text-[var(--ink)]">Yes</span>
              </button>
              <button
                onClick={() => submit('no')}
                disabled={answerMutation.isPending}
                className="rounded-2xl border border-[var(--border)] bg-white/5 px-4 py-4 text-left transition hover:border-[var(--border-strong)] hover:bg-white/10 disabled:opacity-50"
              >
                <span className="block font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.3em] text-[var(--muted)]">
                  2 / n
                </span>
                <span className="mt-2 block text-lg text-[var(--ink)]">No</span>
              </button>
            </div>
          )}

          {current.type === 'choice' && (
            <div className="space-y-2">
              {choices.map((choice, index) => (
                <button
                  key={choice.value}
                  onClick={() => submit(choice.value)}
                  disabled={answerMutation.isPending}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] hover:bg-white/8 disabled:opacity-50"
                >
                  <span className="w-5 font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.3em] text-[var(--muted)]">
                    {index + 1}
                  </span>
                  <span className="text-[0.95rem] text-[var(--ink)]">{choice.label}</span>
                </button>
              ))}

              {current.allowFreeText && (
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setShowFreeText(prev => !prev)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-left transition hover:bg-white/5"
                  >
                    <span className="w-5 font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.3em] text-[var(--muted)]">
                      {choices.length + 1}
                    </span>
                    <span className="text-[0.95rem] text-[var(--muted)]">Other...</span>
                  </button>

                  {showFreeText && (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={freeTextValue}
                        onChange={event => setFreeTextValue(event.target.value)}
                        placeholder="Type your answer..."
                        className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[rgba(5,8,12,0.84)] px-4 py-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
                        onKeyDown={event => {
                          if (event.key === 'Enter' && freeTextValue.trim()) {
                            event.preventDefault()
                            submit(freeTextValue)
                          }
                        }}
                      />
                      <button
                        onClick={() => submit(freeTextValue)}
                        disabled={!freeTextValue.trim() || answerMutation.isPending}
                        className="rounded-2xl border border-[rgba(125,211,252,0.28)] bg-[rgba(56,189,248,0.16)] px-4 py-3 text-sm text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.22)] disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {current.type === 'text' && (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={textAnswer}
                onChange={event => setTextAnswer(event.target.value)}
                rows={4}
                placeholder="Type your answer..."
                className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[rgba(5,8,12,0.84)] px-4 py-3 text-sm leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.28em] text-[var(--muted)]">
                  Cmd/Ctrl + Enter to send
                </span>
                <button
                  onClick={() => submit(textAnswer)}
                  disabled={!textAnswer.trim() || answerMutation.isPending}
                  className="rounded-full border border-[rgba(125,211,252,0.28)] bg-[rgba(56,189,248,0.16)] px-4 py-2 text-[0.72rem] uppercase tracking-[0.25em] text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.22)] disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-3 text-center font-[var(--font-ui)] text-[0.56rem] uppercase tracking-[0.32em] text-[var(--muted)]">
            1/2/3 to choose · Esc is ignored so the request stays visible
          </div>
        </div>
      </div>
    </div>
  )
}
