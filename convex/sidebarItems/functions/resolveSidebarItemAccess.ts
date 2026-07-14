import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { enhanceSidebarItem, enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import { canAccessResourceAndAncestors } from './resourceAccessPolicy'
import { isTrashedSidebarItem, isUndoHiddenSidebarItem } from '../types/status'
import type { CampaignQueryCtx } from '../../functions'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { AnyResourceWithContent } from '@wizard-archive/editor/resources/resource-contract'
import { findSidebarItemRow } from './sidebarItemIdentity'

export type SidebarItemAccessResolution =
  | { status: 'not_found' }
  | { status: 'not_shared' }
  | { status: 'trashed' }
  | { status: 'available'; item: AnyResourceWithContent }

export async function resolveSidebarItemAccess(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
): Promise<SidebarItemAccessResolution> {
  const rawItem = await findSidebarItemRow(ctx, resourceId)
  if (!rawItem || rawItem.campaignId !== ctx.campaign._id || isUndoHiddenSidebarItem(rawItem)) {
    return { status: 'not_found' }
  }

  if (!(await canAccessResourceAndAncestors(ctx, rawItem, PERMISSION_LEVEL.VIEW))) {
    return { status: 'not_shared' }
  }
  if (isTrashedSidebarItem(rawItem)) return { status: 'trashed' }

  const item = await getSidebarItem(ctx, rawItem._id)
  if (!item) return { status: 'not_found' }
  const enhanced = await enhanceSidebarItem(ctx, { item })

  return {
    status: 'available',
    item: await enhanceSidebarItemWithContent(ctx, { item: enhanced }),
  }
}
