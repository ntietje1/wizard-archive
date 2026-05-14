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

export async function copyFolderCompanion(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const targetItem = await ctx.db.get('sidebarItems', targetItemId)
  if (!targetItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Folder target item not found')
  if (targetItem.type !== SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folder companion requires a folder item')
  }
  const existingFolder = await ctx.db
    .query('folders')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', targetItemId))
    .unique()
  if (existingFolder) {
    throwClientError(ERROR_CODE.CONFLICT, 'Folder companion already exists')
  }
  const sourceFolder = await ctx.db
    .query('folders')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', sourceItemId))
    .unique()
  if (!sourceFolder) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Missing folder companion for sidebar item ${sourceItemId}`,
    )
  }
  await ctx.db.insert('folders', {
    sidebarItemId: targetItemId,
    inheritShares: sourceFolder.inheritShares,
  })
}
