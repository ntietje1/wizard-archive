import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { rollbackYjsDocument } from '../../yjsSync/functions/rollbackYjsDocument'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function rollbackCanvas(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
  snapshotData: ArrayBuffer,
  expected: { revision: number; seq: number },
): Promise<boolean> {
  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem || rawItem.type !== RESOURCE_TYPES.canvases)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Canvas not found')

  await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  return await rollbackYjsDocument(ctx, itemId, snapshotData, expected)
}
