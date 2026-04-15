import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Comment } from '../api/types'

export function CommentThread({ jobId }: { jobId: string }) {
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: queryKeys.comments(jobId),
    queryFn: () => requestJson<Comment[]>(`/jobs/${jobId}/comments`),
  })

  const postMutation = useMutation({
    mutationFn: (body: string) =>
      requestJson<Comment>(`/jobs/${jobId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ author: 'user', body }),
      }),
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
    </section>
  )
}
