import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { DocumentSnapshot } from '../types'

export async function getSnapshotForHistoryEntry(
  ctx: CampaignQueryCtx,
  { editHistoryId }: { editHistoryId: Id<'editHistory'> },
): Promise<DocumentSnapshot | null> {
  const historyEntry = await ctx.db.get('editHistory', editHistoryId)
  if (!historyEntry) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'History entry not found')
  }

  const item = await getSidebarItem(ctx, historyEntry.itemId)
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const snapshot = await ctx.db
    .query('documentSnapshots')
    .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
    .first()

  return snapshot
}
