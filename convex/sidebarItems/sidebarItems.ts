import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getNote, getNoteBySlug } from '../notes/notes'
import { getMap, getMapBySlug } from '../gameMaps/gameMaps'
import { getFolder, getFolderBySlug } from '../folders/folders'
import { getFile, getFileBySlug } from '../files/files'
import { SIDEBAR_ITEM_TYPES } from './types'
import type { AnySidebarItem, SidebarItemId, SidebarItemType } from './types'
import type { Ctx } from '../common/types'
import type { Id } from '../_generated/dataModel'

export const getAllSidebarItems = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Array<AnySidebarItem>> => {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const bookmarks = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('campaignMemberId', campaignWithMembership.member._id),
    )
    .collect()
  const bookmarkedIds = new Set(bookmarks.map((b) => b.sidebarItemId))

  const allItems: Array<AnySidebarItem> = []

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  allItems.push(...(folders as Array<AnySidebarItem>))

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  allItems.push(...(notes as Array<AnySidebarItem>))

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  allItems.push(...(maps as Array<AnySidebarItem>))

  const files = await ctx.db
    .query('files')
    .withIndex('by_campaign_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  allItems.push(...(files as Array<AnySidebarItem>))

  return allItems.map((item) => ({
    ...item,
    isBookmarked: bookmarkedIds.has(item._id),
  }))
}

export const getSidebarItemsByParent = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: SidebarItemId | undefined,
): Promise<Array<AnySidebarItem>> => {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const bookmarks = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('campaignMemberId', campaignWithMembership.member._id),
    )
    .collect()
  const bookmarkedIds = new Set(bookmarks.map((b) => b.sidebarItemId))

  const allItems: Array<AnySidebarItem> = []

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...(folders as Array<AnySidebarItem>))

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...(notes as Array<AnySidebarItem>))

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...(maps as Array<AnySidebarItem>))

  const files = await ctx.db
    .query('files')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...(files as Array<AnySidebarItem>))

  return allItems.map((item) => ({
    ...item,
    isBookmarked: bookmarkedIds.has(item._id),
  }))
}

export const getSidebarItemsByParentAndName = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: SidebarItemId | undefined,
  name: string | undefined,
): Promise<Array<AnySidebarItem>> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const allItems: Array<AnySidebarItem> = []

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId).eq('name', name),
    )
    .collect()
  allItems.push(...(folders as Array<AnySidebarItem>))

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId).eq('name', name),
    )
    .collect()
  allItems.push(...(notes as Array<AnySidebarItem>))

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId).eq('name', name),
    )
    .collect()
  allItems.push(...(maps as Array<AnySidebarItem>))

  const files = await ctx.db
    .query('files')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId).eq('name', name),
    )
    .collect()
  allItems.push(...(files as Array<AnySidebarItem>))

  return allItems
}

export const getSidebarItemsByName = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  name: string,
): Promise<AnySidebarItem | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (notes) return notes as AnySidebarItem

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (folders) return folders as AnySidebarItem

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (maps) return maps as AnySidebarItem

  const files = await ctx.db
    .query('files')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name),
    )
    .first()
  if (files) return files as AnySidebarItem

  return null
}

export const getSidebarItemBySlug = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  type: SidebarItemType,
  slug: string,
): Promise<AnySidebarItem | null> => {
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
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  id: SidebarItemId,
): Promise<AnySidebarItem | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const item = await ctx.db.get(id)
  if (!item) {
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
      console.warn('Unknown item type', item)
      return null
  }
}

export async function getSidebarItemAncestors(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  initialParentId: SidebarItemId | undefined,
): Promise<Array<AnySidebarItem>> {
  const ancestors: Array<AnySidebarItem> = []
  let currentParentId = initialParentId
  let previousParentItem: AnySidebarItem | null = null

  while (currentParentId) {
    const parentItem = await getSidebarItemById(
      ctx,
      campaignId,
      currentParentId,
    )
    if (!parentItem) {
      break
    }

    ancestors.unshift(parentItem)
    currentParentId = parentItem.parentId
    previousParentItem = parentItem
  }

  return ancestors
}

export const defaultNameMap: Record<SidebarItemType, string> = {
  [SIDEBAR_ITEM_TYPES.folders]: 'Untitled Folder',
  [SIDEBAR_ITEM_TYPES.notes]: 'Untitled Note',
  [SIDEBAR_ITEM_TYPES.gameMaps]: 'Untitled Map',
  [SIDEBAR_ITEM_TYPES.files]: 'Untitled File',
}

export const defaultItemName = (
  item: AnySidebarItem | null | undefined,
): string => {
  return item ? defaultNameMap[item.type] : 'Untitled Item'
}
