import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { fetchCampaignSidebarItems } from './functions/fetchCampaignSidebarItems'
import { getSidebarItemsByParent as getSidebarItemsByParentFn } from './functions/getSidebarItemsByParent'
import { getSidebarItemBySlug as getSidebarItemBySlugFn } from './functions/getSidebarItemBySlug'
import { resolveSidebarItemAccess as resolveSidebarItemAccessFn } from './functions/resolveSidebarItemAccess'
import { anySidebarItemValidator } from './schema/anySidebarItemValidator'
import { anySidebarItemWithContentValidator } from './schema/anySidebarItemWithContentValidator'
import { getSidebarItemWithContent } from './functions/getSidebarItemWithContent'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import { assertConvexSidebarItemSlug } from './validation/slug'
import { resourceIdValidator } from '../resources/validators'

const sidebarItemAccessLookupValidator = v.union(
  v.object({
    kind: v.literal('id'),
    id: resourceIdValidator,
  }),
  v.object({
    kind: v.literal('slug'),
    slug: v.string(),
  }),
)

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

export const getSidebarItemBySlug = campaignQuery({
  args: {
    slug: v.string(),
  },
  returns: v.nullable(anySidebarItemWithContentValidator),
  handler: async (ctx, args) => {
    const slug = assertConvexSidebarItemSlug(args.slug)
    return await getSidebarItemBySlugFn(ctx, {
      slug,
    })
  },
})

export const resolveSidebarItemAccess = campaignQuery({
  args: {
    lookup: sidebarItemAccessLookupValidator,
  },
  returns: sidebarItemAccessResolutionValidator,
  handler: async (ctx, args) => {
    const lookup =
      args.lookup.kind === 'slug'
        ? { kind: 'slug' as const, slug: assertConvexSidebarItemSlug(args.lookup.slug) }
        : args.lookup
    return await resolveSidebarItemAccessFn(ctx, lookup)
  },
})
