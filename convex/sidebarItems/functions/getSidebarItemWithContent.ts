import { getSidebarItem } from './getSidebarItem'
import { enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { checkItemAccess } from '../validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { CampaignQueryCtx } from '../../functions'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { findSidebarItemRow } from './sidebarItemIdentity'
import type {
  AnyResource,
  AnyResourceWithContent,
  ResourceByKind,
  ResourceWithContentByKind,
  ResourceKind,
} from '@wizard-archive/editor/resources/resource-contract'

function isSidebarItemOfType<T extends ResourceKind>(
  item: AnyResource,
  expectedType: T,
): item is ResourceByKind<T> {
  return item.type === expectedType
}

export async function getSidebarItemWithContent(
  ctx: CampaignQueryCtx,
  id: ResourceId,
): Promise<AnyResourceWithContent | null>
export async function getSidebarItemWithContent<T extends ResourceKind>(
  ctx: CampaignQueryCtx,
  id: ResourceId,
  expectedType: T,
): Promise<ResourceWithContentByKind<T> | null>
export async function getSidebarItemWithContent<T extends ResourceKind>(
  ctx: CampaignQueryCtx,
  id: ResourceId,
  expectedType?: T,
): Promise<AnyResourceWithContent | null> {
  const row = await findSidebarItemRow(ctx, id)
  if (!row) return null
  const item = await getSidebarItem(ctx, row._id)
  if (!item) return null
  const enhanced = await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
    requiredStatus: RESOURCE_STATUS.active,
  })
  if (!enhanced) return null

  if (expectedType !== undefined && !isSidebarItemOfType(enhanced, expectedType)) {
    return null
  }

  return enhanceSidebarItemWithContent(ctx, { item: enhanced })
}
