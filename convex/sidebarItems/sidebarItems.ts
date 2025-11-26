import { Id } from "../_generated/dataModel";
import { requireCampaignMembership } from "../campaigns/campaigns";
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types";
import { Ctx } from "../common/types";
import { getTagCategory, getTagsByCategory } from "../tags/tags";
import { AnySidebarItem, SIDEBAR_ITEM_TYPES } from "./types";


export const getSidebarItemsByCategory = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  categoryId: Id<'tagCategories'>
): Promise<AnySidebarItem[]> => {
  await requireCampaignMembership(
    ctx,
    { campaignId: campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
  )
  const category = await getTagCategory(ctx, campaignId, categoryId)
  const tags = await getTagsByCategory(ctx, categoryId)

  const allItems: AnySidebarItem[] = []

  // Get folders
  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_category_parent', (q) => q
      .eq('campaignId', campaignId)
      .eq('categoryId', categoryId ?? undefined)
    )
    .collect()
    .then((folders) => folders.map((folder) => ({
      ...folder,
      category,
      type: SIDEBAR_ITEM_TYPES.folders,
    }))
    )
  allItems.push(...folders)

  // Get notes
  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_category_parent', (q) => q
      .eq('campaignId', campaignId)
      .eq('categoryId', categoryId ?? undefined)
    )
    .collect()
    .then((notes) => notes.map((note) => ({
      ...note,
      category,
      tag: tags.find((t) => t._id === note.tagId),
      type: SIDEBAR_ITEM_TYPES.notes,
    }))
    )
  allItems.push(...notes)

    // Get maps
    const maps = await ctx.db
        .query('gameMaps')
        .withIndex('by_campaign_category_parent', (q) => q
        .eq('campaignId', campaignId)
        .eq('categoryId', categoryId)
        )
        .collect()
        .then(
        (maps) => maps.map((map) => ({
            ...map,
            category,
            type: SIDEBAR_ITEM_TYPES.gameMaps,
        })) as AnySidebarItem[]
        )
    allItems.push(...maps)
  

  return allItems
}

export const getSidebarItemsByParent = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  categoryId: Id<'tagCategories'> | undefined, // undefined category = has no category
  parentId: Id<'folders'> | undefined
): Promise<AnySidebarItem[]> => {
  await requireCampaignMembership(
    ctx,
    { campaignId: campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
  )

  const category = categoryId
    ? await getTagCategory(ctx, campaignId, categoryId)
    : undefined
  const tags = categoryId ? await getTagsByCategory(ctx, categoryId) : []

  const allItems: AnySidebarItem[] = []

  // Get folders
  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_category_parent', (q) => q
      .eq('campaignId', campaignId)
      .eq('categoryId', categoryId ?? undefined)
      .eq('parentFolderId', parentId)
    )
    .collect()
    .then((folders) => folders.map((folder) => ({
      ...folder,
      category,
      type: SIDEBAR_ITEM_TYPES.folders,
    }))
    )
  allItems.push(...folders)

  // Get notes
  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_category_parent', (q) => q
      .eq('campaignId', campaignId)
      .eq('categoryId', categoryId ?? undefined)
      .eq('parentFolderId', parentId)
    )
    .collect()
    .then((notes) => notes.map((note) => ({
      ...note,
      category,
      tag: tags.find((t) => t._id === note.tagId),
      type: SIDEBAR_ITEM_TYPES.notes,
    }))
    )
  allItems.push(...notes)

    // Get maps
    const maps = await ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_category_parent', (q) => q
        .eq('campaignId', campaignId)
        .eq('categoryId', categoryId)
        .eq('parentFolderId', parentId)
      )
      .collect()
      .then(
        (maps) => maps.map((map) => ({
          ...map,
          category,
          type: SIDEBAR_ITEM_TYPES.gameMaps,
        })) as AnySidebarItem[]
      )
    allItems.push(...maps)

  return allItems
}