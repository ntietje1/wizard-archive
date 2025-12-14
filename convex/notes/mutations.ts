import { mutation } from '../_generated/server'
import { v } from 'convex/values'
import { Doc, Id } from '../_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { deleteNote as deleteNoteFn } from './notes'
import { findUniqueSlug, shortenId } from '../common/slug'
import { saveTopLevelBlocksForChildNote } from '../blocks/blocks'
import { customBlockValidator } from '../blocks/schema'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'
import {
  getSidebarItemById,
  isValidSidebarParent,
} from '../sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'

export const updateNote = mutation({
  args: {
    noteId: v.id('notes'),
    name: v.optional(v.string()),
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

    const now = Date.now()
    const updates: Partial<Doc<'notes'>> = {
      updatedAt: now,
    }

    if (args.name !== undefined) {
      updates.name = args.name

      const slugBasis =
        args.name && args.name.trim() !== ''
          ? args.name
          : shortenId(args.noteId)

      const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('notes')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', note.campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== args.noteId
      })

      updates.slug = uniqueSlug
    }

    await ctx.db.patch(args.noteId, updates)
    return args.noteId
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
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const slugBasis =
      args.name && args.name.trim() !== '' ? args.name : crypto.randomUUID() // use a uuid if the name is blank

    const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
      const conflict = await ctx.db
        .query('notes')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', args.campaignId).eq('slug', slug),
        )
        .unique()
      return conflict !== null
    })

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        args.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.notes, parentItem.type)) {
        throw new Error('Invalid parent type')
      }
    }

    const noteId = await ctx.db.insert('notes', {
      name: args.name || '',
      slug: uniqueSlug,
      parentId: args.parentId,
      categoryId: args.categoryId,
      updatedAt: Date.now(),
      campaignId: args.campaignId,
      type: 'notes',
    })

    return { noteId, slug: uniqueSlug }
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
