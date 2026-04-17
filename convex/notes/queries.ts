import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { noteWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import type { NoteWithContent } from './types'

export const getNote = campaignQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.nullable(noteWithContentValidator),
  handler: async (ctx, args) => {
    return (await getSidebarItemWithContent(ctx, args.noteId)) as NoteWithContent | null
  },
})
