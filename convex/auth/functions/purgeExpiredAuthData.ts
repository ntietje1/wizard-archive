import { components, internal } from '../../_generated/api'
import type { MutationCtx } from '../../_generated/server'

const BATCH_SIZE = 500

interface DeleteManyResult {
  isDone: boolean
}

export async function purgeExpiredAuthData(ctx: MutationCtx): Promise<void> {
  const now = Date.now()
  const paginationOpts = { cursor: null, numItems: BATCH_SIZE }

  const [sessions, verifications] = await Promise.all([
    ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: 'session',
        where: [{ field: 'expiresAt', operator: 'lt', value: now }],
      },
      paginationOpts,
    }),
    ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: 'verification',
        where: [{ field: 'expiresAt', operator: 'lt', value: now }],
      },
      paginationOpts,
    }),
  ])

  const sessionsResult = sessions as DeleteManyResult
  const verificationsResult = verifications as DeleteManyResult
  const hasMore = sessionsResult.isDone === false || verificationsResult.isDone === false

  if (hasMore) {
    await ctx.scheduler.runAfter(1000, internal.auth.internalMutations.purgeExpiredAuthData)
  }
}
