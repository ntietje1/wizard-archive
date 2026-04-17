import { requireItemAccess } from '../../sidebarItems/validation/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const setFolderInheritShares = async (
  ctx: CampaignMutationCtx,
  {
    folderId,
    inheritShares,
  }: {
    folderId: Id<'sidebarItems'>
    inheritShares: boolean
  },
): Promise<null> => {
  const rawItem = await getSidebarItem(ctx, folderId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.folders)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Folder not found')
  const folder = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
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
    action: EDIT_HISTORY_ACTION.inherit_shares_changed,
    metadata: { inheritShares, previousInheritShares: folder.inheritShares },
  })

  return null
}
