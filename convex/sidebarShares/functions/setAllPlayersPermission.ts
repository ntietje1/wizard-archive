import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { AuthMutationCtx } from '../../functions'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export const setAllPlayersPermission = async (
  ctx: AuthMutationCtx,
  {
    sidebarItemId,
    permissionLevel,
  }: {
    sidebarItemId: SidebarItemId
    permissionLevel: PermissionLevel | null
  },
): Promise<null> => {
  const itemFromDb = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  const { membership } = await requireDmRole(ctx, item.campaignId)

  await ctx.db.patch('sidebarItems', sidebarItemId, {
    allPermissionLevel: permissionLevel,
    updatedBy: membership.userId,
    updatedTime: Date.now(),
  })

  await logEditHistory(ctx, {
    itemId: sidebarItemId,
    itemType: item.type,
    campaignId: item.campaignId,
    action: EDIT_HISTORY_ACTION.permission_changed,
    metadata: {
      memberName: null,
      level: permissionLevel,
      previousLevel: item.allPermissionLevel ?? null,
    },
  })

  return null
}
