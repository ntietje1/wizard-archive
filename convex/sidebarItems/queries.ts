import { v } from 'convex/values'
import { authQuery } from '../functions'
import { SIDEBAR_ITEM_LOCATION } from './types/baseTypes'
import { fetchCampaignSidebarItems } from './functions/fetchCampaignSidebarItems'
import { requireSidebarItemById } from './functions/getSidebarItemById'
import { getSidebarItemsByParent as getSidebarItemsByParentFn } from './functions/getSidebarItemsByParent'
import { getSidebarItemBySlug as getSidebarItemBySlugFn } from './functions/getSidebarItemBySlug'
import { anySidebarItemValidator } from './schema/schema'
import {
  sidebarItemIdValidator,
  sidebarItemLocationValidator,
} from './schema/baseValidators'
import { anySidebarItemWithContentValidator } from './schema/contentSchema'
import type { AnySidebarItem, AnySidebarItemWithContent } from './types/types'

export const getSidebarItemsByLocation = authQuery({
  args: {
    campaignId: v.id('campaigns'),
    location: sidebarItemLocationValidator,
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    const items = await fetchCampaignSidebarItems(ctx, {
      campaignId: args.campaignId,
      location: args.location,
    })
    if (args.location === SIDEBAR_ITEM_LOCATION.trash) {
      items.sort((a, b) => (b.deletionTime ?? 0) - (a.deletionTime ?? 0))
    }
    return items
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
    slug: v.string(),
  },
  returns: v.union(anySidebarItemWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItemWithContent | null> => {
    return await getSidebarItemBySlugFn(ctx, {
      slug: args.slug,
      campaignId: args.campaignId,
    })
  },
})
