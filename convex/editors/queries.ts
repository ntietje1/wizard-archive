import { v } from 'convex/values'
import { authQuery } from '../functions'
import { editorValidator } from './schema'
import type { Editor } from './types'

export const getCurrentEditor = authQuery({
  args: { campaignId: v.optional(v.id('campaigns')) },
  returns: v.union(v.null(), editorValidator),
  handler: async (ctx, args): Promise<Editor | null> => {
    if (!args.campaignId) {
      return null
    }

    const editor = await ctx.db
      .query('editor')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', args.campaignId!).eq('userId', ctx.user.profile._id),
      )
      .unique()

    return editor
  },
})
