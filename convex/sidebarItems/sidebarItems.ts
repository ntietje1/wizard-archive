import { getNote } from '../notes/notes'
import { getMap } from '../gameMaps/gameMaps'
import { getFolder } from '../folders/folders'
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
import type { Id } from '../_generated/dataModel'
import type { CampaignQueryCtx } from '../functions'

export const getAllSidebarItems = async (
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<Array<AnySidebarItem>> => {
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

export const getSidebarItemsByParent = async (
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
): Promise<Array<AnySidebarItem>> => {
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

export const getSidebarItemById = async (
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
  id: SidebarItemId,
): Promise<AnySidebarItemWithContent | null> => {
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
