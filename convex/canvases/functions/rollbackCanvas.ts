import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { rollbackYjsDocument } from '../../yjsSync/functions/rollbackYjsDocument'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function rollbackCanvas(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.canvases)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Canvas not found')

  await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  await rollbackYjsDocument(ctx, rawItem._id, snapshotData)
}
