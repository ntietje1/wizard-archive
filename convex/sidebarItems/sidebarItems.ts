import { getCampaignMembership, requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { pipeList } from '../common/pipeline'
import { getNote } from '../notes/notes'
import { getMap } from '../gameMaps/gameMaps'
import { getFolder, getSidebarItemAncestors } from '../folders/folders'
import { getFile } from '../files/files'
import { enforceSidebarItemSharePermissionsOrNull } from '../shares/itemShares'
import { enhanceSidebarItem } from './helpers'
import { SIDEBAR_ITEM_TYPES } from './baseTypes'
import type { AnySidebarItem, AnySidebarItemFromDb, AnySidebarItemWithContent } from './types'
import type { SidebarItemId, SidebarItemType } from './baseTypes';
import type { Ctx } from '../common/types'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

const getAllSidebarItems = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  viewAsPlayerId?: Id<'campaignMembers'>
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

  return pipeList(ctx, allItems)
    .map(enhanceSidebarItem)
    .enforce((ctx, item) => enforceSidebarItemSharePermissionsOrNull(ctx, item, viewAsPlayerId))
    .run()
}


export const getAllSidebarItemsWithAncestors = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  viewAsPlayerId?: Id<'campaignMembers'>
): Promise<Array<AnySidebarItem>> => {
  const sharedItems = await getAllSidebarItems(ctx, campaignId, viewAsPlayerId)

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
  viewAsPlayerId?: Id<'campaignMembers'>
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

  return pipeList(ctx, allItems)
    .map(enhanceSidebarItem)
    .enforce((ctx, item) => enforceSidebarItemSharePermissionsOrNull(ctx, item, viewAsPlayerId))
    .run()
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

  return pipeList(ctx, allItems)
    .map(enhanceSidebarItem)
    .enforce(enforceSidebarItemSharePermissionsOrNull)
    .run()
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
  viewAsPlayerId?: Id<'campaignMembers'>,
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

  return await getSidebarItemById(ctx, campaignId, item._id, viewAsPlayerId)
}

export const getSidebarItemById = async (
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  id: SidebarItemId,
  viewAsPlayerId?: Id<'campaignMembers'>,
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
      return await getFolder(ctx, id as Id<'folders'>, viewAsPlayerId)
    case SIDEBAR_ITEM_TYPES.notes:
      return await getNote(ctx, id as Id<'notes'>, viewAsPlayerId)
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return await getMap(ctx, id as Id<'gameMaps'>, viewAsPlayerId)
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
