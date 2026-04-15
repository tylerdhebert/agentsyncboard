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
        <h3 className="font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.35em] text-[var(--muted)]">
          comments
        </h3>
        <span className="text-[0.62rem] uppercase tracking-[0.25em] text-[var(--muted)]">
          {comments.length}
        </span>
      </div>

      <div className="space-y-2">
        {comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/[0.02] px-4 py-5 text-sm text-[var(--muted)]">
            No comments yet.
          </div>
        ) : (
          comments.map(comment => {
            const human = comment.author === 'user'

            return (
              <article
                key={comment.id}
                className={[
                  'rounded-2xl border px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.14)]',
                  human
                    ? 'border-[rgba(148,163,184,0.16)] bg-[rgba(255,255,255,0.03)]'
                    : 'border-[rgba(125,211,252,0.18)] bg-[rgba(56,189,248,0.06)]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.28em] text-[var(--muted)]">
                    {human ? 'you' : comment.agentId ?? 'agent'}
                  </div>
                  <time className="font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.25em] text-[var(--muted)]">
                    {new Date(comment.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-[var(--ink)]">
                  {comment.body}
                </p>
              </article>
            )
          })
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3">
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
          className="w-full resize-none rounded-xl border border-[var(--border)] bg-[rgba(5,8,12,0.7)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="font-[var(--font-ui)] text-[0.58rem] uppercase tracking-[0.3em] text-[var(--muted)]">
            human commentary
          </span>
          <button
            onClick={() => text.trim() && postMutation.mutate(text.trim())}
            disabled={!text.trim() || postMutation.isPending}
            className="rounded-full border border-[rgba(125,211,252,0.32)] bg-[rgba(56,189,248,0.18)] px-3 py-1.5 font-[var(--font-ui)] text-[0.62rem] uppercase tracking-[0.28em] text-[var(--ink)] transition hover:bg-[rgba(56,189,248,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            send
          </button>
        </div>
      </div>
    </section>
  )
}
