import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { getSharedBlocksByNoteAndPlayer } from '../blocks/blocks'
import { getSidebarItemAncestors } from '../folders/folders'
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

// TODO: combine into one query with toplevel blocks query
export const getNoteWithSharedContent = query({
  args: {
    noteId: v.id('notes'),
    playerId: v.optional(v.id('campaignMembers')),
  },
  returns: v.union(noteWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<NoteWithContent | null> => {
    const note = await getNoteFn(ctx, args.noteId)
    if (!note) {
      return null
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const blocks = await getSharedBlocksByNoteAndPlayer(
      ctx,
      args.noteId,
      note.campaignId,
      args.playerId,
    )

    const content = blocks.map((block) => block.content)
    const ancestors = await getSidebarItemAncestors(
      ctx,
      note.campaignId,
      note.parentId,
    )

    return {
      ...note,
      content,
      ancestors,
    }
  },
})
