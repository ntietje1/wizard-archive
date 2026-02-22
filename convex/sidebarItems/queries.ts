import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import {
  getAllSidebarItems as getAllSidebarItemsFn,
  getSidebarItemById as getSidebarItemByIdFn,
  getSidebarItemsByParent as getSidebarItemsByParentFn,
} from '../sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from './baseTypes'
import { anySidebarItemValidator } from './schema/schema'
import { anySidebarItemWithContentValidator } from './schema/contentSchema'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from './schema/baseValidators'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
  AnySidebarItemWithContent,
} from './types'
import type { SidebarItemType } from './baseTypes'

export const getAllSidebarItems = campaignQuery({
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getAllSidebarItemsFn(ctx, args.campaignId)
  },
})

export const getSidebarItemsByParent = campaignQuery({
  args: {
    parentId: v.optional(v.id('folders')),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
    return await getSidebarItemsByParentFn(ctx, args.campaignId, args.parentId)
  },
})

export const getSidebarItem = campaignQuery({
  args: {
    id: sidebarItemIdValidator,
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

export const getSidebarItemBySlug = campaignQuery({
  args: {
    type: sidebarItemTypeValidator,
    slug: v.string(),
  },
  returns: v.union(anySidebarItemWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItemWithContent | null> => {
    let item: AnySidebarItemFromDb | null = null

    switch (args.type as SidebarItemType) {
      case SIDEBAR_ITEM_TYPES.folders:
        item = await ctx.db
          .query('folders')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', args.campaignId).eq('slug', args.slug),
          )
          .unique()
        break
      case SIDEBAR_ITEM_TYPES.notes:
        item = await ctx.db
          .query('notes')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', args.campaignId).eq('slug', args.slug),
          )
          .unique()
        break
      case SIDEBAR_ITEM_TYPES.gameMaps:
        item = await ctx.db
          .query('gameMaps')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', args.campaignId).eq('slug', args.slug),
          )
          .unique()
        break
      case SIDEBAR_ITEM_TYPES.files:
        item = await ctx.db
          .query('files')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', args.campaignId).eq('slug', args.slug),
          )
          .unique()
        break
      default:
        throw new Error(`Unknown item type, ${args.type}`)
    }

    if (!item) {
      return null
    }

    return await getSidebarItemByIdFn(ctx, args.campaignId, item._id)
  },
})

export const getSidebarItemByName = campaignQuery({
  args: {
    name: v.string(),
  },
  returns: v.union(anySidebarItemValidator, v.null()),
  handler: async (ctx, args): Promise<AnySidebarItem | null> => {
    const [note, folder, map, file] = await Promise.all([
      ctx.db
        .query('notes')
        .withIndex('by_campaign_name', (q) =>
          q.eq('campaignId', args.campaignId).eq('name', args.name),
        )
        .first(),
      ctx.db
        .query('folders')
        .withIndex('by_campaign_name', (q) =>
          q.eq('campaignId', args.campaignId).eq('name', args.name),
        )
        .first(),
      ctx.db
        .query('gameMaps')
        .withIndex('by_campaign_name', (q) =>
          q.eq('campaignId', args.campaignId).eq('name', args.name),
        )
        .first(),
      ctx.db
        .query('files')
        .withIndex('by_campaign_name', (q) =>
          q.eq('campaignId', args.campaignId).eq('name', args.name),
        )
        .first(),
    ])

    const item = note ?? folder ?? map ?? file
    if (!item) {
      return null
    }

    return await getSidebarItemByIdFn(ctx, args.campaignId, item._id)
  },
})
