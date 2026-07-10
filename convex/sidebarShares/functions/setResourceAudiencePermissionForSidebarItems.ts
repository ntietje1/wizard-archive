import { requireItemAccess } from '../../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { Id } from '../../_generated/dataModel'

const MAX_SHARE_ITEMS_PER_REQUEST = 100

const applyResourceAudiencePermission = async (
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    permissionLevel,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    permissionLevel: PermissionLevel | null
  },
): Promise<void> => {
  const itemRow = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemRow,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if ((item.allPermissionLevel ?? null) === permissionLevel) return

  await ctx.db.patch('sidebarItems', sidebarItemId, {
    allPermissionLevel: permissionLevel,
    updatedBy: ctx.membership.userId,
    updatedTime: Date.now(),
  })

  await logEditHistory(ctx, {
    itemId: sidebarItemId,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.permission_changed,
    metadata: {
      memberName: null,
      level: permissionLevel,
      previousLevel: item.allPermissionLevel ?? null,
    },
  })
}

export const setResourceAudiencePermissionForSidebarItems = async (
  ctx: CampaignMutationCtx,
  {
    sidebarItemIds,
    permissionLevel,
  }: {
    sidebarItemIds: Array<Id<'sidebarItems'>>
    permissionLevel: PermissionLevel | null
  },
): Promise<void> => {
  if (sidebarItemIds.length > MAX_SHARE_ITEMS_PER_REQUEST) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Cannot update more than ${MAX_SHARE_ITEMS_PER_REQUEST} items at once`,
    )
  }
  await Promise.all(
    sidebarItemIds.map((sidebarItemId) =>
      applyResourceAudiencePermission(ctx, {
        sidebarItemId,
        permissionLevel,
      }),
    ),
  )
}
