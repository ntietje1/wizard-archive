import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { getPermissionRequirementForOperation } from '../../../shared/permissions/requirements'
import { enhanceBase } from '../functions/enhanceBaseSidebarItem'
import type { PermissionOperation } from '../../../shared/permissions/requirements'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type {
  AnySidebarItemRow,
  EnhanceSidebarItem,
} from '../../../shared/sidebar-items/model-types'

export type AccessibleSidebarItemRow = EnhanceSidebarItem<AnySidebarItemRow>

export async function checkSidebarItemRowAccess<T extends AnySidebarItemRow>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    requiredLevel,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
  },
): Promise<AccessibleSidebarItemRow | null> {
  if (!rawItem) return null
  if (rawItem.campaignId !== ctx.campaign._id) return null
  const item = await enhanceBase(ctx, { item: rawItem })
  if (!hasAtLeastPermissionLevel(item.myPermissionLevel, requiredLevel)) return null
  return item
}

export async function requireSidebarItemRowAccess<T extends AnySidebarItemRow>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    requiredLevel,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
  },
): Promise<AccessibleSidebarItemRow> {
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  const item = await checkSidebarItemRowAccess(ctx, { rawItem, requiredLevel })
  if (!item) {
    throwClientError(
      ERROR_CODE.PERMISSION_DENIED,
      'You do not have sufficient permission for this item',
    )
  }
  return item
}

export async function requireSidebarItemRowOperationAccess<T extends AnySidebarItemRow>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    operation,
  }: {
    rawItem: T | null
    operation: PermissionOperation
  },
): Promise<AccessibleSidebarItemRow> {
  return await requireSidebarItemRowAccess(ctx, {
    rawItem,
    requiredLevel: getPermissionRequirementForOperation(operation),
  })
}
