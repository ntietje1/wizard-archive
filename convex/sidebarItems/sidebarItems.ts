import { Id } from '../_generated/dataModel'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { Ctx } from '../common/types'
import {
  AnySidebarItem,
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
  SidebarItemId,
  SidebarItemOrRootType,
  SidebarItemType,
} from './types'
import { getTag, getTagCategory } from '../tags/tags'
import { getNote } from '../notes/notes'
import { getMap } from '../gameMaps/gameMaps'
import { getFolder } from '../folders/folders'

export const getSidebarItemsByCategory = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  categoryId: Id<'tagCategories'>,
): Promise<AnySidebarItem[]> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )
  const category = await getTagCategory(ctx, campaignId, categoryId)

  const allItems: AnySidebarItem[] = []

  const tags = await ctx.db
    .query('tags')
    .withIndex('by_campaign_category', (q) =>
      q.eq('campaignId', campaignId).eq('categoryId', categoryId),
    )
    .collect()
    .then((tags) =>
      tags.map((tag) => ({
        ...tag,
        category,
      })),
    )
  allItems.push(...tags)

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_category', (q) =>
      q.eq('campaignId', campaignId).eq('categoryId', categoryId),
    )
    .collect()
    .then((folders) =>
      folders.map((folder) => ({
        ...folder,
        category,
      })),
    )
  allItems.push(...folders)

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_category', (q) =>
      q.eq('campaignId', campaignId).eq('categoryId', categoryId),
    )
    .collect()
    .then((notes) =>
      notes.map((note) => ({
        ...note,
        category,
      })),
    )
  allItems.push(...notes)

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_category', (q) =>
      q.eq('campaignId', campaignId).eq('categoryId', categoryId),
    )
    .collect()
    .then(
      (maps) =>
        maps.map((map) => ({
          ...map,
          category,
        })) as AnySidebarItem[],
    )
  allItems.push(...maps)

  return allItems
}

export const getSidebarItemsByParent = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: SidebarItemId | undefined,
): Promise<AnySidebarItem[]> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const allCategories = await ctx.db
    .query('tagCategories')
    .withIndex('by_campaign_slug', (q) => q.eq('campaignId', campaignId))
    .collect()

  const allItems: AnySidebarItem[] = []

  allItems.push(...allCategories.filter((c) => c.parentId === parentId))

  // categories cannot have parents, don't query them

  const tags = await ctx.db
    .query('tags')
    .withIndex('by_campaign_parent', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
    .then((tags) =>
      tags.map((tag) => ({
        ...tag,
        category: allCategories.find((c) => c._id === tag.categoryId),
      })),
    )
  allItems.push(...tags)

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...folders)

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...notes)

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', parentId),
    )
    .collect()
  allItems.push(...maps)

  return allItems
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

  //TODO: make these consistent on whether they throw or return null
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.tags:
      return await getTag(ctx, id as Id<'tags'>)
    case SIDEBAR_ITEM_TYPES.folders:
      return await getFolder(ctx, id as Id<'folders'>)
    case SIDEBAR_ITEM_TYPES.notes:
      return await getNote(ctx, id as Id<'notes'>)
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return await getMap(ctx, id as Id<'gameMaps'>)
    case SIDEBAR_ITEM_TYPES.tagCategories:
      return await getTagCategory(ctx, campaignId, id as Id<'tagCategories'>)
    default:
      // @ts-ignore
      console.log('Unknown item type', item.type)
      return null
  }
}

export async function getSidebarItemAncestors(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  initialParentId: SidebarItemId | undefined,
): Promise<AnySidebarItem[]> {
  const ancestors: AnySidebarItem[] = []
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

    if (
      previousParentItem != null &&
      !isValidSidebarParent(previousParentItem.type, parentItem.type)
    ) {
      console.error('Invalid parent item for item id:', currentParentId)
    }

    ancestors.unshift(parentItem)
    currentParentId = parentItem?.parentId
    previousParentItem = parentItem
  }

  return ancestors
}

const validRootChildren: Array<SidebarItemType> = [
  SIDEBAR_ITEM_TYPES.tagCategories,
  SIDEBAR_ITEM_TYPES.notes,
  SIDEBAR_ITEM_TYPES.folders,
  SIDEBAR_ITEM_TYPES.gameMaps,
]

const validCategoryChildren: Array<SidebarItemType> = [
  SIDEBAR_ITEM_TYPES.tags,
  SIDEBAR_ITEM_TYPES.notes,
  SIDEBAR_ITEM_TYPES.folders,
  SIDEBAR_ITEM_TYPES.gameMaps,
]

const validTagChildren: Array<SidebarItemType> = [
  SIDEBAR_ITEM_TYPES.notes,
  SIDEBAR_ITEM_TYPES.gameMaps,
]

export const validFolderChildren: Array<SidebarItemType> = [
  SIDEBAR_ITEM_TYPES.tags,
  SIDEBAR_ITEM_TYPES.notes,
  SIDEBAR_ITEM_TYPES.folders,
  SIDEBAR_ITEM_TYPES.gameMaps,
]

export const validNoteChildren: Array<SidebarItemType> = [
  SIDEBAR_ITEM_TYPES.notes,
  SIDEBAR_ITEM_TYPES.gameMaps,
]

export const validMapChildren: Array<SidebarItemType> = []

export const validSidebarChildren: Record<
  SidebarItemOrRootType,
  Array<SidebarItemType>
> = {
  [SIDEBAR_ROOT_TYPE]: validRootChildren,
  [SIDEBAR_ITEM_TYPES.tagCategories]: validCategoryChildren,
  [SIDEBAR_ITEM_TYPES.tags]: validTagChildren,
  [SIDEBAR_ITEM_TYPES.folders]: validFolderChildren,
  [SIDEBAR_ITEM_TYPES.notes]: validNoteChildren,
  [SIDEBAR_ITEM_TYPES.gameMaps]: validMapChildren,
}

export const isValidSidebarParent = (
  childType: SidebarItemType,
  parentType: SidebarItemOrRootType,
): boolean => {
  return validSidebarChildren[parentType].includes(childType)
}

export const defaultNameMap: Record<SidebarItemType, string> = {
  [SIDEBAR_ITEM_TYPES.tagCategories]: 'Untitled Category',
  [SIDEBAR_ITEM_TYPES.tags]: 'Untitled Tag',
  [SIDEBAR_ITEM_TYPES.folders]: 'Untitled Folder',
  [SIDEBAR_ITEM_TYPES.notes]: 'Untitled Note',
  [SIDEBAR_ITEM_TYPES.gameMaps]: 'Untitled Map',
}

export const defaultItemName = (
  item: AnySidebarItem | null | undefined,
): string => {
  return item ? defaultNameMap[item.type] : 'Untitled'
}
