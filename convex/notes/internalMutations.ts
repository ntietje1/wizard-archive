import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { editorBlockInputValidator } from '../blocks/schema'
import { parseEditorBlocks } from '../blocks/parseEditorBlocks'
import { syncNoteIndexesFromBlocks } from './functions/syncNoteDerivedData'
import { ERROR_CODE, throwClientError } from '../errors'

export const syncDerivedDataFromBlocks = internalMutation({
  args: {
    noteId: v.id('sidebarItems'),
    content: v.array(editorBlockInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get('sidebarItems', args.noteId)
    if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
    const campaign = await ctx.db.get('campaigns', note.campaignId)
    if (!campaign) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
    await syncNoteIndexesFromBlocks(
      { ...ctx, campaign },
      {
        noteId: args.noteId,
        content: parseEditorBlocks(args.content),
      },
    )
    return null
  },
})
