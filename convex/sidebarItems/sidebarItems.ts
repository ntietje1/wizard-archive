import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getNote, getNoteBySlug } from '../notes/notes'
import { getMap, getMapBySlug } from '../gameMaps/gameMaps'
import { getFolder, getFolderBySlug } from '../folders/folders'
import { getFile, getFileBySlug } from '../files/files'
import { enhanceSidebarItem } from './helpers'
import { SIDEBAR_ITEM_TYPES } from './baseTypes'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
  AnySidebarItemWithContent,
  SidebarItemId,
  SidebarItemType,
} from './types'
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

  return await Promise.all(
    allItems.map(async (item) => await enhanceSidebarItem(ctx, item)),
  )
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

  return await Promise.all(
    allItems.map(async (item) => await enhanceSidebarItem(ctx, item)),
  )
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

  return await Promise.all(
    allItems.map(async (item) => await enhanceSidebarItem(ctx, item)),
  )
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

  let itemId: SidebarItemId | null = null

  const note = await ctx.db
    .query('notes')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (note) {
    itemId = note._id
  }

  const folder = await ctx.db
    .query('folders')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (folder) {
    itemId = folder._id
  }

  const map = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (map) {
    itemId = map._id
  }

  const file = await ctx.db
    .query('files')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (file) {
    itemId = file._id
  }

  if (!itemId) {
    return null
  }

  return await getSidebarItemById(ctx, campaignId, itemId)
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

  switch (type) {
    case SIDEBAR_ITEM_TYPES.folders:
      return await getFolderBySlug(ctx, campaignId, slug)
    case SIDEBAR_ITEM_TYPES.notes:
      return await getNoteBySlug(ctx, campaignId, slug)
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return await getMapBySlug(ctx, campaignId, slug)
    case SIDEBAR_ITEM_TYPES.files:
      return await getFileBySlug(ctx, campaignId, slug)
    default:
      throw new Error(`Unknown item type, ${type}`)
  }
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

  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      return await getFolder(ctx, id as Id<'folders'>)
    case SIDEBAR_ITEM_TYPES.notes:
      return await getNote(ctx, id as Id<'notes'>)
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return await getMap(ctx, id as Id<'gameMaps'>)
    case SIDEBAR_ITEM_TYPES.files:
      return await getFile(ctx, id as Id<'files'>)
    default:
      throw new Error(`Unknown item type`)
  }
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
