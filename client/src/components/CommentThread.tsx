import { useState } from 'react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Comment, InputRequest } from '../api/types'

function parseChoices(raw: string | null): { value: string; label: string }[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(c => c && typeof c.value === 'string' && typeof c.label === 'string')
  } catch {
    return []
  }
}

function ConvoInputCard({
  request,
  onAnswer,
  isPending,
}: {
  request: InputRequest
  onAnswer: (answer: string) => void
  isPending: boolean
}) {
  const [textValue, setTextValue] = useState('')
  const [freeTextValue, setFreeTextValue] = useState('')
  const [showFreeText, setShowFreeText] = useState(false)
  const choices = parseChoices(request.choices)

  return (
    <article className="relative flex gap-3 pl-4">
      <div className="relative z-10 mt-[3px] h-[7px] w-[7px] flex-shrink-0 rounded-full bg-sky-400" />
      <div className="min-w-0 flex-1 pb-1">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-[12px] font-semibold text-[var(--ink)]">
            {request.agentId}
          </span>
          <time className="text-[10px] text-[var(--dim)]">
            {new Date(request.requestedAt).toLocaleString()}
          </time>
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-[var(--muted)] whitespace-pre-wrap">
          {request.prompt}
        </p>

        {request.type === 'yesno' && (
          <div className="flex gap-2">
            <button
              onClick={() => onAnswer('yes')}
              disabled={isPending}
              className="rounded-lg border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.08)] px-4 py-1.5 text-[12px] text-[var(--ink)] transition hover:bg-[rgba(74,222,128,0.14)] disabled:opacity-50"
            >
              Yes
            </button>
            <button
              onClick={() => onAnswer('no')}
              disabled={isPending}
              className="rounded-lg border border-[var(--border)] bg-white/5 px-4 py-1.5 text-[12px] text-[var(--ink)] transition hover:bg-white/8 disabled:opacity-50"
            >
              No
            </button>
          </div>
        )}

        {request.type === 'choice' && (
          <div className="space-y-1.5">
            {choices.map((choice, i) => (
              <button
                key={choice.value}
                onClick={() => onAnswer(choice.value)}
                disabled={isPending}
                className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-left transition hover:border-[var(--border-strong)] hover:bg-white/6 disabled:opacity-50"
              >
                <span className="w-4 text-[11px] text-[var(--muted)]">{i + 1}</span>
                <span className="text-[13px] text-[var(--ink)]">{choice.label}</span>
              </button>
            ))}
            {request.allowFreeText && (
              <div className="space-y-1.5 pt-0.5">
                <button
                  onClick={() => setShowFreeText(v => !v)}
                  disabled={isPending}
                  className="flex w-full items-center gap-3 rounded-lg border border-dashed border-[var(--border-strong)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-left transition hover:bg-white/4 disabled:opacity-50"
                >
                  <span className="w-4 text-[11px] text-[var(--muted)]">{choices.length + 1}</span>
                  <span className="text-[13px] text-[var(--muted)]">Other…</span>
                </button>
                {showFreeText && (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={freeTextValue}
                      onChange={e => setFreeTextValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && freeTextValue.trim()) {
                          e.preventDefault()
                          onAnswer(freeTextValue.trim())
                        }
                      }}
                      placeholder="Type your answer…"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[rgba(5,8,12,0.84)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
                    />
                    <button
                      onClick={() => freeTextValue.trim() && onAnswer(freeTextValue.trim())}
                      disabled={!freeTextValue.trim() || isPending}
                      className="rounded-lg border border-[rgba(125,211,252,0.28)] bg-[rgba(56,189,248,0.16)] px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.22)] disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {request.type === 'text' && (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && textValue.trim()) {
                  e.preventDefault()
                  onAnswer(textValue.trim())
                }
              }}
              rows={3}
              placeholder="Type your reply..."
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-[var(--dim)]">Cmd/Ctrl+Enter to send</span>
              <button
                onClick={() => textValue.trim() && onAnswer(textValue.trim())}
                disabled={!textValue.trim() || isPending}
                className="rounded border border-[rgba(125,211,252,0.32)] bg-[rgba(56,189,248,0.18)] px-3 py-1.5 text-xs text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.24)] disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function ConvoInputRequests({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient()
  const { data: allPending = [] } = useQuery<InputRequest[]>({
    queryKey: queryKeys.inputPending,
    queryFn: () => unwrap(api.input.pending.get()),
    refetchInterval: 5_000,
  })

  const pending = allPending.filter(r => r.jobId === jobId)

  const answerMutation = useMutation({
    mutationFn: async ({ requestId, answer }: { requestId: string; answer: string }) => {
      const request = pending.find(r => r.id === requestId)
      await unwrap(api.input({ id: requestId }).answer.post({ answer }))
      if (request) {
        await unwrap(api.jobs({ id: jobId }).comments.post({ author: 'agent', agentId: request.agentId, body: request.prompt }))
      }
      await unwrap(api.jobs({ id: jobId }).comments.post({ author: 'user', body: answer }))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.inputPending })
      await queryClient.invalidateQueries({ queryKey: queryKeys.comments(jobId) })
    },
  })

  if (pending.length === 0) return null

  return (
    <div className="space-y-3">
      {pending.map(request => (
        <ConvoInputCard
          key={request.id}
          request={request}
          onAnswer={(answer) => answerMutation.mutate({ requestId: request.id, answer })}
          isPending={answerMutation.isPending}
        />
      ))}
    </div>
  )
}

export function CommentThread({ jobId, jobType }: { jobId: string; jobType: string }) {
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: queryKeys.comments(jobId),
    queryFn: () => unwrap(api.jobs({ id: jobId }).comments.get()),
  })

  const postMutation = useMutation({
    mutationFn: (body: string) =>
      unwrap(api.jobs({ id: jobId }).comments.post({ author: 'user', body })),
    onSuccess: async () => {
      setText('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.comments(jobId) })
    },
  })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          comments
        </h3>
        <span className="text-[10px] text-[var(--muted)]">{comments.length}</span>
      </div>

      {comments.length === 0 ? (
        <div className="py-4 text-sm text-[var(--muted)]">No comments yet.</div>
      ) : (
        <div className="relative space-y-4 pl-4">
          {comments.length > 1 && (
            <div className="absolute left-[3px] top-3 bottom-3 w-px bg-[var(--border)]" />
          )}
          {comments.map(comment => {
            const human = comment.author === 'user'
            return (
              <article key={comment.id} className="relative flex gap-3">
                <div
                  className={`relative z-10 mt-[3px] h-[7px] w-[7px] flex-shrink-0 rounded-full ${human ? 'bg-slate-400' : 'bg-sky-400'}`}
                />
                <div className="min-w-0 flex-1 pb-1">
                  <div className="mb-0.5 flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-[var(--ink)]">
                      {human ? 'you' : comment.agentId ?? 'agent'}
                    </span>
                    <time className="text-[10px] text-[var(--dim)]">
                      {new Date(comment.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--muted)] whitespace-pre-wrap">
                    {comment.body}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {jobType === 'convo' && <ConvoInputRequests jobId={jobId} />}

      {jobType !== 'convo' && (
        <div className="border-t border-[var(--border)] pt-3 mt-3">
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && text.trim()) {
                event.preventDefault()
                postMutation.mutate(text.trim())
              }
            }}
            placeholder="Leave a note. Cmd/Ctrl+Enter sends."
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => text.trim() && postMutation.mutate(text.trim())}
              disabled={!text.trim() || postMutation.isPending}
              className="rounded border border-[rgba(125,211,252,0.32)] bg-[rgba(56,189,248,0.18)] px-3 py-1.5 text-xs text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
