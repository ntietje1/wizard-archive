import type { MutationCtx, QueryCtx } from '../_generated/server'

export type Ctx = MutationCtx | QueryCtx // ActionCtx doesn't have db access
