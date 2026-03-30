/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import prosemirrorSync from '@convex-dev/prosemirror-sync/test'
import schema from '../schema'

const modules = import.meta.glob([
  '../**/*.ts',
  '../**/*.js',
  '!../convex.config.ts',
  '!../auth.config.ts',
  '!../prosemirrorSync.ts',
  '!../http.ts',
  '!../crons.ts',
  '!../email.ts',
  '!../auth/component.ts',
  '!../**/__tests__/**',
  '!../_test/**',
])

export function createTestContext() {
  const t = convexTest(schema, modules)
  t.registerComponent(
    'prosemirrorSync',
    prosemirrorSync.schema,
    prosemirrorSync.modules,
  )
  return t
}
