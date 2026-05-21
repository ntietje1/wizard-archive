import { rollbackYjsDocument } from '../../yjsSync/functions/rollbackYjsDocument'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function rollbackNote(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.notes) {
    throw new Error(`rollbackNote: expected a note but got ${rawItem?.type}`)
  }

  await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  await rollbackYjsDocument(ctx, rawItem._id, snapshotData)
  await ctx.scheduler.runAfter(0, internal.notes.internalActions.persistNoteBlocksFromYjs, {
    documentId: rawItem._id,
  })
}
