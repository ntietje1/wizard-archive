/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob([
  '../**/*.ts',
  '../**/*.js',
  '!../convex.config.ts',
  '!../auth.config.ts',
  '!../http.ts',
  '!../crons.ts',
  '!../email.ts',
  '!../auth/component.ts',
  '!../**/__tests__/**',
  '!../_test/**',
])

export function createTestContext(transactionLimits = false) {
  const t = convexTest({ schema, modules, transactionLimits })
  return t
}
