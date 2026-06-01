import { prepareSidebarItemCreate } from '../validation/orchestration'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_STATUS } from '../../../shared/sidebar-items/types'
import { assertSidebarItemLifecycleConsistency } from '../types/status'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { SidebarItemType } from '../../../shared/sidebar-items/types'
import type { SidebarItemColor } from '../../../shared/sidebar-items/color'
import type { SidebarItemIconName } from '../../../shared/sidebar-items/icon'
import type { SidebarItemName } from '../../../shared/sidebar-items/name'
import type { SidebarItemSlug } from '../../../shared/sidebar-items/slug'

export type InsertFilesystemSidebarItemArgs = {
  type: SidebarItemType
  name: SidebarItemName
  parentId: Id<'sidebarItems'> | null
  iconName?: SidebarItemIconName
  color?: SidebarItemColor
  previewStorageId?: Doc<'sidebarItems'>['previewStorageId']
  previewUpdatedAt?: Doc<'sidebarItems'>['previewUpdatedAt']
}

export async function insertFilesystemSidebarItem(
  ctx: CampaignMutationCtx,
  {
    type,
    name,
    parentId,
    iconName,
    color,
    previewStorageId,
    previewUpdatedAt,
  }: InsertFilesystemSidebarItemArgs,
): Promise<{ itemId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const prepared = await prepareSidebarItemCreate(ctx, {
    parentId,
    name,
  })

  const row = {
    campaignId: ctx.campaign._id,
    name: prepared.name,
    slug: prepared.slug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId,
    allPermissionLevel: null,
    type,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.active,
    previewStorageId: previewStorageId ?? null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: previewUpdatedAt ?? null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: ctx.membership.userId,
  }
  assertSidebarItemLifecycleConsistency(row)
  const itemId = await ctx.db.insert('sidebarItems', row)

  return { itemId, slug: prepared.slug }
}
