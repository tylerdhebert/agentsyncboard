import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type TransitionEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Diff, Hunk, parseDiff, tokenize } from 'react-diff-view'
import type { FileData, ViewType } from 'react-diff-view'
import 'react-diff-view/style/index.css'
import refractor from 'refractor'
import { api, unwrap } from '../api/client'
import { queryKeys } from '../api/keys'
import { useStore } from '../store'
import type { DiffType } from '../store'
import type { Job } from '../api/types'

const DIFF_TYPES: { id: DiffType; label: string }[] = [
  { id: 'uncommitted', label: 'uncommitted' },
  { id: 'branch', label: 'branch' },
  { id: 'combined', label: 'combined' },
]

const VIEW_TYPES: { id: ViewType; label: string }[] = [
  { id: 'unified', label: 'unified' },
  { id: 'split', label: 'split' },
]

const DEBUG_SLOW_SEGMENTED_CONTROL = false
const DEBUG_SLOW_SEGMENTED_CONTROL_FACTOR = 10

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [segWidth, setSegWidth] = useState<number | null>(null)
  const idx = options.findIndex(o => o.id === value)
  const activeIdxRef = useRef<number>(idx)
  const prevIdxRef = useRef<number>(idx)
  const leadingEdgeRef = useRef<'left' | 'right'>('right')
  const phaseRef = useRef<'idle' | 'stretch' | 'squish' | 'bounce' | 'settle'>('idle')
  const rafRef = useRef<number | null>(null)
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  type SegmentRect = { left: number; width: number; right: number }
  type PillState = {
    left: number
    width: number
    transition: string
    darkEdgeOpacity: number
    lightEdgeOpacity: number
    edgeTransition: string
  }
  const [pill, setPill] = useState<PillState | null>(null)
  const animationRef = useRef<{
    squish: PillState
    bounce: PillState
    settle: PillState
  } | null>(null)

  function rectFor(i: number): SegmentRect | null {
    const container = containerRef.current
    const button = buttonRefs.current[i]
    if (!container || !button) return null

    const containerRect = container.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const left = buttonRect.left - containerRect.left
    const width = buttonRect.width

    return { left, width, right: left + width }
  }

  function renderedPillRect(): SegmentRect | null {
    const container = containerRef.current
    const pillNode = pillRef.current
    if (!container || !pillNode) return null

    const containerRect = container.getBoundingClientRect()
    const pillRect = pillNode.getBoundingClientRect()
    const left = pillRect.left - containerRect.left
    const width = pillRect.width

    return { left, width, right: left + width }
  }

  function pillStateFor(rect: SegmentRect, transition = 'none'): PillState {
    return {
      left: rect.left,
      width: rect.width,
      transition,
      darkEdgeOpacity: 0,
      lightEdgeOpacity: 0,
      edgeTransition: 'opacity 120ms ease-out',
    }
  }

  function transitionFor(durationMs: number, easing: string) {
    return `left ${durationMs}ms ${easing}, width ${durationMs}ms ${easing}`
  }

  function scaleMs(durationMs: number) {
    return DEBUG_SLOW_SEGMENTED_CONTROL
      ? durationMs * DEBUG_SLOW_SEGMENTED_CONTROL_FACTOR
      : durationMs
  }

  useEffect(() => {
    activeIdxRef.current = idx
  }, [idx])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    function syncLayout() {
      const buttons = buttonRefs.current.filter((button): button is HTMLButtonElement => button !== null)
      if (!buttons.length) return

      const max = Math.ceil(Math.max(...buttons.map(button => button.offsetWidth)))
      setSegWidth(prev => (prev === max ? prev : max))

      if (phaseRef.current !== 'idle') return

      const activeRect = rectFor(activeIdxRef.current)
      if (!activeRect) return

      setPill(prev => {
        if (
          prev &&
          Math.abs(prev.left - activeRect.left) < 0.5 &&
          Math.abs(prev.width - activeRect.width) < 0.5 &&
          prev.transition === 'none'
        ) {
          return prev
        }
        return pillStateFor(activeRect)
      })
      prevIdxRef.current = activeIdxRef.current
    }

    syncLayout()

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncLayout) : null
    observer?.observe(container)
    for (const button of buttonRefs.current) {
      if (button) observer?.observe(button)
    }

    return () => {
      observer?.disconnect()
    }
  }, [options.length])

  useEffect(() => {
    if (segWidth === null) return
    const prevIdx = prevIdxRef.current
    if (prevIdx === idx) return

    const start = renderedPillRect() ?? rectFor(prevIdx)
    const final = rectFor(idx)
    if (!start || !final) return

    prevIdxRef.current = idx

    const movingRight = idx > prevIdx
    leadingEdgeRef.current = movingRight ? 'right' : 'left'
    const stretchDurationMs = scaleMs(56)
    const stretchHandoffLeadMs = scaleMs(84)
    const stretchTransition = transitionFor(stretchDurationMs, 'cubic-bezier(0.26, 0.86, 0.38, 1)')
    const squishTransition = transitionFor(scaleMs(145), 'cubic-bezier(0.35, 0, 0.2, 1)')
    const bounceTransition = transitionFor(scaleMs(170), 'cubic-bezier(0.18, 0.9, 0.32, 1.22)')
    const settleTransition = transitionFor(scaleMs(180), 'cubic-bezier(0.22, 1, 0.36, 1)')
    const squishEdgeTransition = `opacity ${scaleMs(145)}ms cubic-bezier(0.35, 0, 0.2, 1)`
    const bounceEdgeTransition = `opacity ${scaleMs(170)}ms cubic-bezier(0.18, 0.9, 0.32, 1.22)`
    const settleEdgeTransition = `opacity ${scaleMs(180)}ms cubic-bezier(0.22, 1, 0.36, 1)`
    const squishInset = final.width * 0.35
    const bounceInset = Math.min(10, Math.max(4, final.width * 0.12))
    const squishWidth = final.width - squishInset

    const stretch: PillState = {
      ...pillStateFor(final),
      transition: stretchTransition,
    }

    const squish: PillState = movingRight
      ? {
          ...pillStateFor(final),
          left: final.right - squishWidth,
          width: squishWidth,
          transition: squishTransition,
          darkEdgeOpacity: 0.72,
          edgeTransition: squishEdgeTransition,
        }
      : {
          ...pillStateFor(final),
          left: final.left,
          width: squishWidth,
          transition: squishTransition,
          darkEdgeOpacity: 0.72,
          edgeTransition: squishEdgeTransition,
        }

    const bounce: PillState = movingRight
      ? {
          ...pillStateFor(final),
          left: final.left - bounceInset,
          width: final.width + bounceInset,
          transition: bounceTransition,
          lightEdgeOpacity: 0.06,
          edgeTransition: bounceEdgeTransition,
        }
      : {
          ...pillStateFor(final),
          left: final.left,
          width: final.width + bounceInset,
          transition: bounceTransition,
          lightEdgeOpacity: 0.06,
          edgeTransition: bounceEdgeTransition,
        }

    phaseRef.current = 'stretch'
    animationRef.current = {
      squish,
      bounce,
      settle: {
        ...pillStateFor(final),
        transition: settleTransition,
        edgeTransition: settleEdgeTransition,
      },
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (handoffTimerRef.current !== null) clearTimeout(handoffTimerRef.current)
    setPill({ ...pillStateFor(start), transition: 'none' })
    rafRef.current = requestAnimationFrame(() => {
      setPill(stretch)
      handoffTimerRef.current = setTimeout(() => {
        if (phaseRef.current !== 'stretch') return
        phaseRef.current = 'squish'
        handoffTimerRef.current = null
        setPill(animationRef.current?.squish ?? null)
      }, Math.max(0, stretchDurationMs - stretchHandoffLeadMs))
      rafRef.current = null
    })

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (handoffTimerRef.current !== null) {
        clearTimeout(handoffTimerRef.current)
        handoffTimerRef.current = null
      }
    }
  }, [idx, segWidth]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePillTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return

    const expectedProperty = 'width'
    if (event.propertyName !== expectedProperty) return

    const animation = animationRef.current
    if (!animation) return

    if (phaseRef.current === 'squish') {
      phaseRef.current = 'bounce'
      setPill(animation.bounce)
      return
    }

    if (phaseRef.current === 'bounce') {
      phaseRef.current = 'settle'
      setPill(animation.settle)
      return
    }

    if (phaseRef.current === 'settle') {
      phaseRef.current = 'idle'
      if (handoffTimerRef.current !== null) {
        clearTimeout(handoffTimerRef.current)
        handoffTimerRef.current = null
      }
      animationRef.current = null
      setPill(prev => (prev ? { ...prev, transition: 'none' } : prev))
    }
  }

  const darkEdgeGradient = leadingEdgeRef.current === 'right'
    ? 'linear-gradient(90deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.06) 72%, rgba(0,0,0,0.2) 86%, rgba(0,0,0,0.48) 100%)'
    : 'linear-gradient(270deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.06) 72%, rgba(0,0,0,0.2) 86%, rgba(0,0,0,0.48) 100%)'
  const lightEdgeGradient = leadingEdgeRef.current === 'right'
    ? 'linear-gradient(90deg, rgba(255,255,255,0) 48%, rgba(186,230,253,0.08) 72%, rgba(240,249,255,0.32) 100%)'
    : 'linear-gradient(270deg, rgba(255,255,255,0) 48%, rgba(186,230,253,0.08) 72%, rgba(240,249,255,0.32) 100%)'

  return (
    <div ref={containerRef} className="relative flex items-center rounded-lg border border-[var(--border)] bg-white/5 p-0.5">
      {pill !== null && (
        <div
          ref={pillRef}
          className="pointer-events-none absolute inset-y-0.5 overflow-hidden rounded-md"
          onTransitionEnd={handlePillTransitionEnd}
          style={{ left: pill.left, width: pill.width, transition: pill.transition }}
        >
          <div className="absolute inset-0 bg-[rgba(56,189,248,0.18)]" />
          <div
            className="absolute inset-0"
            style={{
              background: darkEdgeGradient,
              opacity: pill.darkEdgeOpacity,
              transition: pill.edgeTransition,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: lightEdgeGradient,
              opacity: pill.lightEdgeOpacity,
              transition: pill.edgeTransition,
            }}
          />
        </div>
      )}
      {options.map((option, optionIdx) => (
        <button
          key={option.id}
          ref={node => {
            buttonRefs.current[optionIdx] = node
          }}
          onClick={() => onChange(option.id)}
          style={segWidth !== null ? { width: segWidth } : undefined}
          className={[
            'relative z-10 rounded-md px-2.5 py-0.5 font-[var(--font-ui)] text-[0.46rem] tracking-wide transition-colors duration-150',
            value === option.id ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  css: 'css', json: 'json', py: 'python', md: 'markdown',
  sh: 'bash', bash: 'bash', html: 'html', xml: 'xml',
  yaml: 'yaml', yml: 'yaml', go: 'go', rs: 'rust',
  sql: 'sql', toml: 'toml', graphql: 'graphql', gql: 'graphql',
  rb: 'ruby', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php',
}

function getLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_LANG[ext] ?? null
}

function fileId(path: string) {
  return 'df-' + path.replace(/[^a-zA-Z0-9]/g, '-')
}

function fileParts(path: string) {
  const parts = path.split('/')
  const name = parts.pop() ?? path
  const dir = parts.join('/')
  return { name, dir }
}

const DiffFile = memo(function DiffFile({ file, viewType }: { file: FileData; viewType: ViewType }) {
  const filePath = file.newPath !== '/dev/null' ? (file.newPath ?? '') : (file.oldPath ?? '')
  const lang = getLanguage(filePath)
  const added = file.hunks.reduce((n, h) => n + h.changes.filter(c => c.type === 'insert').length, 0)
  const removed = file.hunks.reduce((n, h) => n + h.changes.filter(c => c.type === 'delete').length, 0)

  const tokens = useMemo(() => {
    if (!lang || !file.hunks.length) return undefined
    try {
      return tokenize(file.hunks, { highlight: true, refractor, language: lang })
    } catch {
      return undefined
    }
  }, [file.hunks, lang])

  return (
    <section id={fileId(filePath)} className="overflow-hidden rounded-tr-2xl rounded-br-2xl rounded-bl-2xl rounded-tl-[0.5rem] border border-[var(--border)] bg-[rgba(255,255,255,0.03)]">
      <div className="flex items-center border-b border-[var(--border)] bg-[rgba(255,255,255,0.04)]">
        <div className="flex w-14 shrink-0 items-center justify-center gap-2 border-r border-[var(--border)] px-2 py-2 font-mono text-[0.62rem]">
          <span style={{ color: '#33914c' }}>+{added}</span>
          <span style={{ color: '#912d37' }}>-{removed}</span>
        </div>
        <span className="flex-1 px-4 py-2 font-mono text-[0.685rem] tracking-wide text-[var(--ink)]">{filePath}</span>
        {file.type === 'add' && (
          <span className="mr-3 rounded-full border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.08)] px-2 py-0.5 text-[0.46rem] tracking-wide text-emerald-400">new file</span>
        )}
        {file.type === 'delete' && (
          <span className="mr-3 rounded-full border border-[rgba(248,113,113,0.22)] bg-[rgba(248,113,113,0.08)] px-2 py-0.5 text-[0.46rem] tracking-wide text-rose-400">deleted</span>
        )}
        {file.type === 'rename' && file.oldPath && file.oldPath !== file.newPath && (
          <span className="mr-3 text-[0.55rem] text-[var(--dim)]">← {file.oldPath}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <Diff viewType={viewType} diffType={file.type} hunks={file.hunks} tokens={tokens}>
          {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
        </Diff>
      </div>
    </section>
  )
})

export function DiffTab({ job }: { job: Pick<Job, 'id' | 'branchName' | 'baseBranch' | 'type'> }) {
  const diffType = useStore(state => state.diffType)
  const setDiffType = useStore(state => state.setDiffType)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewType, setViewType] = useState<ViewType>('unified')
  const [activeFile, setActiveFile] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ diff: string }>({
    queryKey: queryKeys.diff(job.id, diffType),
    queryFn: () => unwrap(api.jobs({ id: job.id }).diff.get({ query: { type: diffType } })),
    enabled: job.type === 'impl' && !!job.branchName,
  })

  const files = useMemo<FileData[]>(() => {
    if (!data?.diff) return []
    try { return parseDiff(data.diff) } catch { return [] }
  }, [data?.diff])

  if (job.type !== 'impl' || !job.branchName) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[0.92rem] text-[var(--muted)]">
        Diff view is only available for implementation jobs with a worktree.
      </div>
    )
  }

  function scrollToFile(path: string) {
    const el = scrollRef.current?.querySelector(`#${fileId(path)}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveFile(path)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[rgba(8,11,16,0.8)] px-5 py-3">
        <SegmentedControl
          options={DIFF_TYPES}
          value={diffType}
          onChange={setDiffType}
        />
        <SegmentedControl options={VIEW_TYPES} value={viewType} onChange={setViewType} />
        <div className="ml-auto font-mono text-[0.825rem] text-[var(--muted)]">
          {job.branchName} → {job.baseBranch ?? 'main'}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {files.length > 0 && (
          <div className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-3">
            {files.map(file => {
              const path = file.newPath !== '/dev/null' ? (file.newPath ?? '') : (file.oldPath ?? '')
              const { name, dir } = fileParts(path)
              const isActive = activeFile === path
              const added = file.hunks.reduce((n, h) => n + h.changes.filter(c => c.type === 'insert').length, 0)
              const removed = file.hunks.reduce((n, h) => n + h.changes.filter(c => c.type === 'delete').length, 0)
              return (
                <button
                  key={path}
                  onClick={() => scrollToFile(path)}
                  className={[
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition',
                    isActive
                      ? 'bg-[rgba(56,189,248,0.12)] text-[var(--ink)]'
                      : 'text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]',
                  ].join(' ')}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[0.825rem] leading-snug">{name}</div>
                    {dir && <div className="truncate text-[0.675rem] tracking-wide opacity-50">{dir}</div>}
                  </div>
                  <div className="flex shrink-0 gap-1.5 font-mono text-[0.725rem]">
                    {added > 0 && <span style={{ color: '#33914c' }}>+{added}</span>}
                    {removed > 0 && <span style={{ color: '#912d37' }}>-{removed}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-[0.92rem] text-[var(--muted)]">
              loading diff...
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-[0.92rem] text-[var(--muted)]">
              no changes.
            </div>
          ) : (
            <div className="space-y-4">
              {files.map(file => {
                const path = file.newPath !== '/dev/null' ? (file.newPath ?? '') : (file.oldPath ?? '')
                return <DiffFile key={path} file={file} viewType={viewType} />
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
