import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const setFolderInheritShares = async (
  ctx: CampaignMutationCtx,
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

  await ctx.db.patch(folderId, {
    inheritShares,
  })

  return null
}
