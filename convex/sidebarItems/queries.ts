import { v } from 'convex/values'
import { query } from '../_generated/server'
import { anySidebarItemValidator, sidebarItemTypeValidator } from './schema'
import { sidebarItemIdValidator } from './baseFields'
import {
  checkUniqueNameUnderParent as checkUniqueNameUnderParentFn,
  getAllSidebarItems as getAllSidebarItemsFn,
  getSidebarItemAncestors as getSidebarItemAncestorsFn,
  getSidebarItemById,
  getSidebarItemBySlug as getSidebarItemBySlugFn,
  getSidebarItemsByName as getSidebarItemsByNameFn,
  getSidebarItemsByParent as getSidebarItemsByParentFn,
} from './sidebarItems'
import type { AnySidebarItem } from './types'

export const getAllSidebarItems = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getAllSidebarItemsFn(ctx, args.campaignId)
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

export const checkUniqueNameUnderParent = query({
  args: {
    campaignId: v.id('campaigns'),
    parentId: v.optional(sidebarItemIdValidator),
    name: v.optional(v.string()),
    excludeId: v.optional(sidebarItemIdValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    return await checkUniqueNameUnderParentFn(
      ctx,
      args.campaignId,
      args.parentId,
      args.name,
      args.excludeId,
    )
  },
})

export const getSidebarItemByName = query({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
  },
  returns: v.union(anySidebarItemValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItem | null> => {
    return await getSidebarItemsByNameFn(ctx, args.campaignId, args.name)
  },
})
