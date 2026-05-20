import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { noteValueRuntimeStateValidator } from './schema'
import { getPersistedNoteValueStates } from './functions/resolvePersistedNoteValueStates'

export const getNoteValueStates = campaignQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.array(noteValueRuntimeStateValidator),
  handler: async (ctx, args) => {
    return await getPersistedNoteValueStates(ctx, {
      campaignId: ctx.campaign._id,
      noteId: args.noteId,
    })
  },
})

export const getNoteValueStatesByNotes = campaignQuery({
  args: {
    noteIds: v.array(v.id('sidebarItems')),
  },
  returns: v.array(noteValueRuntimeStateValidator),
  handler: async (ctx, args) => {
    const uniqueNoteIds = [...new Set(args.noteIds)]
    const states = await Promise.all(
      uniqueNoteIds.map((noteId) =>
        getPersistedNoteValueStates(ctx, {
          campaignId: ctx.campaign._id,
          noteId,
        }),
      ),
    )
    return states.flat()
  },
})
