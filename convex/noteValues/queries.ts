import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { noteValueRuntimeStateValidator } from './schema'
import { getPersistedNoteValueStates } from './functions/resolvePersistedNoteValueStates'
import { resourceIdValidator } from '../resources/validators'
import { requireSidebarItemRow } from '../sidebarItems/functions/sidebarItemIdentity'

export const getNoteValueStates = campaignQuery({
  args: {
    noteId: resourceIdValidator,
  },
  returns: v.array(noteValueRuntimeStateValidator),
  handler: async (ctx, args) => {
    const note = await requireSidebarItemRow(ctx, args.noteId)
    const states = await getPersistedNoteValueStates(ctx, {
      campaignId: ctx.campaign._id,
      noteId: note._id,
    })
    return states.map((state) => ({ ...state, noteId: args.noteId }))
  },
})

export const getNoteValueStatesByNotes = campaignQuery({
  args: {
    noteIds: v.array(resourceIdValidator),
  },
  returns: v.array(noteValueRuntimeStateValidator),
  handler: async (ctx, args) => {
    const uniqueNoteIds = [...new Set(args.noteIds)]
    const states = await Promise.all(
      uniqueNoteIds.map(async (noteId) => {
        const note = await requireSidebarItemRow(ctx, noteId)
        const noteStates = await getPersistedNoteValueStates(ctx, {
          campaignId: ctx.campaign._id,
          noteId: note._id,
        })
        return noteStates.map((state) => ({ ...state, noteId }))
      }),
    )
    return states.flat()
  },
})
