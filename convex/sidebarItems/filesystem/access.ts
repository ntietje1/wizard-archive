import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { getPermissionRequirementForOperation } from '../../../shared/permissions/requirements'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { assertConvexResourceTitle } from '../validation/name'
import { assertConvexSidebarItemSlug } from '../validation/slug'
import type { PermissionOperation } from '../../../shared/permissions/requirements'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc } from '../../_generated/dataModel'

type SidebarItemAccessRow = Doc<'sidebarItems'>

export type AccessibleSidebarItemRow = Doc<'sidebarItems'> & {
  id: Doc<'sidebarItems'>['_id']
  name: ReturnType<typeof assertConvexResourceTitle>
  slug: ReturnType<typeof assertConvexSidebarItemSlug>
  myPermissionLevel: PermissionLevel
}

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
  const myPermissionLevel = await getSidebarItemPermissionLevel(ctx, {
    item: {
      id: rawItem._id,
      allPermissionLevel: rawItem.allPermissionLevel,
      parentId: rawItem.parentId,
    },
  })
  if (!hasAtLeastPermissionLevel(myPermissionLevel, requiredLevel)) return null
  return {
    ...rawItem,
    id: rawItem._id,
    name: assertConvexResourceTitle(rawItem.name),
    slug: assertConvexSidebarItemSlug(rawItem.slug),
    myPermissionLevel,
  }
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
