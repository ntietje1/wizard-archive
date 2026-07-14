import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { enhanceSidebarItemRows } from './enhanceSidebarItemRows'
import { canAccessResourceAndAncestors, resolveResourceRowsByAccess } from './resourceAccessPolicy'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { isActiveSidebarItem } from '../types/status'
import type { AnyResource } from '@wizard-archive/editor/resources/resource-contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { findSidebarItemRow } from './sidebarItemIdentity'

export const getActiveSidebarItemRowsByParent = async (
  ctx: CampaignQueryCtx,
  { parentId }: { parentId: Id<'sidebarItems'> | null },
): Promise<Array<Doc<'sidebarItems'>>> => {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('status', RESOURCE_STATUS.active)
        .eq('parentId', parentId),
    )
    .collect()
}

export const getSidebarItemsByParent = async (
  ctx: CampaignQueryCtx,
  { parentId }: { parentId: ResourceId | null },
): Promise<Array<AnyResource>> => {
  const parent = parentId ? await findSidebarItemRow(ctx, parentId) : null
  if (parentId) {
    if (
      !parent ||
      !isActiveSidebarItem(parent) ||
      !(await canAccessResourceAndAncestors(ctx, parent, PERMISSION_LEVEL.VIEW))
    ) {
      return []
    }
  }

  const rawItems = await getActiveSidebarItemRowsByParent(ctx, { parentId: parent?._id ?? null })
  return await enhanceSidebarItemRows(
    ctx,
    await resolveResourceRowsByAccess(ctx, rawItems, PERMISSION_LEVEL.VIEW),
  )
}
