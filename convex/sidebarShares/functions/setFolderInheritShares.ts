import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { getFolder } from '../../sidebarItems/functions/loadExtensionData'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const setFolderInheritShares = async (
  ctx: AuthMutationCtx,
  {
    folderId,
    inheritShares,
  }: {
    folderId: Id<'sidebarItems'>
    inheritShares: boolean
  },
): Promise<null> => {
  const folderFromDb = await getFolder(ctx, folderId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await requireDmRole(ctx, folder.campaignId)

  if (folder.inheritShares === inheritShares) return null

  const ext = await ctx.db
    .query('folders')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', folderId))
    .unique()
  if (ext) {
    await ctx.db.patch('folders', ext._id, { inheritShares })
  }

  await logEditHistory(ctx, {
    itemId: folderId,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    campaignId: folder.campaignId,
    action: EDIT_HISTORY_ACTION.inherit_shares_changed,
    metadata: { inheritShares, previousInheritShares: folder.inheritShares },
  })

  return null
}
