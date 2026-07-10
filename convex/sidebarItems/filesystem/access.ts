import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { getPermissionRequirementForOperation } from '../../../shared/permissions/requirements'
import { enhanceBase } from '../functions/enhanceBaseSidebarItem'
import type { PermissionOperation } from '../../../shared/permissions/requirements'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { AnyResourceRow } from '@wizard-archive/editor/resources/resource-contract'
import type { Doc } from '../../_generated/dataModel'

type SidebarItemAccessRow = AnyResourceRow | Doc<'sidebarItems'>

export type AccessibleSidebarItemRow = Doc<'sidebarItems'> &
  Awaited<ReturnType<typeof enhanceBase<Doc<'sidebarItems'>>>>

export async function checkSidebarItemRowAccess<T extends SidebarItemAccessRow>(
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
  return { ...rawItem, ...item } as AccessibleSidebarItemRow
}

export async function requireSidebarItemRowAccess<T extends SidebarItemAccessRow>(
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

export async function requireSidebarItemRowOperationAccess<T extends SidebarItemAccessRow>(
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
