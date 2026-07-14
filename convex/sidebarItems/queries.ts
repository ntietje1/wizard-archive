import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { fetchCampaignSidebarItems } from './functions/fetchCampaignSidebarItems'
import { getSidebarItemsByParent as getSidebarItemsByParentFn } from './functions/getSidebarItemsByParent'
import { resolveSidebarItemAccess as resolveSidebarItemAccessFn } from './functions/resolveSidebarItemAccess'
import { anySidebarItemValidator } from './schema/anySidebarItemValidator'
import { anySidebarItemWithContentValidator } from './schema/anySidebarItemWithContentValidator'
import { getSidebarItemWithContent } from './functions/getSidebarItemWithContent'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import { resourceIdValidator } from '../resources/validators'

const sidebarItemAccessResolutionValidator = v.union(
  v.object({
    status: v.literal('not_found'),
  }),
  v.object({
    status: v.literal('not_shared'),
  }),
  v.object({
    status: v.literal('trashed'),
  }),
  v.object({
    status: v.literal('available'),
    item: anySidebarItemWithContentValidator,
  }),
)

export const getSidebarItems = campaignQuery({
  args: {},
  returns: v.object({
    active: v.array(anySidebarItemValidator),
    trash: v.array(anySidebarItemValidator),
  }),
  handler: async (ctx) => {
    return await fetchCampaignSidebarItems(ctx)
  },
})

export const getSidebarItemsByParent = campaignQuery({
  args: {
    parentId: v.nullable(resourceIdValidator),
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
    id: resourceIdValidator,
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

export const resolveSidebarItemAccess = campaignQuery({
  args: {
    resourceId: resourceIdValidator,
  },
  returns: sidebarItemAccessResolutionValidator,
  handler: async (ctx, args) => {
    return await resolveSidebarItemAccessFn(ctx, args.resourceId)
  },
})
