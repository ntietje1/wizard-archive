import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { compactUpdates } from './functions/compactUpdates'
import { AWARENESS_TTL_MS } from './constants'

export const compact = internalMutation({
  args: {
    documentId: v.id('notes'),
  },
  handler: async (ctx, { documentId }) => {
    await compactUpdates(ctx, documentId)
  },
})

export const cleanupStaleAwareness = internalMutation({
  args: {},
  handler: async (ctx) => {
    const staleThreshold = Date.now() - AWARENESS_TTL_MS
    const stale = await ctx.db
      .query('yjsAwareness')
      .withIndex('by_updatedAt', (q) => q.lt('updatedAt', staleThreshold))
      .collect()
    await Promise.all(stale.map((row) => ctx.db.delete(row._id)))
  },
})
