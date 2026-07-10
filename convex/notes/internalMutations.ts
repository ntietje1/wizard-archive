import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { editorBlockInputValidator } from '../blocks/schema'
import { parseBlockNoteBlocks } from '../blocks/parseBlockNoteBlocks'
import { syncNoteIndexesFromBlocks } from './functions/syncNoteDerivedData'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'

export const syncDerivedDataFromBlocks = internalMutation({
  args: {
    noteId: v.id('sidebarItems'),
    content: v.array(editorBlockInputValidator),
    campaignMemberId: v.optional(v.id('campaignMembers')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get('sidebarItems', args.noteId)
    if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
    const campaign = await ctx.db.get('campaigns', note.campaignId)
    if (!campaign) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
    const membership = args.campaignMemberId
      ? await ctx.db.get('campaignMembers', args.campaignMemberId)
      : null
    if (membership && membership.campaignId !== campaign._id) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Campaign membership does not match this note')
    }
    await syncNoteIndexesFromBlocks(
      { ...ctx, campaign, ...(membership ? { membership } : {}) },
      {
        noteId: args.noteId,
        content: parseBlockNoteBlocks(args.content),
      },
    )
    return null
  },
})
