import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { DocumentSnapshot } from '../types'

export async function getSnapshotForHistoryEntry(
  ctx: AuthQueryCtx,
  { editHistoryId }: { editHistoryId: Id<'editHistory'> },
): Promise<DocumentSnapshot | null> {
  const historyEntry = await ctx.db.get("editHistory", editHistoryId)
  if (!historyEntry) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'History entry not found')
  }

  // eslint-disable-next-line @convex-dev/explicit-table-ids -- itemId is a SidebarItemId union
  const item = await ctx.db.get(historyEntry.itemId)
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
