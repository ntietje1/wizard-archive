import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { saveTopLevelBlocksForNote } from '../blocks/blocks'
import { customBlockValidator } from '../blocks/schema'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import { validateSidebarItemName } from '../sidebarItems/validation'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { requireEditPermission } from '../shares/itemShares'
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
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    const rawNote = await ctx.db.get(args.noteId)
    if (!rawNote) {
      throw new Error('Note not found')
    }

    const note = await enhanceSidebarItem(ctx, rawNote)
    await requireEditPermission(ctx, note)

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
    await validateSidebarItemName({
      ctx,
      campaignId: note.campaignId,
      parentId: args.parentId,
      name: note.name,
      excludeId: note._id,
    })

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
    parentId: v.optional(v.id('folders')),
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
    parentId: v.optional(v.id('folders')),
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
    const rawNote = await ctx.db.get(args.noteId)
    if (!rawNote) {
      throw new Error('Note not found')
    }

    const note = await enhanceSidebarItem(ctx, rawNote)
    await requireEditPermission(ctx, note)
    await saveTopLevelBlocksForNote(ctx, args.noteId, args.content)
    return args.noteId
  },
})
