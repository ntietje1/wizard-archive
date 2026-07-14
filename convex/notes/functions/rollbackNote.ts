import { rollbackYjsDocument } from '../../yjsSync/functions/rollbackYjsDocument'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function rollbackNote(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
  snapshotData: ArrayBuffer,
  expected: { revision: number; seq: number },
): Promise<boolean> {
  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem || rawItem.type !== RESOURCE_TYPES.notes) {
    throw new Error(`rollbackNote: expected a note but got ${rawItem?.type}`)
  }

  await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  const restored = await rollbackYjsDocument(ctx, itemId, snapshotData, expected)
  if (!restored) return false
  await ctx.scheduler.runAfter(0, internal.notes.internalActions.persistNoteBlocksFromYjs, {
    documentId: itemId,
    campaignMemberId: ctx.membership._id,
  })
  return true
}
