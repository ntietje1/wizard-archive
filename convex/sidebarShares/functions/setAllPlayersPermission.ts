import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignMutationCtx } from '../../functions'
import type { PermissionLevel } from '../../permissions/types'
import type { Id } from '../../_generated/dataModel'

export const setAllPlayersPermission = async (
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    permissionLevel,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    permissionLevel: PermissionLevel | null
  },
): Promise<null> => {
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

  return null
}
