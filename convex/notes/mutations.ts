import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { saveTopLevelBlocksForNote } from '../blocks/blocks'
import { customBlockValidator } from '../blocks/schema'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import {
  validateParentChange,
  validateSidebarItemName,
} from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import {
  requireEditPermission,
  requireFullAccessPermission,
} from '../shares/itemShares'
import {
  findUniqueNoteSlug,
  findUniqueSlug,
  resolveSlugBasis,
} from '../common/slug'
import { EMPTY_PM_DOC, prosemirrorSync } from '../prosemirrorSync'
import { deleteNote as deleteNoteFn } from './notes'
import type { Doc, Id } from '../_generated/dataModel'

export const updateNote = campaignMutation({
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
    const rawNote = await ctx.db.get(args.noteId)
    if (!rawNote || rawNote.campaignId !== args.campaignId) {
      throw new Error('Note not found')
    }

    const note = await enhanceSidebarItem(ctx, rawNote)
    await requireFullAccessPermission(ctx, note)

    const now = Date.now()
    const updates: Partial<Doc<'notes'>> = {
      updatedAt: now,
    }

    if (args.name !== undefined) {
      updates.name = args.name
      await validateSidebarItemName({
        ctx,
        campaignId: args.campaignId,
        parentId: note.parentId,
        name: args.name,
        excludeId: note._id,
      })

      updates.slug = await findUniqueNoteSlug(
        ctx,
        args.campaignId,
        args.name,
        args.noteId,
      )
    }

    if (args.iconName !== undefined) {
      updates.iconName = args.iconName
    }

    if (args.color !== undefined) {
      updates.color = args.color === null ? undefined : args.color
    }

    await ctx.db.patch(args.noteId, updates)
    return { noteId: args.noteId, slug: updates.slug ?? note.slug }
  },
})

export const moveNote = campaignMutation({
  args: {
    noteId: v.id('notes'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    const rawNote = await ctx.db.get(args.noteId)
    if (!rawNote || rawNote.campaignId !== args.campaignId) {
      throw new Error('Note not found')
    }

    const note = await enhanceSidebarItem(ctx, rawNote)
    await requireFullAccessPermission(ctx, note)

    await validateParentChange({
      ctx,
      item: note,
      newParentId: args.parentId,
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
    }
    await validateSidebarItemName({
      ctx,
      campaignId: args.campaignId,
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

export const deleteNote = campaignMutation({
  args: {
    noteId: v.id('notes'),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    return await deleteNoteFn(ctx, args.noteId)
  },
})

export const createNote = campaignMutation({
  args: {
    name: v.optional(v.string()),
    parentId: v.optional(v.id('folders')),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
    content: v.optional(v.array(customBlockValidator)),
  },
  returns: v.object({
    noteId: v.id('notes'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ noteId: Id<'notes'>; slug: string }> => {
    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        args.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      await requireFullAccessPermission(ctx, parentItem)
    } else {
      if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
        throw new Error('Only the DM can create items at the root level')
      }
    }

    const uniqueSlug = await findUniqueSlug(
      resolveSlugBasis(args.name),
      async (slug) => {
        const conflict = await ctx.db
          .query('notes')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', args.campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null
      },
    )

    await validateSidebarItemName({
      ctx,
      campaignId: args.campaignId,
      parentId: args.parentId,
      name: args.name,
    })

    const noteId = await ctx.db.insert('notes', {
      name: args.name,
      slug: uniqueSlug,
      parentId: args.parentId,
      iconName: args.iconName,
      color: args.color,
      updatedAt: Date.now(),
      campaignId: args.campaignId,
      type: SIDEBAR_ITEM_TYPES.notes,
    })

    if (args.content) {
      await saveTopLevelBlocksForNote(ctx, noteId, args.content)
    }
    await prosemirrorSync.create(ctx, noteId, EMPTY_PM_DOC)
    return { noteId, slug: uniqueSlug }
  },
})

export const updateNoteContent = campaignMutation({
  args: {
    noteId: v.id('notes'),
    content: v.array(customBlockValidator),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    const rawNote = await ctx.db.get(args.noteId)
    if (!rawNote || rawNote.campaignId !== args.campaignId) {
      throw new Error('Note not found')
    }

    const note = await enhanceSidebarItem(ctx, rawNote)
    await requireEditPermission(ctx, note)
    await saveTopLevelBlocksForNote(ctx, args.noteId, args.content)
    return args.noteId
  },
})
