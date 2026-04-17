import type { CSSProperties, ReactNode } from 'react'

type AnsiState = {
  foreground: string | null
  background: string | null
  bold: boolean
  dim: boolean
  italic: boolean
  underline: boolean
}

type AnsiSegment = {
  text: string
  style: CSSProperties | undefined
}

const DEFAULT_STATE: AnsiState = {
  foreground: null,
  background: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
}

const ANSI_PATTERN = /\u001b\[([0-9;]*)m/g

const ANSI_COLORS: Record<number, string> = {
  30: '#0f172a',
  31: '#f87171',
  32: '#4ade80',
  33: '#facc15',
  34: '#60a5fa',
  35: '#f472b6',
  36: '#22d3ee',
  37: '#e5e7eb',
  90: '#64748b',
  91: '#fca5a5',
  92: '#86efac',
  93: '#fde047',
  94: '#93c5fd',
  95: '#f9a8d4',
  96: '#67e8f9',
  97: '#f8fafc',
  40: '#0f172a',
  41: '#7f1d1d',
  42: '#166534',
  43: '#854d0e',
  44: '#1d4ed8',
  45: '#9d174d',
  46: '#155e75',
  47: '#e5e7eb',
  100: '#334155',
  101: '#ef4444',
  102: '#22c55e',
  103: '#eab308',
  104: '#3b82f6',
  105: '#ec4899',
  106: '#06b6d4',
  107: '#f8fafc',
}

function normalizeCarriageReturns(input: string) {
  return input
    .split('\n')
    .map(line => {
      const parts = line.split('\r')
      if (parts.length === 1) return line

      let current = ''
      for (const part of parts) {
        current = part + current.slice(part.length)
      }
      return current
    })
    .join('\n')
}

function xterm256Color(index: number) {
  if (index < 16) {
    const standardMap: Record<number, string> = {
      0: '#0f172a',
      1: '#f87171',
      2: '#4ade80',
      3: '#facc15',
      4: '#60a5fa',
      5: '#f472b6',
      6: '#22d3ee',
      7: '#e5e7eb',
      8: '#64748b',
      9: '#fca5a5',
      10: '#86efac',
      11: '#fde047',
      12: '#93c5fd',
      13: '#f9a8d4',
      14: '#67e8f9',
      15: '#f8fafc',
    }
    return standardMap[index]
  }

  if (index >= 16 && index <= 231) {
    const value = index - 16
    const r = Math.floor(value / 36)
    const g = Math.floor((value % 36) / 6)
    const b = value % 6
    const toChannel = (component: number) => (component === 0 ? 0 : component * 40 + 55)
    return `rgb(${toChannel(r)}, ${toChannel(g)}, ${toChannel(b)})`
  }

  const gray = 8 + (index - 232) * 10
  return `rgb(${gray}, ${gray}, ${gray})`
}

function nextColor(params: number[], index: number) {
  const mode = params[index + 1]
  if (mode === 5 && typeof params[index + 2] === 'number') {
    return { color: xterm256Color(params[index + 2]!), consumed: 2 }
  }

  if (
    mode === 2 &&
    typeof params[index + 2] === 'number' &&
    typeof params[index + 3] === 'number' &&
    typeof params[index + 4] === 'number'
  ) {
    const [r, g, b] = [params[index + 2]!, params[index + 3]!, params[index + 4]!]
    return { color: `rgb(${r}, ${g}, ${b})`, consumed: 4 }
  }

  return { color: null, consumed: 0 }
}

function applySgr(state: AnsiState, rawParams: string) {
  const params = rawParams.length > 0
    ? rawParams.split(';').map(part => Number(part || '0'))
    : [0]

  let next = { ...state }

  for (let i = 0; i < params.length; i += 1) {
    const code = params[i] ?? 0

    if (code === 0) {
      next = { ...DEFAULT_STATE }
    } else if (code === 1) {
      next.bold = true
      next.dim = false
    } else if (code === 2) {
      next.dim = true
      next.bold = false
    } else if (code === 3) {
      next.italic = true
    } else if (code === 4) {
      next.underline = true
    } else if (code === 22) {
      next.bold = false
      next.dim = false
    } else if (code === 23) {
      next.italic = false
    } else if (code === 24) {
      next.underline = false
    } else if (code === 39) {
      next.foreground = null
    } else if (code === 49) {
      next.background = null
    } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
      next.foreground = ANSI_COLORS[code]
    } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
      next.background = ANSI_COLORS[code]
    } else if (code === 38 || code === 48) {
      const { color, consumed } = nextColor(params, i)
      if (color) {
        if (code === 38) next.foreground = color
        if (code === 48) next.background = color
      }
      i += consumed
    }
  }

  return next
}

function styleForState(state: AnsiState): CSSProperties | undefined {
  const style: CSSProperties = {}

  if (state.foreground) style.color = state.foreground
  if (state.background) style.backgroundColor = state.background
  if (state.bold) style.fontWeight = 700
  if (state.dim) style.opacity = 0.7
  if (state.italic) style.fontStyle = 'italic'
  if (state.underline) style.textDecorationLine = 'underline'

  return Object.keys(style).length > 0 ? style : undefined
}

function parseAnsi(input: string) {
  const text = normalizeCarriageReturns(input)
  const segments: AnsiSegment[] = []
  let state = { ...DEFAULT_STATE }
  let lastIndex = 0

  for (const match of text.matchAll(ANSI_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, index),
        style: styleForState(state),
      })
    }

    state = applySgr(state, match[1] ?? '')
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      style: styleForState(state),
    })
  }

  return segments
}

export function AnsiText({ text }: { text: string }) {
  const segments = parseAnsi(text)

  if (segments.length === 0) return null

  return (
    <>
      {segments.map((segment, index): ReactNode => (
        <span key={index} style={segment.style}>
          {segment.text}
        </span>
      ))}
    </>
  )
}
