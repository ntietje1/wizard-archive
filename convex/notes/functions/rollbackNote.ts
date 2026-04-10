import { rollbackYjsDocument } from '../../yjsSync/functions/rollbackYjsDocument'
import { requireItemAccess } from '../../sidebarItems/validation'
import { loadSingleExtensionData } from '../../sidebarItems/functions/loadExtensionData'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { AuthMutationCtx } from '../../functions'

export async function rollbackNote(
  ctx: AuthMutationCtx,
  itemId: SidebarItemId,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const rawItem = await ctx.db.get('sidebarItems', itemId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.notes) {
    throw new Error(`rollbackNote: expected a note but got ${rawItem?.type}`)
  }

  const note = await loadSingleExtensionData(ctx, rawItem)

  await requireItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  await rollbackYjsDocument(ctx, note._id, snapshotData)
}
