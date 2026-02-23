import { getNote } from '../notes/notes'
import { getMap } from '../gameMaps/gameMaps'
import { getFolder } from '../folders/folders'
import { getFile } from '../files/files'
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
): Promise<Array<AnySidebarItem>> => {
  const campaignId = ctx.campaign._id

  const [folders, notes, maps, files] = await Promise.all([
    ctx.db
      .query('folders')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId),
      )
      .collect(),
    ctx.db
      .query('notes')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId),
      )
      .collect(),
    ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId),
      )
      .collect(),
    ctx.db
      .query('files')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId),
      )
      .collect(),
  ])

  const allItems: Array<AnySidebarItemFromDb> = [
    ...(folders as Array<AnySidebarItemFromDb>),
    ...(notes as Array<AnySidebarItemFromDb>),
    ...(maps as Array<AnySidebarItemFromDb>),
    ...(files as Array<AnySidebarItemFromDb>),
  ]

  return await Promise.all(
    allItems.map((item) => enhanceSidebarItem(ctx, item)),
  )
}

export const getSidebarItemsByParent = async (
  ctx: CampaignQueryCtx,
  parentId: Id<'folders'> | undefined,
): Promise<Array<AnySidebarItem>> => {
  const campaignId = ctx.campaign._id

  const [folders, notes, maps, files] = await Promise.all([
    ctx.db
      .query('folders')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('parentId', parentId),
      )
      .collect(),
    ctx.db
      .query('notes')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('parentId', parentId),
      )
      .collect(),
    ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('parentId', parentId),
      )
      .collect(),
    ctx.db
      .query('files')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('parentId', parentId),
      )
      .collect(),
  ])

  const allItems: Array<AnySidebarItemFromDb> = [
    ...(folders as Array<AnySidebarItemFromDb>),
    ...(notes as Array<AnySidebarItemFromDb>),
    ...(maps as Array<AnySidebarItemFromDb>),
    ...(files as Array<AnySidebarItemFromDb>),
  ]

  return await Promise.all(
    allItems.map((item) => enhanceSidebarItem(ctx, item)),
  )
}

export const getSidebarItemById = async (
  ctx: CampaignQueryCtx,
  id: SidebarItemId,
): Promise<AnySidebarItemWithContent | null> => {
  const campaignId = ctx.campaign._id

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

  return result
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
