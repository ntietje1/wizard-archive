import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { noteWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'

export const getNote = campaignQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.nullable(noteWithContentValidator),
  handler: async (ctx, args) => {
    return await getSidebarItemWithContent(ctx, args.noteId, RESOURCE_TYPES.notes)
  },
})
