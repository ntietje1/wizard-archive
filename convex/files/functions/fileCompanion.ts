import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createFileCompanion(
  ctx: CampaignMutationCtx,
  {
    fileId,
  }: {
    fileId: Id<'sidebarItems'>
  },
): Promise<void> {
  const sidebarItem = await ctx.db.get('sidebarItems', fileId)
  if (!sidebarItem) throwClientError(ERROR_CODE.NOT_FOUND, 'File sidebar item not found')
  if (sidebarItem.type !== SIDEBAR_ITEM_TYPES.files) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'File companion requires a file sidebar item')
  }
  const existingFile = await ctx.db
    .query('files')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
    .unique()
  if (existingFile) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'File companion already exists')
  }
  await ctx.db.insert('files', {
    sidebarItemId: fileId,
    storageId: null,
  })

  await logEditHistory(ctx, {
    itemId: fileId,
    itemType: SIDEBAR_ITEM_TYPES.files,
    action: EDIT_HISTORY_ACTION.created,
  })
}
