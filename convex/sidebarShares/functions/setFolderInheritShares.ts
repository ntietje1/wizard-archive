import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
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
  const folderFromDb = await ctx.db.get(folderId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await requireDmRole(ctx, folder.campaignId)

  await ctx.db.patch(folderId, {
    inheritShares,
  })

  await logEditHistory(ctx, {
    itemId: folderId,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    campaignId: folder.campaignId,
    action: EDIT_HISTORY_ACTION.inherit_shares_changed,
    metadata: { inheritShares },
  })

  return null
}
