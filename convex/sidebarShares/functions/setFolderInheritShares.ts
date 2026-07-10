import { requireItemAccess } from '../../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
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
  if (!rawItem || rawItem.type !== RESOURCE_TYPES.folders)
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
    itemType: RESOURCE_TYPES.folders,
    action: EDIT_HISTORY_ACTION.inherit_shares_changed,
    metadata: { inheritShares, previousInheritShares: folder.inheritShares },
  })

  return null
}
