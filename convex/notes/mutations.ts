import { mutation } from '../_generated/server'
import { v } from 'convex/values'
import { Doc } from '../_generated/dataModel'
import { Id } from '../_generated/dataModel'
import { saveTopLevelBlocks, updateTagAndContent } from '../tags/tags'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { customBlockValidator } from './schema'
import { deleteNote as deleteNoteFn } from './notes'
import { findUniqueSlug, shortenId } from '../common/slug'

export const updateNote = mutation({
  args: {
    noteId: v.id('notes'),
    content: v.optional(v.array(customBlockValidator)),
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

    if (args.content !== undefined) {
      await saveTopLevelBlocks(ctx, args.noteId, args.content)
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

      if (note.tagId) {
        await updateTagAndContent(ctx, note.tagId, { displayName: args.name })
      }
    }

    await ctx.db.patch(args.noteId, updates)
    return args.noteId
  },
})

export const moveNote = mutation({
  args: {
    noteId: v.id('notes'),
    parentFolderId: v.optional(v.id('folders')),
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

    await ctx.db.patch(args.noteId, { parentFolderId: args.parentFolderId })
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
    parentFolderId: v.optional(v.id('folders')),
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
    const { identityWithProfile } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    const { profile } = identityWithProfile

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

    const noteId = await ctx.db.insert('notes', {
      userId: profile.userId,
      name: args.name || '',
      slug: uniqueSlug,
      categoryId: args.categoryId,
      parentFolderId: args.parentFolderId,
      updatedAt: Date.now(),
      campaignId: args.campaignId,
    })

    return { noteId: noteId, slug: uniqueSlug }
  },
})
