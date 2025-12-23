import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { saveTopLevelBlocksForChildNote } from '../blocks/blocks'
import { customBlockValidator } from '../blocks/schema'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import {
  createNote as createNoteFn,
  deleteNote as deleteNoteFn,
  updateNote as updateNoteFn,
} from './notes'
import type { Id } from '../_generated/dataModel'

export const updateNote = mutation({
  args: {
    noteId: v.id('notes'),
    name: v.optional(v.string()),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    return await updateNoteFn(ctx, args)
  },
})

export const moveNote = mutation({
  args: {
    noteId: v.id('notes'),
    parentId: v.optional(sidebarItemIdValidator),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    const note = await ctx.db.get(args.noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    // Determine categoryId from parent and update both
    let categoryId: Id<'tagCategories'> | undefined
    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        note.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      if (parentItem.type === SIDEBAR_ITEM_TYPES.gameMaps) {
        throw new Error('Maps cannot be parents of notes')
      }
      // If parent is a category, use it directly; otherwise use parent's categoryId
      categoryId =
        parentItem.type === SIDEBAR_ITEM_TYPES.tagCategories
          ? parentItem._id
          : parentItem.categoryId
    } else {
      throw new Error(
        'categoryId is required - provide a parentId to derive it',
      )
    }

    await ctx.db.patch(args.noteId, { parentId: args.parentId, categoryId })
    return args.noteId
  },
})

export const deleteNote = mutation({
  args: {
    noteId: v.id('notes'),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    return await deleteNoteFn(ctx, args.noteId)
  },
})

export const createNote = mutation({
  args: {
    name: v.optional(v.string()),
    categoryId: v.optional(v.id('tagCategories')),
    parentId: v.optional(sidebarItemIdValidator),
    campaignId: v.id('campaigns'),
  },
  returns: v.object({
    noteId: v.id('notes'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ noteId: Id<'notes'>; slug: string }> => {
    return await createNoteFn(ctx, args)
  },
})

export const updateNoteContent = mutation({
  args: {
    noteId: v.id('notes'),
    content: v.array(customBlockValidator),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    const note = await ctx.db.get(args.noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    await saveTopLevelBlocksForChildNote(ctx, args.noteId, args.content)
    return args.noteId
  },
})
