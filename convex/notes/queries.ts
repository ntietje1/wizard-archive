import { v } from 'convex/values'
import { authQuery } from '../functions'
import { noteWithContentValidator } from './schema'
import { getNote as getNoteFn } from './functions/getNote'
import type { NoteWithContent } from './types'

export const getNote = authQuery({
  args: {
    noteId: v.id('notes'),
  },
  returns: v.union(noteWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<NoteWithContent | null> => {
    return await getNoteFn(ctx, { noteId: args.noteId })
  },
})
