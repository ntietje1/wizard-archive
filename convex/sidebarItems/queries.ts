import { v } from 'convex/values'
import { query } from '../_generated/server'
import { anySidebarItemValidator, sidebarItemTypeValidator } from './schema'
import { sidebarItemIdValidator } from './baseFields'
import {
  getSidebarItemAncestors as getSidebarItemAncestorsFn,
  getSidebarItemById,
  getSidebarItemBySlug as getSidebarItemBySlugFn,
  getSidebarItemsByCategory as getSidebarItemsByCategoryFn,
  getSidebarItemsByParent as getSidebarItemsByParentFn,
} from './sidebarItems'
import type { AnySidebarItem } from './types'

export const getSidebarItemsByCategory = query({
  args: {
    campaignId: v.id('campaigns'),
    categoryId: v.id('tagCategories'),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getSidebarItemsByCategoryFn(
      ctx,
      args.campaignId,
      args.categoryId,
    )
  },
})

export const getSidebarItemsByParent = query({
  args: {
    campaignId: v.id('campaigns'),
    parentId: v.optional(sidebarItemIdValidator),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getSidebarItemsByParentFn(ctx, args.campaignId, args.parentId)
  },
})

export const getSidebarItemAncestors = query({
  args: {
    id: sidebarItemIdValidator,
    campaignId: v.id('campaigns'),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    const item = await getSidebarItemById(ctx, args.campaignId, args.id)
    if (!item) {
      throw new Error('Sidebar item not found')
    }
    return await getSidebarItemAncestorsFn(ctx, args.campaignId, item.parentId)
  },
})

export const getSidebarItem = query({
  args: {
    id: sidebarItemIdValidator,
    campaignId: v.id('campaigns'),
  },
  returns: anySidebarItemValidator,
  handler: async (ctx, args): Promise<AnySidebarItem> => {
    const item = await getSidebarItemById(ctx, args.campaignId, args.id)
    if (!item) {
      throw new Error('Sidebar item not found')
    }
    return item
  },
})

export const getSidebarItemBySlug = query({
  args: {
    campaignId: v.id('campaigns'),
    type: sidebarItemTypeValidator,
    slug: v.string(),
  },
  returns: v.union(anySidebarItemValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItem | null> => {
    const item = await getSidebarItemBySlugFn(
      ctx,
      args.campaignId,
      args.type,
      args.slug,
    )
    if (!item) {
      return null
    }
    return item
  },
})
