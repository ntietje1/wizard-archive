import { query } from '../_generated/server'
import { v } from 'convex/values'
import { Note } from './types'
import { Id } from '../_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { getNote as getNoteFn, getNoteBySlug as getNoteBySlugFn } from './notes'
import { noteValidator } from './schema'

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
  returns: v.array(noteValidator),
  handler: async (ctx, args): Promise<Note[]> => {
    const note = await ctx.db.get(args.noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const ancestors: Note[] = []
    let currentParentId = note.parentId

    while (currentParentId) {
      const parentNote = await getNoteFn(ctx, currentParentId)
      if (!parentNote) {
        break
      }
      ancestors.unshift(parentNote)
      currentParentId = parentNote.parentId
    }

    return ancestors
  },
})

export const getNoteBySlug = query({
  args: {
    campaignId: v.id('campaigns'),
    slug: v.string(),
  },
  returns: noteValidator,
  handler: async (ctx, args): Promise<Note> => {
    const note = await getNoteBySlugFn(ctx, args.campaignId, args.slug)
    if (!note) {
      throw new Error('Note not found')
    }
    return note
  },
})
