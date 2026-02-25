import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { getAllSidebarItems as getAllSidebarItemsFn } from './functions/getAllSidebarItems'
import { getSidebarItemById as getSidebarItemByIdFn } from './functions/getSidebarItemById'
import { getSidebarItemsByParent as getSidebarItemsByParentFn } from './functions/getSidebarItemsByParent'
import { getSidebarItemBySlug as getSidebarItemBySlugFn } from './functions/getSidebarItemBySlug'
import { getSidebarItemByName as getSidebarItemByNameFn } from './functions/getSidebarItemByName'
import { anySidebarItemValidator } from './schema/schema'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from './schema/baseValidators'
import { anySidebarItemWithContentValidator } from './schema/contentSchema'
import type { AnySidebarItem, AnySidebarItemWithContent } from './types/types'

export const getAllSidebarItems = campaignQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx): Promise<Array<AnySidebarItem>> => {
    return await getAllSidebarItemsFn(ctx)
  },
})

export const getSidebarItemsByParent = campaignQuery({
  args: {
    campaignId: v.id('campaigns'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getSidebarItemsByParentFn(ctx, { parentId: args.parentId })
  },
})

export const getSidebarItem = campaignQuery({
  args: {
    campaignId: v.id('campaigns'),
    id: sidebarItemIdValidator,
  },
  returns: anySidebarItemWithContentValidator,
  handler: async (ctx, args): Promise<AnySidebarItemWithContent> => {
    const result = await getSidebarItemByIdFn(ctx, { id: args.id })
    if (!result) {
      throw new Error('Sidebar item not found')
    }
    return result
  },
})

export const getSidebarItemBySlug = campaignQuery({
  args: {
    campaignId: v.id('campaigns'),
    type: sidebarItemTypeValidator,
    slug: v.string(),
  },
  returns: v.union(anySidebarItemWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItemWithContent | null> => {
    return await getSidebarItemBySlugFn(ctx, {
      type: args.type,
      slug: args.slug,
    })
  },
})

export const getSidebarItemByName = campaignQuery({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
  },
  returns: v.union(anySidebarItemValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItem | null> => {
    return await getSidebarItemByNameFn(ctx, { name: args.name })
  },
})
