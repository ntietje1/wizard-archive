import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { SIDEBAR_ITEM_LOCATION } from './types/baseTypes'
import { fetchCampaignSidebarItems } from './functions/fetchCampaignSidebarItems'
import { getSidebarItemsByParent as getSidebarItemsByParentFn } from './functions/getSidebarItemsByParent'
import { getSidebarItemBySlug as getSidebarItemBySlugFn } from './functions/getSidebarItemBySlug'
import { anySidebarItemValidator } from './schema/schema'
import { sidebarItemIdValidator, sidebarItemLocationValidator } from './schema/baseValidators'
import { anySidebarItemWithContentValidator } from './schema/contentSchema'
import type { AnySidebarItem, AnySidebarItemWithContent } from './types/types'
import { getSidebarItemWithContent } from './functions/getSidebarItemWithContent'
import { ERROR_CODE, throwClientError } from '../errors'

export const getSidebarItemsByLocation = campaignQuery({
  args: {
    location: sidebarItemLocationValidator,
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    const items = await fetchCampaignSidebarItems(ctx, {
      location: args.location,
    })
    if (args.location === SIDEBAR_ITEM_LOCATION.trash) {
      items.sort((a, b) => (b.deletionTime ?? 0) - (a.deletionTime ?? 0))
    }
    return items
  },
})

export const getSidebarItemsByParent = campaignQuery({
  args: {
    parentId: v.nullable(v.id('sidebarItems')),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getSidebarItemsByParentFn(ctx, {
      parentId: args.parentId,
    })
  },
})

export const getSidebarItem = campaignQuery({
  args: {
    id: sidebarItemIdValidator,
  },
  returns: anySidebarItemWithContentValidator,
  handler: async (ctx, args): Promise<AnySidebarItemWithContent> => {
    const res = await getSidebarItemWithContent(ctx, args.id)
    if (!res) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'This item could not be found')
    }
    return res
  },
})

export const getSidebarItemBySlug = campaignQuery({
  args: {
    slug: v.string(),
  },
  returns: v.nullable(anySidebarItemWithContentValidator),
  handler: async (ctx, args): Promise<AnySidebarItemWithContent | null> => {
    return await getSidebarItemBySlugFn(ctx, {
      slug: args.slug,
    })
  },
})
