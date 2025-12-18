import { v } from 'convex/values'
import { query } from '../_generated/server'
import { anySidebarItemValidator } from './schema'
import { sidebarItemIdValidator } from './idValidator'
import {
  getSidebarItemsByCategory as getSidebarItemsByCategoryFn,
  getSidebarItemsByParent as getSidebarItemsByParentFn,
  getSidebarItemAncestors as getSidebarItemAncestorsFn,
  getSidebarItemById,
} from './sidebarItems'
import { AnySidebarItem } from './types'

export const getSidebarItemsByCategory = query({
  args: {
    campaignId: v.id('campaigns'),
    categoryId: v.id('tagCategories'),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<AnySidebarItem[]> => {
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
  handler: async (ctx, args): Promise<AnySidebarItem[]> => {
    return await getSidebarItemsByParentFn(ctx, args.campaignId, args.parentId)
  },
})

export const getSidebarItemAncestors = query({
  args: {
    id: sidebarItemIdValidator,
    campaignId: v.id('campaigns'),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<AnySidebarItem[]> => {
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
