import * as Y from 'yjs'
import { reconstructYDoc } from './reconstructYDoc'
import { uint8ToArrayBuffer } from './uint8ToArrayBuffer'
import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

const COMPACT_THRESHOLD = 50

export function shouldCompact(updateCount: number): boolean {
  return updateCount > COMPACT_THRESHOLD
}

export async function compactUpdates(
  ctx: MutationCtx,
  documentId: Id<'notes'>,
) {
  const { doc, updates } = await reconstructYDoc(ctx, documentId)
  if (updates.length <= 1) return

  const encoded = Y.encodeStateAsUpdate(doc)
  const maxSeq = Math.max(...updates.map((u) => u.seq))

  await Promise.all(updates.map((row) => ctx.db.delete(row._id)))

  await ctx.db.insert('yjsUpdates', {
    documentId,
    update: uint8ToArrayBuffer(encoded),
    seq: maxSeq,
    isSnapshot: true,
  })
}
