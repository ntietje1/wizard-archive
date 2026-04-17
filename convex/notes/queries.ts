import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { noteWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

export const getNote = campaignQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.nullable(noteWithContentValidator),
  handler: async (ctx, args) => {
    return await getSidebarItemWithContent(ctx, args.noteId, SIDEBAR_ITEM_TYPES.notes)
  },
})
