import { v } from 'convex/values'
import { query } from '../_generated/server'
import { pageValidator } from './schema'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { customBlockValidator } from '../blocks/schema'
import { getTopLevelBlocksByPage } from '../blocks/blocks'
import type { Page, PageWithContent } from './types'
import type { Id } from '../_generated/dataModel'

export const getPagesByNoteId = query({
  args: {
    noteId: v.id('notes'),
  },
  returns: v.array(pageValidator),
  handler: async (ctx, args): Promise<Page[]> => {
    return await ctx.db
      .query('pages')
      .withIndex('by_note_order', (q) => q.eq('noteId', args.noteId))
      .collect()
  },
})

export const getPagesByNoteSlug = query({
  args: {
    campaignId: v.id('campaigns'),
    noteSlug: v.string(),
  },
  returns: v.object({
    pages: v.array(pageValidator),
    noteId: v.union(v.id('notes'), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ pages: Page[]; noteId: Id<'notes'> | null }> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const note = await ctx.db
      .query('notes')
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', args.campaignId).eq('slug', args.noteSlug),
      )
      .unique()

    if (!note) {
      return { pages: [], noteId: null }
    }

    const pages = await ctx.db
      .query('pages')
      .withIndex('by_note_order', (q) => q.eq('noteId', note._id))
      .collect()

    return { pages, noteId: note._id }
  },
})

export const getPageBySlug = query({
  args: {
    noteId: v.id('notes'),
    slug: v.string(),
  },
  returns: v.union(pageValidator, v.null()),
  handler: async (ctx, args): Promise<Page | null> => {
    // Get note first to check permissions
    const note = await ctx.db.get(args.noteId)
    if (!note) {
      return null
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const page = await ctx.db
      .query('pages')
      .withIndex('by_note_slug', (q) =>
        q.eq('noteId', args.noteId).eq('slug', args.slug),
      )
      .unique()

    return page ?? null
  },
})

export const getPageWithContent = query({
  args: {
    pageId: v.id('pages'),
  },
  returns: v.union(
    v.object({
      _id: v.id('pages'),
      _creationTime: v.number(),
      noteId: v.id('notes'),
      title: v.string(),
      slug: v.string(),
      type: v.union(v.literal('text'), v.literal('map'), v.literal('canvas')),
      order: v.number(),
      isReadOnly: v.optional(v.boolean()),
      isDeletable: v.optional(v.boolean()),
      content: v.array(customBlockValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args): Promise<PageWithContent | null> => {
    const page = await ctx.db.get(args.pageId)
    if (!page) {
      return null
    }

    const note = await ctx.db.get(page.noteId)
    if (!note) {
      return null
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const topLevelBlocks = await getTopLevelBlocksByPage(
      ctx,
      args.pageId,
      note.campaignId,
    )

    const content = topLevelBlocks.map((block) => block.content)

    return {
      ...page,
      content,
    }
  },
})
