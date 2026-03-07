import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
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
  const itemFromDb = await ctx.db.get(sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await requireDmRole(ctx, item.campaignId)

  await ctx.db.patch(sidebarItemId, {
    allPermissionLevel: permissionLevel,
  })

  return null
}
