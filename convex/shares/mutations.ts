import { v } from 'convex/values'
import { blockNoteIdValidator } from '../notes/schema'
import { mutation } from '../_generated/server'
import { getShare } from './shares'
import {
  addTagToBlockHandler,
  getBlockLevelTags,
  removeTagFromBlockHandler,
} from '../tags/tags'
import { getCurrentSession } from '../sessions/sessions'
import { findBlockByBlockNoteId } from '../notes/blocks'

export const addShareBlock = mutation({
  args: {
    noteId: v.id('notes'),
    blockId: blockNoteIdValidator,
    shareId: v.id('shares'),
  },
  returns: blockNoteIdValidator,
  handler: async (ctx, args): Promise<string> => {
    const share = await getShare(ctx, args.shareId)
    if (!share) {
      throw new Error('Share tag not found')
    }
    const currentSession = await getCurrentSession(ctx, share.campaignId)
    if (currentSession) {
      await addTagToBlockHandler(
        ctx,
        args.noteId,
        args.blockId,
        currentSession.tagId,
      )
    }

    return await addTagToBlockHandler(
      ctx,
      args.noteId,
      args.blockId,
      share.tagId,
    )
  },
})

export const removeShareFromBlock = mutation({
  args: {
    noteId: v.id('notes'),
    blockId: blockNoteIdValidator,
    shareId: v.id('shares'),
  },
  returns: blockNoteIdValidator,
  handler: async (ctx, args): Promise<string> => {
    const share = await getShare(ctx, args.shareId)
    if (!share) {
      throw new Error('Share tag not found')
    }
    const currentSession = await getCurrentSession(ctx, share.campaignId)
    if (currentSession) {
      const block = await findBlockByBlockNoteId(ctx, args.noteId, args.blockId)
      if (!block) {
        throw new Error('Block not found')
      }
      const tagIds = await getBlockLevelTags(ctx, block._id)
      const hasCurrentSessionTag = tagIds.includes(currentSession.tagId)
      if (hasCurrentSessionTag) {
        await removeTagFromBlockHandler(
          ctx,
          args.noteId,
          args.blockId,
          currentSession.tagId,
        )
      }
    }
    return await removeTagFromBlockHandler(
      ctx,
      args.noteId,
      args.blockId,
      share.tagId,
    )
  },
})
