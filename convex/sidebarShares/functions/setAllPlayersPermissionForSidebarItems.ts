import { requireItemAccess } from '../../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { PermissionLevel } from '../../permissions/types'
import type { Id } from '../../_generated/dataModel'

const MAX_SHARE_ITEMS_PER_REQUEST = 100

const applyAllPlayersPermissionToSidebarItem = async (
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    permissionLevel,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    permissionLevel: PermissionLevel | null
  },
): Promise<void> => {
  const itemFromDb = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
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

export const setAllPlayersPermissionForSidebarItems = async (
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
      applyAllPlayersPermissionToSidebarItem(ctx, {
        sidebarItemId,
        permissionLevel,
      }),
    ),
  )
}
