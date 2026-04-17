import { prepareSidebarItemCreate } from '../../sidebarItems/validation/orchestration'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/validation/name'
import type { SidebarItemColor } from '../../sidebarItems/validation/color'
import type { SidebarItemIconName } from '../../sidebarItems/validation/icon'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { SidebarItemSlug } from '../../sidebarItems/validation/slug'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function findSidebarChildByName(
  ctx: CampaignMutationCtx,
  {
    parentId,
    name,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: SidebarItemName
  },
): Promise<Doc<'sidebarItems'> | null> {
  const normalizedName = name.toLowerCase()
  const siblings = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('location', SIDEBAR_ITEM_LOCATION.sidebar)
        .eq('parentId', parentId),
    )
    .collect()

  return (
    siblings.find(
      (item) => item.deletionTime === null && item.name.trim().toLowerCase() === normalizedName,
    ) ?? null
  )
}

export async function insertFolder(
  ctx: CampaignMutationCtx,
  {
    name,
    parentId,
    iconName,
    color,
  }: {
    name: SidebarItemName
    parentId: Id<'sidebarItems'> | null
    iconName?: SidebarItemIconName
    color?: SidebarItemColor
  },
): Promise<{ folderId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const prepared = await prepareSidebarItemCreate(ctx, {
    parentId,
    name,
  })

  const userId = ctx.membership.userId

  const folderId = await ctx.db.insert('sidebarItems', {
    name: prepared.name,
    slug: prepared.slug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId,
    allPermissionLevel: null,
    campaignId: ctx.campaign._id,
    type: SIDEBAR_ITEM_TYPES.folders,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: userId,
  })

  await ctx.db.insert('folders', {
    sidebarItemId: folderId,
    inheritShares: false,
  })

  await logEditHistory(ctx, {
    itemId: folderId,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { folderId, slug: prepared.slug }
}
