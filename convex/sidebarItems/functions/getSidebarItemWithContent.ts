import { getSidebarItem } from './getSidebarItem'
import { enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { checkItemAccess } from '../validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
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
  id: Id<'sidebarItems'>,
): Promise<AnyResourceWithContent | null>
export async function getSidebarItemWithContent<T extends ResourceKind>(
  ctx: CampaignQueryCtx,
  id: Id<'sidebarItems'>,
  expectedType: T,
): Promise<ResourceWithContentByKind<T> | null>
export async function getSidebarItemWithContent<T extends ResourceKind>(
  ctx: CampaignQueryCtx,
  id: Id<'sidebarItems'>,
  expectedType?: T,
): Promise<AnyResourceWithContent | null> {
  const item = await getSidebarItem(ctx, id)
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
