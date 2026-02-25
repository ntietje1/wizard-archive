import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignMutationCtx } from '../../functions'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export const setAllPlayersPermission = async (
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    permissionLevel,
  }: {
    sidebarItemId: SidebarItemId
    permissionLevel: PermissionLevel | null
  },
): Promise<null> => {
  const item = await ctx.db.get(sidebarItemId)
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await ctx.db.patch(sidebarItemId, {
    allPermissionLevel: permissionLevel,
  })

  return null
}
