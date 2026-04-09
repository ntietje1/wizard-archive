import { v } from 'convex/values'
import { authMutation } from '../functions'
import { editorModeValidator, sortDirectionValidator, sortOrderValidator } from './schema'
import { setCurrentEditor as setCurrentEditorFn } from './functions/setCurrentEditor'
import type { Id } from '../_generated/dataModel'

export const setCurrentEditor = authMutation({
  args: {
    campaignId: v.id('campaigns'),
    sortOrder: v.optional(sortOrderValidator),
    sortDirection: v.optional(sortDirectionValidator),
    editorMode: v.optional(editorModeValidator),
  },
  returns: v.id('editor'),
  handler: async (ctx, args): Promise<Id<'editor'>> => {
    return setCurrentEditorFn(ctx, {
      sortOrder: args.sortOrder,
      sortDirection: args.sortDirection,
      editorMode: args.editorMode,
      campaignId: args.campaignId,
    })
  },
})
