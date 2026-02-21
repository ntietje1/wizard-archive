import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getNote } from '../notes/notes'
import { getMap } from '../gameMaps/gameMaps'
import { getFolder, getSidebarItemAncestors } from '../folders/folders'
import { getFile } from '../files/files'
import {
  getSidebarItemPermissionLevel,
  hasAtLeastPermissionLevel,
} from '../shares/itemShares'
import { PERMISSION_LEVEL } from '../shares/types'
import { enhanceSidebarItem } from './helpers'
import { SIDEBAR_ITEM_TYPES } from './baseTypes'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
  AnySidebarItemWithContent,
} from './types'
import type { SidebarItemId, SidebarItemType } from './baseTypes'
import type { Ctx } from '../common/types'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export const getAllSidebarItems = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Array<AnySidebarItem>> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const allItems: Array<AnySidebarItemFromDb> = []

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  allItems.push(...(folders as Array<AnySidebarItemFromDb>))

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  allItems.push(...(notes as Array<AnySidebarItemFromDb>))

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  allItems.push(...(maps as Array<AnySidebarItemFromDb>))

  const files = await ctx.db
    .query('files')
    .withIndex('by_campaign_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  allItems.push(...(files as Array<AnySidebarItemFromDb>))

  const enhanced = await Promise.all(
    allItems.map((item) => enhanceSidebarItem(ctx, item)),
  )
  return enhanced
}

export const getAllSidebarItemsWithAncestors = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Array<AnySidebarItem>> => {
  const sharedItems = await getAllSidebarItems(ctx, campaignId)

  const parentIds = new Set<Id<'folders'>>()
  for (const item of sharedItems) {
    if (item.parentId) {
      parentIds.add(item.parentId)
    }
  }

  const ancestorArrays = await Promise.all(
    [...parentIds].map((parentId) =>
      getSidebarItemAncestors(ctx, campaignId, parentId),
    ),
  )

  const sharedItemIds = new Set(sharedItems.map((item) => item._id))
  const ancestorMap = new Map<Id<'folders'>, AnySidebarItem>()

  for (const ancestors of ancestorArrays) {
    for (const ancestor of ancestors) {
      if (!sharedItemIds.has(ancestor._id) && !ancestorMap.has(ancestor._id)) {
        ancestorMap.set(ancestor._id, ancestor)
      }
    }
  }

  return [...sharedItems, ...ancestorMap.values()]
}

export const getSidebarItemsByParent = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
): Promise<Array<AnySidebarItem>> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const allItems: Array<AnySidebarItemFromDb> = []

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...(folders as Array<AnySidebarItemFromDb>))

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...(notes as Array<AnySidebarItemFromDb>))

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...(maps as Array<AnySidebarItemFromDb>))

  const files = await ctx.db
    .query('files')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...(files as Array<AnySidebarItemFromDb>))

  const enhanced = await Promise.all(
    allItems.map((item) => enhanceSidebarItem(ctx, item)),
  )
  return enhanced
}

export const getSidebarItemsByParentAndName = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
  name: string | undefined,
): Promise<Array<AnySidebarItem>> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const allItems: Array<AnySidebarItemFromDb> = []

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId).eq('name', name),
    )
    .collect()
  allItems.push(...(folders as Array<AnySidebarItemFromDb>))

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId).eq('name', name),
    )
    .collect()
  allItems.push(...(notes as Array<AnySidebarItemFromDb>))

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId).eq('name', name),
    )
    .collect()
  allItems.push(...(maps as Array<AnySidebarItemFromDb>))

  const files = await ctx.db
    .query('files')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId).eq('name', name),
    )
    .collect()
  allItems.push(...(files as Array<AnySidebarItemFromDb>))

  const enhanced = await Promise.all(
    allItems.map((item) => enhanceSidebarItem(ctx, item)),
  )
  return enhanced
}

export const getSidebarItemByName = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  name: string,
): Promise<AnySidebarItemWithContent | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  let item: AnySidebarItemFromDb | null = null

  const note = await ctx.db
    .query('notes')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (note) {
    item = note
  }

  const folder = await ctx.db
    .query('folders')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (folder) {
    item = folder
  }

  const map = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (map) {
    item = map
  }

  const file = await ctx.db
    .query('files')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (file) {
    item = file
  }

  if (!item) {
    return null
  }

  return await getSidebarItemById(ctx, campaignId, item._id)
}

export const getSidebarItemBySlug = async (
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  type: SidebarItemType,
  slug: string,
): Promise<AnySidebarItemWithContent | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  let item: AnySidebarItemFromDb | null = null

  switch (type) {
    case SIDEBAR_ITEM_TYPES.folders:
      item = await ctx.db
        .query('folders')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', campaignId).eq('slug', slug),
        )
        .unique()
      break
    case SIDEBAR_ITEM_TYPES.notes:
      item = await ctx.db
        .query('notes')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', campaignId).eq('slug', slug),
        )
        .unique()
      break
    case SIDEBAR_ITEM_TYPES.gameMaps:
      item = await ctx.db
        .query('gameMaps')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', campaignId).eq('slug', slug),
        )
        .unique()
      break
    case SIDEBAR_ITEM_TYPES.files:
      item = await ctx.db
        .query('files')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', campaignId).eq('slug', slug),
        )
        .unique()
      break
    default:
      throw new Error(`Unknown item type, ${type}`)
  }

  if (!item) {
    return null
  }

  return await getSidebarItemById(ctx, campaignId, item._id)
}

export const getSidebarItemById = async (
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  id: SidebarItemId,
): Promise<AnySidebarItemWithContent | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const item = await ctx.db.get(id)
  if (!item || item.campaignId !== campaignId) {
    return null
  }

  let result: AnySidebarItemWithContent | null = null

  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      result = await getFolder(ctx, id as Id<'folders'>)
      break
    case SIDEBAR_ITEM_TYPES.notes:
      result = await getNote(ctx, id as Id<'notes'>)
      break
    case SIDEBAR_ITEM_TYPES.gameMaps:
      result = await getMap(ctx, id as Id<'gameMaps'>)
      break
    case SIDEBAR_ITEM_TYPES.files:
      result = await getFile(ctx, id as Id<'files'>)
      break
    default:
      throw new Error(`Unknown item type`)
  }

  if (!result) {
    return null
  }

  const myPermissionLevel = await getSidebarItemPermissionLevel(ctx, result)
  if (!hasAtLeastPermissionLevel(myPermissionLevel, PERMISSION_LEVEL.VIEW)) {
    return null
  }

  return { ...result, myPermissionLevel }
}

export const defaultNameMap: Record<SidebarItemType, string> = {
  [SIDEBAR_ITEM_TYPES.folders]: 'Untitled Folder',
  [SIDEBAR_ITEM_TYPES.notes]: 'Untitled Note',
  [SIDEBAR_ITEM_TYPES.gameMaps]: 'Untitled Map',
  [SIDEBAR_ITEM_TYPES.files]: 'Untitled File',
}

export const defaultItemName = (
  item: AnySidebarItem | AnySidebarItemFromDb | null | undefined,
): string => {
  return item ? defaultNameMap[item.type] : 'Untitled Item'
}
