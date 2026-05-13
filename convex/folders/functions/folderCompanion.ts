import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createFolderCompanion(
  ctx: CampaignMutationCtx,
  { folderId }: { folderId: Id<'sidebarItems'> },
): Promise<void> {
  const sidebarItem = await ctx.db.get('sidebarItems', folderId)
  if (!sidebarItem || sidebarItem.type !== SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Invalid sidebarItem: must exist and be a folder',
    )
  }
  const existingFolder = await ctx.db
    .query('folders')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', folderId))
    .unique()
  if (existingFolder) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folder companion already exists')
  }

  await ctx.db.insert('folders', {
    sidebarItemId: folderId,
    inheritShares: false,
  })

  await logEditHistory(ctx, {
    itemId: folderId,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    action: EDIT_HISTORY_ACTION.created,
  })
}
