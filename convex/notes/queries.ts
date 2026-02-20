import { v } from 'convex/values'
import { query } from '../_generated/server'
import { noteWithContentValidator } from './schema'
import { getNote as getNoteFn } from './notes'
import type { NoteWithContent } from './types'

export const getNote = query({
  args: {
    noteId: v.id('notes'),
  },
  returns: v.union(noteWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<NoteWithContent | null> => {
    return await getNoteFn(ctx, args.noteId)
  },
})
