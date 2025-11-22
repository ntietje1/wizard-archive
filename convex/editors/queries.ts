import { query } from '../_generated/server'
import { v } from 'convex/values'
import { requireUserIdentity } from '../common/identity'
import { Editor } from './types'
import { editorValidator } from './schema'

export const getCurrentEditor = query({
  args: { campaignId: v.optional(v.id('campaigns')) },
  returns: v.union(v.null(), editorValidator),
  handler: async (ctx, args): Promise<Editor | null> => {
    const { profile } = await requireUserIdentity(ctx)

    if (!args.campaignId) {
      return null
    }

    const editor = await ctx.db
      .query('editor')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', args.campaignId!).eq('userId', profile._id),
      )
      .unique()

    return editor
  },
})
