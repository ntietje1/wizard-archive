import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { SIDEBAR_ITEM_LOCATION } from './types/baseTypes'
import { fetchCampaignSidebarItems } from './functions/fetchCampaignSidebarItems'
import { getSidebarItemsByParent as getSidebarItemsByParentFn } from './functions/getSidebarItemsByParent'
import { getSidebarItemBySlug as getSidebarItemBySlugFn } from './functions/getSidebarItemBySlug'
import { anySidebarItemValidator } from './schema/anySidebarItemValidator'
import { sidebarItemLocationValidator, sidebarItemSlugValidator } from './schema/validators'
import { anySidebarItemWithContentValidator } from './schema/anySidebarItemWithContentValidator'
import type { AnySidebarItem, AnySidebarItemWithContent } from './types/types'
import { getSidebarItemWithContent } from './functions/getSidebarItemWithContent'
import { ERROR_CODE, throwClientError } from '../errors'
import { assertSidebarItemSlug } from './slug'
import { assertValidSidebarItemSlug } from './validation'

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
    id: v.id('sidebarItems'),
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
    slug: sidebarItemSlugValidator,
  },
  returns: v.nullable(anySidebarItemWithContentValidator),
  handler: async (ctx, args): Promise<AnySidebarItemWithContent | null> => {
    assertValidSidebarItemSlug(args.slug)
    return await getSidebarItemBySlugFn(ctx, {
      slug: assertSidebarItemSlug(args.slug),
    })
  },
})
