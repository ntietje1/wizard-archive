import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { saveTopLevelBlocksForNote } from '../blocks/blocks'
import { customBlockValidator } from '../blocks/schema'
import { sidebarItemIdValidator } from '../sidebarItems/baseFields'
import {
  getSidebarItemById,
  validateSidebarItemName,
} from '../sidebarItems/sidebarItems'
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
    iconName: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    noteId: v.id('notes'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ noteId: Id<'notes'>; slug: string }> => {
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

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        note.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
    }
    await validateSidebarItemName(
      ctx,
      note.campaignId,
      args.parentId,
      note.name,
      note._id,
    )

    await ctx.db.patch(args.noteId, {
      parentId: args.parentId,
      updatedAt: Date.now(),
    })
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
    parentId: v.optional(sidebarItemIdValidator),
    campaignId: v.id('campaigns'),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
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

export const createNoteWithContent = mutation({
  args: {
    name: v.optional(v.string()),
    parentId: v.optional(sidebarItemIdValidator),
    campaignId: v.id('campaigns'),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
    content: v.array(customBlockValidator),
  },
  returns: v.object({
    noteId: v.id('notes'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ noteId: Id<'notes'>; slug: string }> => {
    const { noteId, slug } = await createNoteFn(ctx, args)
    await saveTopLevelBlocksForNote(ctx, noteId, args.content)
    return { noteId, slug }
  },
})

export const updateNoteContent = mutation({
  args: {
    noteId: v.id('notes'),
    content: v.array(customBlockValidator),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    await saveTopLevelBlocksForNote(ctx, args.noteId, args.content)
    return args.noteId
  },
})
