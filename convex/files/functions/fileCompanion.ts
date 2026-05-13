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
    storageId = null,
  }: {
    fileId: Id<'sidebarItems'>
    storageId?: Id<'_storage'> | null
  },
): Promise<void> {
  const sidebarItem = await ctx.db.get('sidebarItems', fileId)
  if (!sidebarItem) throwClientError(ERROR_CODE.NOT_FOUND, 'File sidebar item not found')
  if (sidebarItem.type !== SIDEBAR_ITEM_TYPES.files) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'File companion requires a file sidebar item')
  }
  if (storageId) {
    const storage = await ctx.db.system.get('_storage', storageId)
    if (!storage) throwClientError(ERROR_CODE.NOT_FOUND, 'File storage object not found')
  }

  await ctx.db.insert('files', {
    sidebarItemId: fileId,
    storageId: storageId ?? null,
  })

  await logEditHistory(ctx, {
    itemId: fileId,
    itemType: SIDEBAR_ITEM_TYPES.files,
    action: EDIT_HISTORY_ACTION.created,
  })
}
