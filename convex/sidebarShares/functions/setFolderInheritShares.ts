import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const setFolderInheritShares = async (
  ctx: AuthMutationCtx,
  {
    folderId,
    inheritShares,
  }: {
    folderId: Id<'folders'>
    inheritShares: boolean
  },
): Promise<null> => {
  const folder = await ctx.db.get(folderId)
  await requireItemAccess(ctx, {
    rawItem: folder,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await requireDmRole(ctx, folder!.campaignId)

  await ctx.db.patch(folderId, {
    inheritShares,
  })

  return null
}
