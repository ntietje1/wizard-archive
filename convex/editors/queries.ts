import { v } from 'convex/values'
import { authQuery } from '../functions'
import { editorValidator } from './schema'
import { getCurrentEditor as getCurrentEditorFn } from './functions/getCurrentEditor'
import type { Editor } from './types'

export const getCurrentEditor = authQuery({
  args: { campaignId: v.optional(v.id('campaigns')) },
  returns: v.union(v.null(), editorValidator),
  handler: async (ctx, args): Promise<Editor | null> => {
    return getCurrentEditorFn(ctx, args.campaignId)
  },
})
