import { ERROR_CODE, throwClientError } from '../../errors'
import { hasAtLeastPermissionLevel } from '../../permissions/hasAtLeastPermissionLevel'
import { enhanceSidebarItem } from '../functions/enhanceSidebarItem'
import type { PermissionLevel } from '../../permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { AnySidebarItemFromDb, EnhancedSidebarItem } from '../types/types'

export async function checkItemAccess<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    requiredLevel,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
  },
): Promise<EnhancedSidebarItem<T> | null> {
  if (!rawItem) return null
  const item = await enhanceSidebarItem(ctx, { item: rawItem })
  if (!hasAtLeastPermissionLevel(item.myPermissionLevel, requiredLevel)) {
    return null
  }
  return item as EnhancedSidebarItem<T>
}

export async function requireItemAccess<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    requiredLevel,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
  },
): Promise<EnhancedSidebarItem<T>> {
  if (!rawItem) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }
  const item = await checkItemAccess(ctx, { rawItem, requiredLevel })
  if (!item) {
    throwClientError(
      ERROR_CODE.PERMISSION_DENIED,
      'You do not have sufficient permission for this item',
    )
  }
  return item
}
