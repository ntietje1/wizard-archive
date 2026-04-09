import { rollbackYjsDocument } from '../../yjsSync/functions/rollbackYjsDocument'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function rollbackNote(
  ctx: AuthMutationCtx,
  itemId: SidebarItemId,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const note = await ctx.db.get("notes", itemId as Id<'notes'>)
  if (!note || note.type !== SIDEBAR_ITEM_TYPES.notes) {
    throw new Error(`rollbackNote: expected a note but got ${note?.type}`)
  }

  await requireItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  await rollbackYjsDocument(ctx, note._id as Id<'notes'>, snapshotData)
}
