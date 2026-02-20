import { v } from 'convex/values'
import { query } from '../_generated/server'
import {
  getAllSidebarItems as getAllSidebarItemsFn,
  getSidebarItemById as getSidebarItemByIdFn,
  getSidebarItemBySlug as getSidebarItemBySlugFn,
  getSidebarItemByName as getSidebarItemsByNameFn,
  getSidebarItemsByParent as getSidebarItemsByParentFn,
} from '../sidebarItems/sidebarItems'
import { anySidebarItemValidator } from './schema/schema'
import { anySidebarItemWithContentValidator } from './schema/contentSchema'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from './schema/baseValidators'
import type { AnySidebarItem, AnySidebarItemWithContent } from './types'

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
    parentId: v.optional(v.id('folders')),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getSidebarItemsByParentFn(ctx, args.campaignId, args.parentId)
  },
})

export const getSidebarItem = query({
  args: {
    id: sidebarItemIdValidator,
    campaignId: v.id('campaigns'),
  },
  returns: anySidebarItemWithContentValidator,
  handler: async (ctx, args): Promise<AnySidebarItemWithContent> => {
    const result = await getSidebarItemByIdFn(ctx, args.campaignId, args.id)
    if (!result) {
      throw new Error('Sidebar item not found')
    }
    return result
  },
})

export const getSidebarItemBySlug = query({
  args: {
    campaignId: v.id('campaigns'),
    type: sidebarItemTypeValidator,
    slug: v.string(),
    viewAsPlayerId: v.optional(v.id('campaignMembers')),
  },
  returns: v.union(anySidebarItemWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItemWithContent | null> => {
    return await getSidebarItemBySlugFn(
      ctx,
      args.campaignId,
      args.type,
      args.slug,
      args.viewAsPlayerId,
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
