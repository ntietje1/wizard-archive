import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { sortDirectionValidator, sortOrderValidator } from './schema'
import { setCurrentEditor as setCurrentEditorFn } from './functions/setCurrentEditor'
import type { Id } from '../_generated/dataModel'

export const setCurrentEditor = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    sortOrder: v.optional(sortOrderValidator),
    sortDirection: v.optional(sortDirectionValidator),
    sidebarWidth: v.optional(v.number()),
    isSidebarExpanded: v.optional(v.boolean()),
  },
  returns: v.id('editor'),
  handler: async (ctx, args): Promise<Id<'editor'>> => {
    return setCurrentEditorFn(
      ctx,
      args.sortOrder,
      args.sortDirection,
      args.sidebarWidth,
      args.isSidebarExpanded,
    )
  },
})
