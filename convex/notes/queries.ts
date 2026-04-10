import { v } from 'convex/values'
import { authQuery } from '../functions'
import { noteWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import type { NoteWithContent } from './types'

export const getNote = authQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.union(noteWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<NoteWithContent | null> => {
    return (await getSidebarItemWithContent(ctx, args.noteId)) as NoteWithContent | null
  },
})
