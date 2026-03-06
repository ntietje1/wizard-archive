import { v } from 'convex/values'
import { authQuery } from '../functions'
import { getAllSidebarItems as getAllSidebarItemsFn } from './functions/getAllSidebarItems'
import { requireSidebarItemById } from './functions/getSidebarItemById'
import { getSidebarItemsByParent as getSidebarItemsByParentFn } from './functions/getSidebarItemsByParent'
import { getSidebarItemBySlug as getSidebarItemBySlugFn } from './functions/getSidebarItemBySlug'
import { getSidebarItemByName as getSidebarItemByNameFn } from './functions/getSidebarItemByName'
import { getTrashedSidebarItems as getTrashedSidebarItemsFn } from './functions/getTrashedSidebarItems'
import { anySidebarItemValidator } from './schema/schema'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from './schema/baseValidators'
import { anySidebarItemWithContentValidator } from './schema/contentSchema'
import type { AnySidebarItem, AnySidebarItemWithContent } from './types/types'

export const getAllSidebarItems = authQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getAllSidebarItemsFn(ctx, { campaignId: args.campaignId })
  },
})

export const getSidebarItemsByParent = authQuery({
  args: {
    campaignId: v.id('campaigns'),
    parentId: v.union(v.id('folders'), v.null()),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getSidebarItemsByParentFn(ctx, {
      parentId: args.parentId,
      campaignId: args.campaignId,
    })
  },
})

export const getSidebarItem = authQuery({
  args: {
    id: sidebarItemIdValidator,
  },
  returns: anySidebarItemWithContentValidator,
  handler: async (ctx, args): Promise<AnySidebarItemWithContent> => {
    return await requireSidebarItemById(ctx, { id: args.id })
  },
})

export const getSidebarItemBySlug = authQuery({
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
      campaignId: args.campaignId,
    })
  },
})

export const getSidebarItemByName = authQuery({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
  },
  returns: v.union(anySidebarItemValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItem | null> => {
    return await getSidebarItemByNameFn(ctx, {
      name: args.name,
      campaignId: args.campaignId,
    })
  },
})

export const getTrashedSidebarItems = authQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getTrashedSidebarItemsFn(ctx, { campaignId: args.campaignId })
  },
})
