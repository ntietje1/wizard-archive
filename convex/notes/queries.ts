import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { getTopLevelBlocksByNote } from '../blocks/blocks'
import { getSidebarItemAncestors } from '../sidebarItems/sidebarItems'
import { anySidebarItemValidator } from '../sidebarItems/schema'
import { noteValidator, noteWithContentValidator } from './schema'
import { getNote as getNoteFn } from './notes'
import type { AnySidebarItem } from '../sidebarItems/types'
import type { Note, NoteWithContent } from './types'

export const getNote = query({
  args: {
    noteId: v.id('notes'),
  },
  returns: noteValidator,
  handler: async (ctx, args): Promise<Note> => {
    const note = await getNoteFn(ctx, args.noteId)
    if (!note) {
      throw new Error('Note not found')
    }
    return note
  },
})

export const getNoteAncestors = query({
  args: {
    noteId: v.id('notes'),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    const note = await ctx.db.get(args.noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    return await getSidebarItemAncestors(ctx, note.campaignId, note.parentId)
  },
})

export const getNoteWithContent = query({
  args: {
    noteId: v.id('notes'),
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

    const topLevelBlocks = await getTopLevelBlocksByNote(
      ctx,
      args.noteId,
      note.campaignId,
    )

    const content = topLevelBlocks.map((block) => block.content)

    return {
      ...note,
      content,
    }
  },
})
