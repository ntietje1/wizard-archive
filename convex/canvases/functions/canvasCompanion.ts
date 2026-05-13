import * as Y from 'yjs'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createCanvasCompanion(
  ctx: CampaignMutationCtx,
  { canvasId }: { canvasId: Id<'sidebarItems'> },
): Promise<void> {
  const sidebarItem = await ctx.db.get('sidebarItems', canvasId)
  if (!sidebarItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Canvas sidebar item not found')
  if (sidebarItem.type !== SIDEBAR_ITEM_TYPES.canvases) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Canvas companion requires a canvas sidebar item',
    )
  }
  const existingCanvas = await ctx.db
    .query('canvases')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', canvasId))
    .unique()
  if (existingCanvas) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Canvas companion already exists')
  }

  await ctx.db.insert('canvases', {
    sidebarItemId: canvasId,
  })

  const doc = new Y.Doc()
  try {
    // Yjs map reads intentionally initialize empty CRDT maps so peers can observe them.
    doc.getMap('nodes')
    doc.getMap('edges')
    const initialState = uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc))

    await createYjsDocument(ctx, { documentId: canvasId, initialState })

    await logEditHistory(ctx, {
      itemId: canvasId,
      itemType: SIDEBAR_ITEM_TYPES.canvases,
      action: EDIT_HISTORY_ACTION.created,
    })
  } finally {
    doc.destroy()
  }
}
