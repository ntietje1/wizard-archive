import { v } from 'convex/values'
import { query } from '../_generated/server'
import { getPlayerSharedTags, getSharedAllTag } from '../shares/shares'
import {
  getTagCategory as getTagCategoryFn,
  getTag as getTagFn,
  getTagsByCampaign as getTagsByCampaignFn,
  getTagsByCategory as getTagsByCategoryFn,
} from './tags'
import { tagCategoryValidator, tagValidator } from './schema'
import type { Tag, TagCategory } from './types'

export const getSharedTags = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.object({
    sharedAllTag: tagValidator,
    playerSharedTags: v.array(tagValidator),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    sharedAllTag: Tag
    playerSharedTags: Array<Tag>
  }> => {
    const sharedAllTag = await getSharedAllTag(ctx, args.campaignId)
    const playerSharedTags = await getPlayerSharedTags(ctx, args.campaignId)
    return {
      sharedAllTag,
      playerSharedTags,
    }
  },
})

export const getTag = query({
  args: {
    campaignId: v.id('campaigns'),
    tagId: v.id('tags'),
  },
  returns: tagValidator,
  handler: async (ctx, args): Promise<Tag> => {
    return await getTagFn(ctx, args.tagId)
  },
})

export const getTagsByCampaign = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(tagValidator),
  handler: async (ctx, args): Promise<Array<Tag>> => {
    return await getTagsByCampaignFn(ctx, args.campaignId)
  },
})

export const getTagsByCategory = query({
  args: {
    campaignId: v.id('campaigns'),
    categoryId: v.id('tagCategories'),
  },
  returns: v.array(tagValidator),
  handler: async (ctx, args): Promise<Array<Tag>> => {
    return await getTagsByCategoryFn(ctx, args.categoryId)
  },
})

export const getTagCategoriesByCampaign = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(tagCategoryValidator),
  handler: async (ctx, args): Promise<Array<TagCategory>> => {
    const categories = await ctx.db
      .query('tagCategories')
      .withIndex('by_campaign_slug', (q) => q.eq('campaignId', args.campaignId))
      .collect()

    return categories
  },
})

export const checkCategorySlugExists = query({
  args: {
    campaignId: v.id('campaigns'),
    slug: v.string(),
    excludeCategoryId: v.optional(v.id('tagCategories')),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query('tagCategories')
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', args.campaignId).eq('slug', args.slug),
      )
      .unique()
    if (!existing) return false
    if (args.excludeCategoryId && existing._id === args.excludeCategoryId)
      return false
    return true
  },
})

export const getTagCategory = query({
  args: {
    campaignId: v.id('campaigns'),
    categoryId: v.id('tagCategories'),
  },
  returns: tagCategoryValidator,
  handler: async (ctx, args): Promise<TagCategory> => {
    return await getTagCategoryFn(ctx, args.campaignId, args.categoryId)
  },
})
