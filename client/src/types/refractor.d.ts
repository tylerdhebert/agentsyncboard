declare module 'refractor' {
  import type { Root } from 'hast'

  interface RefractorRoot extends Root {
    relevance?: number
  }

  interface Refractor {
    highlight(value: string, language: string): RefractorRoot
    register(syntax: unknown): void
    alias(name: string, alias: string | string[]): void
    registered(language: string): boolean
    listLanguages(): string[]
  }

  const refractor: Refractor
  export default refractor
}
