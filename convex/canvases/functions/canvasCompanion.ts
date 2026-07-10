import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { copyYjsUpdates } from '../../yjsSync/functions/copyYjsUpdates'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createCanvasCompanion(
  ctx: CampaignMutationCtx,
  { canvasId }: { canvasId: Id<'sidebarItems'> },
): Promise<void> {
  await ctx.db.insert('canvases', {
    sidebarItemId: canvasId,
  })

  await createYjsDocument(ctx, { documentId: canvasId })

  await logEditHistory(ctx, {
    itemId: canvasId,
    itemType: RESOURCE_TYPES.canvases,
    action: EDIT_HISTORY_ACTION.created,
  })
}

export async function copyCanvasCompanion(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const targetItem = await ctx.db.get('sidebarItems', targetItemId)
  if (!targetItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Canvas target item not found')
  if (targetItem.type !== RESOURCE_TYPES.canvases) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Canvas companion requires a canvas item')
  }
  const existingCanvas = await ctx.db
    .query('canvases')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', targetItemId))
    .unique()
  if (existingCanvas) {
    throwClientError(ERROR_CODE.CONFLICT, 'Canvas companion already exists')
  }
  await ctx.db.insert('canvases', { sidebarItemId: targetItemId })
  await copyYjsUpdates(ctx, sourceItemId, targetItemId)
}
