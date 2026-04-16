/**
 * Type-only re-export for use by the Vite client build.
 * This file must NOT import anything with bun-native modules.
 *
 * The App type is the Elysia app instance type — Eden treaty uses it to
 * derive fully-typed API client calls with zero codegen.
 */
export type { App } from './app'
