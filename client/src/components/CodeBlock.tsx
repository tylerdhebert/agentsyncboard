import { useEffect, useState } from 'react'
import { codeToHtml } from 'shiki'

type Props = {
  code: string
  language: string
  theme: string
}

export function CodeBlock({ code, language, theme }: Props) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    codeToHtml(code, { lang: language, theme })
      .catch(() => codeToHtml(code, { lang: 'text', theme }))
      .then(result => { if (!cancelled) setHtml(result) })
      .catch(() => { if (!cancelled) setHtml(null) })
    return () => { cancelled = true }
  }, [code, language, theme])

  if (html) {
    return (
      <div
        className="mb-3 last:mb-0 overflow-hidden rounded-lg border border-[var(--border)] [&>pre]:m-0 [&>pre]:overflow-x-auto [&>pre]:px-4 [&>pre]:py-3 [&>pre]:text-xs [&>pre]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <pre className="mb-3 last:mb-0 overflow-x-auto rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.3)] px-4 py-3">
      <code className="font-mono text-xs leading-relaxed text-[var(--ink)]">{code}</code>
    </pre>
  )
}
