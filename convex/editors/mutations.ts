import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { SORT_DIRECTIONS, SORT_ORDERS } from './types'
import type { Id } from '../_generated/dataModel'

export const setCurrentEditor = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    sortOrder: v.optional(
      v.union(
        v.literal(SORT_ORDERS.Alphabetical),
        v.literal(SORT_ORDERS.DateCreated),
        v.literal(SORT_ORDERS.DateModified),
      ),
    ),
    sortDirection: v.optional(
      v.union(
        v.literal(SORT_DIRECTIONS.Ascending),
        v.literal(SORT_DIRECTIONS.Descending),
      ),
    ),
    sidebarWidth: v.optional(v.number()),
    isSidebarExpanded: v.optional(v.boolean()),
  },
  returns: v.id('editor'),
  handler: async (ctx, args): Promise<Id<'editor'>> => {
    const campaignId = ctx.campaign._id

    const editor = await ctx.db
      .query('editor')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', campaignId).eq('userId', ctx.user.profile._id),
      )
      .unique()

    if (!editor) {
      return await ctx.db.insert('editor', {
        userId: ctx.user.profile._id,
        campaignId,
        sortOrder: args.sortOrder ?? SORT_ORDERS.DateCreated,
        sortDirection: args.sortDirection ?? SORT_DIRECTIONS.Ascending,
        sidebarWidth: args.sidebarWidth,
        isSidebarExpanded: args.isSidebarExpanded,
      })
    }

    await ctx.db.patch(editor._id, {
      ...(args.sortOrder !== undefined && { sortOrder: args.sortOrder }),
      ...(args.sortDirection !== undefined && {
        sortDirection: args.sortDirection,
      }),
      ...(args.sidebarWidth !== undefined && {
        sidebarWidth: args.sidebarWidth,
      }),
      ...(args.isSidebarExpanded !== undefined && {
        isSidebarExpanded: args.isSidebarExpanded,
      }),
    })

    return editor._id
  },
})
