import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getNote, getNoteBySlug } from '../notes/notes'
import { getMap, getMapBySlug } from '../gameMaps/gameMaps'
import { getFolder, getFolderBySlug } from '../folders/folders'
import { getFile, getFileBySlug } from '../files/files'
import { SIDEBAR_ITEM_TYPES, SIDEBAR_ROOT_TYPE } from './types'
import type {
  AnySidebarItem,
  SidebarItemId,
  SidebarItemOrRootType,
  SidebarItemType,
} from './types'
import type { Ctx } from '../common/types'
import type { Id } from '../_generated/dataModel'

export const getAllSidebarItems = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Array<AnySidebarItem>> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

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

  return allItems
}

export const getSidebarItemsByParent = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: SidebarItemId | undefined,
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

  return allItems
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

export const checkUniqueNameUnderParent = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: SidebarItemId | undefined,
  name: string | undefined,
  excludeId?: SidebarItemId,
): Promise<boolean> => {
  if (!name || name.trim() === '') {
    return true
  }

  const items: Array<AnySidebarItem> = await getSidebarItemsByParentAndName(
    ctx,
    campaignId,
    parentId,
    name,
  )
  if (items.length == 1 && items[0]._id === excludeId) {
    return true
  } else if (items.length == 0) {
    return true
  } else {
    return false
  }
}

export const validateUniqueNameUnderParent = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: SidebarItemId | undefined,
  name: string | undefined,
  excludeId?: SidebarItemId,
): Promise<boolean> => {
  const isUnique = await checkUniqueNameUnderParent(
    ctx,
    campaignId,
    parentId,
    name,
    excludeId,
  )
  if (!isUnique) {
    throw new Error('An item with this name already exists here')
  }
  return true
}
