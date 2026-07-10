'use node'

import * as Y from 'yjs'
import { uint8ToArrayBuffer } from '../../shared/yjs-sync/uint8ToArrayBuffer'
import type { Doc } from '../_generated/dataModel'

export function compactYjsUpdates(
  updates: Array<Pick<Doc<'yjsUpdates'>, 'update' | 'seq'>>,
): { update: ArrayBuffer; seq: number } | null {
  if (updates.length <= 1) return null

  const doc = new Y.Doc()
  try {
    for (const row of updates) {
      Y.applyUpdate(doc, new Uint8Array(row.update))
    }
    const encoded = Y.encodeStateAsUpdate(doc)
    return { update: uint8ToArrayBuffer(encoded), seq: updates[updates.length - 1].seq }
  } finally {
    doc.destroy()
  }
}

export function encodeYjsSnapshot(updates: Array<Pick<Doc<'yjsUpdates'>, 'update'>>): ArrayBuffer {
  const yDoc = new Y.Doc()
  try {
    for (const row of updates) {
      Y.applyUpdate(yDoc, new Uint8Array(row.update))
    }
    const encoded = Y.encodeStateAsUpdate(yDoc)
    return uint8ToArrayBuffer(encoded)
  } finally {
    yDoc.destroy()
  }
}
