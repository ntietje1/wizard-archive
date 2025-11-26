import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { pageValidator, pageTypeValidator } from './schema'
import { customBlockValidator } from '../blocks/schema'
import { findUniqueSlug, slugify } from '../common/slug'
import type { CreatePageResult } from './types'
import type { Id } from '../_generated/dataModel'
import { saveTopLevelBlocksForPage } from '../blocks/blocks'

export const createPage = mutation({
  args: {
    noteId: v.id('notes'),
    title: v.string(),
    type: pageTypeValidator,
  },
  returns: v.object({
    pageId: v.id('pages'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<CreatePageResult> => {
    const existingPages = await ctx.db
      .query('pages')
      .withIndex('by_note_order', (q) => q.eq('noteId', args.noteId))
      .collect()

    const order = existingPages.length

    // Generate unique slug from title (unique per note)
    const slugBasis =
      args.title && args.title.trim() !== '' ? args.title : 'page'
    const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
      const conflict = await ctx.db
        .query('pages')
        .withIndex('by_note_slug', (q) =>
          q.eq('noteId', args.noteId).eq('slug', slug),
        )
        .unique()
      return conflict !== null
    })

    const pageId = await ctx.db.insert('pages', {
      noteId: args.noteId,
      title: args.title,
      slug: uniqueSlug,
      type: args.type,
      order: order,
    })

    return { pageId, slug: uniqueSlug }
  },
})

export const updatePage = mutation({
  args: {
    pageId: v.id('pages'),
    title: v.optional(v.string()),
  },
  returns: v.id('pages'),
  handler: async (ctx, args): Promise<Id<'pages'>> => {
    const page = await ctx.db.get(args.pageId)
    if (!page) {
      throw new Error('Page not found')
    }

    const updates: any = {}
    if (args.title !== undefined) {
      updates.title = args.title
      // Regenerate slug when title changes
      const slugBasis =
        args.title && args.title.trim() !== '' ? args.title : 'page'
      const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('pages')
          .withIndex('by_note_slug', (q) =>
            q.eq('noteId', page.noteId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== args.pageId
      })
      updates.slug = uniqueSlug
    }

    await ctx.db.patch(args.pageId, updates)
    return args.pageId
  },
})

export const updatePageContent = mutation({
  args: {
    pageId: v.id('pages'),
    content: v.array(customBlockValidator),
  },
  returns: v.id('pages'),
  handler: async (ctx, args): Promise<Id<'pages'>> => {
    await saveTopLevelBlocksForPage(ctx, args.pageId, args.content)
    return args.pageId
  },
})
