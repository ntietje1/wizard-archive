import { mutation } from '../_generated/server'
import { v } from 'convex/values'
import { Doc } from '../_generated/dataModel'
import { Id } from '../_generated/dataModel'
import { updateTagAndContent } from '../tags/tags'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { deleteNote as deleteNoteFn } from './notes'
import { findUniqueSlug, shortenId } from '../common/slug'

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
    parentId: v.optional(v.id('notes')),
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

    await ctx.db.patch(args.noteId, { parentId: args.parentId })
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
    parentId: v.optional(v.id('notes')),
    campaignId: v.id('campaigns'),
    createPage: v.optional(v.boolean()),
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
      userId: profile._id,
      name: args.name || '',
      slug: uniqueSlug,
      categoryId: args.categoryId,
      parentId: args.parentId,
      updatedAt: Date.now(),
      campaignId: args.campaignId,
    })

    // Create default page only if createPage is true (defaults to true)
    const shouldCreatePage = args.createPage !== false
    if (shouldCreatePage) {
      // Generate unique slug for default page (unique per note)
      const mainPageSlug = await findUniqueSlug('main', async (slug) => {
        const conflict = await ctx.db
          .query('pages')
          .withIndex('by_note_slug', (q) =>
            q.eq('noteId', noteId).eq('slug', slug),
          )
          .unique()
        return conflict !== null
      })

      await ctx.db.insert('pages', {
        noteId,
        title: 'Main',
        slug: mainPageSlug,
        type: 'text',
        order: 0,
      })
    }

    return { noteId: noteId, slug: uniqueSlug }
  },
})
