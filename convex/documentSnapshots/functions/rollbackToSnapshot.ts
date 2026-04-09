import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation'
import { requireCampaignMembership } from '../../functions'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { assertNever } from '../../common/types'
import { rollbackNote } from '../../notes/functions/rollbackNote'
import { rollbackCanvas } from '../../canvases/functions/rollbackCanvas'
import { rollbackGameMap } from '../../gameMaps/functions/rollbackGameMap'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemType } from '../../sidebarItems/types/baseTypes'

export async function rollbackToSnapshot(
  ctx: AuthMutationCtx,
  { editHistoryId }: { editHistoryId: Id<'editHistory'> },
): Promise<void> {
  const historyEntry = await ctx.db.get(editHistoryId)
  if (!historyEntry) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'History entry not found')
  }

  const itemFromDb = await ctx.db.get(historyEntry.itemId)
  await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })
  const { membership } = await requireCampaignMembership(
    ctx,
    historyEntry.campaignId,
  )

  const snapshot = await ctx.db
    .query('documentSnapshots')
    .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
    .first()

  if (!snapshot) {
    throwClientError(
      ERROR_CODE.NOT_FOUND,
      'No snapshot found for this history entry',
    )
  }

  const itemType = historyEntry.itemType as SidebarItemType

  switch (itemType) {
    case SIDEBAR_ITEM_TYPES.notes:
      await rollbackNote(ctx, historyEntry.itemId, snapshot.data)
      break
    case SIDEBAR_ITEM_TYPES.canvases:
      await rollbackCanvas(ctx, historyEntry.itemId, snapshot.data)
      break
    case SIDEBAR_ITEM_TYPES.gameMaps:
      await rollbackGameMap(ctx, historyEntry.itemId, snapshot.data)
      break
    case SIDEBAR_ITEM_TYPES.folders:
    case SIDEBAR_ITEM_TYPES.files:
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        `${itemType} does not support rollback`,
      )
      break
    default:
      assertNever(itemType)
  }

  const now = Date.now()
  const profileId = ctx.user.profile._id

  await ctx.db.patch(historyEntry.itemId, {
    updatedTime: now,
    updatedBy: profileId,
  })

  await ctx.db.insert('editHistory', {
    itemId: historyEntry.itemId,
    itemType: historyEntry.itemType,
    campaignId: historyEntry.campaignId,
    campaignMemberId: membership._id,
    action: EDIT_HISTORY_ACTION.rolled_back,
    metadata: { restoredFromHistoryEntryId: editHistoryId },
    hasSnapshot: false,
  })
}
