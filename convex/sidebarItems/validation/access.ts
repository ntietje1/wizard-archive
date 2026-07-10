import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { enhanceSidebarItem } from '../functions/enhanceSidebarItem'
import { canAccessResourceAndAncestors } from '../functions/resourceAccessPolicy'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type {
  AnyResourceRow,
  EnhancedResource,
  ResourceStatus,
} from '@wizard-archive/editor/resources/resource-contract'

export async function checkItemAccess<T extends AnyResourceRow>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    requiredLevel,
    requiredStatus,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
    requiredStatus?: ResourceStatus
  },
): Promise<EnhancedResource<T> | null> {
  if (!rawItem) return null
  const persistedRow = await ctx.db.get('sidebarItems', rawItem.id)
  if (
    !persistedRow ||
    (requiredStatus !== undefined && persistedRow.status !== requiredStatus) ||
    !(await canAccessResourceAndAncestors(ctx, persistedRow, requiredLevel))
  ) {
    return null
  }
  return (await enhanceSidebarItem(ctx, { item: rawItem })) as EnhancedResource<T>
}

export async function requireItemAccess<T extends AnyResourceRow>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    requiredLevel,
    requiredStatus,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
    requiredStatus?: ResourceStatus
  },
): Promise<EnhancedResource<T>> {
  if (!rawItem) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }
  const item = await checkItemAccess(ctx, { rawItem, requiredLevel, requiredStatus })
  if (!item) {
    throwClientError(
      ERROR_CODE.PERMISSION_DENIED,
      'You do not have sufficient permission for this item',
    )
  }
  return item
}
