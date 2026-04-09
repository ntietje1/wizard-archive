import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { rollbackYjsDocument } from '../../yjsSync/functions/rollbackYjsDocument'
import type { AuthMutationCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { Id } from '../../_generated/dataModel'

export async function rollbackCanvas(
  ctx: AuthMutationCtx,
  itemId: SidebarItemId,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const canvas = await ctx.db.get(itemId)
  if (!canvas || canvas.type !== SIDEBAR_ITEM_TYPES.canvases)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Canvas not found')

  await requireItemAccess(ctx, {
    rawItem: canvas,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  await rollbackYjsDocument(ctx, itemId as Id<'canvases'>, snapshotData)
}
