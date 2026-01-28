import { v } from 'convex/values'
import { query } from '../_generated/server'
import {
  getAllSidebarItemsWithAncestors as getAllSidebarItemsWithAncestorsFn,
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
import { checkUniqueNameUnderParent as checkUniqueNameUnderParentFn } from './validation'
import type { ValidationResult } from './validation'
import type { AnySidebarItem, AnySidebarItemWithContent } from './types'

export const getAllSidebarItems = query({
  args: {
    campaignId: v.id('campaigns'),
    viewAsPlayerId: v.optional(v.id('campaignMembers')),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getAllSidebarItemsWithAncestorsFn(
      ctx,
      args.campaignId,
      args.viewAsPlayerId,
    )
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
    viewAsPlayerId: v.optional(v.id('campaignMembers')),
  },
  returns: anySidebarItemWithContentValidator,
  handler: async (ctx, args): Promise<AnySidebarItemWithContent> => {
    const result = await getSidebarItemByIdFn(
      ctx,
      args.campaignId,
      args.id,
      args.viewAsPlayerId,
    )
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

export const validationResultValidator = v.object({
  valid: v.boolean(),
  error: v.optional(v.string()),
})

export const checkUniqueNameUnderParent = query({
  args: {
    campaignId: v.id('campaigns'),
    parentId: v.optional(v.id('folders')),
    name: v.optional(v.string()),
    excludeId: v.optional(sidebarItemIdValidator),
  },
  returns: validationResultValidator,
  handler: async (ctx, args): Promise<ValidationResult> => {
    const result = await checkUniqueNameUnderParentFn(
      ctx,
      args.campaignId,
      args.parentId,
      args.name,
      args.excludeId,
    )
    return result
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
