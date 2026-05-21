import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { SIDEBAR_ITEM_STATUS } from './types/baseTypes'
import { fetchCampaignSidebarItems } from './functions/fetchCampaignSidebarItems'
import { getSidebarItemsByParent as getSidebarItemsByParentFn } from './functions/getSidebarItemsByParent'
import { getSidebarItemBySlug as getSidebarItemBySlugFn } from './functions/getSidebarItemBySlug'
import { anySidebarItemValidator } from './schema/anySidebarItemValidator'
import { sidebarItemSlugValidator } from './schema/validators'
import { anySidebarItemWithContentValidator } from './schema/anySidebarItemWithContentValidator'
import { getSidebarItemWithContent } from './functions/getSidebarItemWithContent'
import { ERROR_CODE, throwClientError } from '../errors'
import { assertSidebarItemSlug } from './validation/slug'
import { logger } from '../common/logger'

export const getActiveSidebarItems = campaignQuery({
  args: {},
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx) => {
    return await fetchCampaignSidebarItems(ctx, {
      status: SIDEBAR_ITEM_STATUS.active,
    })
  },
})

export const getTrashedSidebarItems = campaignQuery({
  args: {},
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx) => {
    const items = await fetchCampaignSidebarItems(ctx, {
      status: SIDEBAR_ITEM_STATUS.trashed,
    })
    const missingDeletionTime = items.filter((item) => item.deletionTime == null)
    if (missingDeletionTime.length > 0) {
      logger.warn('Ignoring trashed sidebar items without deletionTime', {
        itemIds: missingDeletionTime.map((item) => item._id),
      })
    }
    const sortableItems = items.filter((item) => item.deletionTime != null)
    sortableItems.sort((a, b) => b.deletionTime! - a.deletionTime!)
    return sortableItems
  },
})

export const getSidebarItemsByParent = campaignQuery({
  args: {
    parentId: v.nullable(v.id('sidebarItems')),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args) => {
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
  handler: async (ctx, args) => {
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
  handler: async (ctx, args) => {
    const slug = assertSidebarItemSlug(args.slug)
    return await getSidebarItemBySlugFn(ctx, {
      slug,
    })
  },
})
