import * as Y from 'yjs'
import { createSnapshot } from '../../documentSnapshots/functions/createSnapshot'
import { reconstructYDoc } from './reconstructYDoc'
import { uint8ToArrayBuffer } from './uint8ToArrayBuffer'
import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { SnapshotType } from '../../documentSnapshots/types'

export async function captureYjsState(
  ctx: MutationCtx,
  {
    documentId,
    snapshotType,
    editHistoryId,
    campaignId,
    createdBy,
  }: {
    documentId: Id<'notes'> | Id<'canvases'>
    snapshotType: SnapshotType
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
    createdBy: Id<'userProfiles'>
  },
): Promise<void> {
  const doc = await ctx.db.get(documentId)
  if (!doc) return

  let yDoc: Y.Doc | undefined
  try {
    ;({ doc: yDoc } = await reconstructYDoc(ctx, documentId))
    const encoded = Y.encodeStateAsUpdate(yDoc)
    await createSnapshot(ctx, {
      itemId: documentId,
      itemType: doc.type,
      editHistoryId,
      campaignId,
      snapshotType,
      data: uint8ToArrayBuffer(encoded),
      createdBy,
    })
  } finally {
    yDoc?.destroy()
  }
}
