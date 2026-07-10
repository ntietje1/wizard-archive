import * as Y from 'yjs'
import { noteBlocksToYDoc } from '@wizard-archive/editor/notes/document-yjs'
import type { PartialNoteBlock } from '@wizard-archive/editor/notes/document-contract'

type TestInlineContentArray = Extract<
  NonNullable<PartialNoteBlock['content']>,
  ReadonlyArray<unknown>
>
export type TestInlineContent = TestInlineContentArray[number]

function toArrayBuffer(update: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer
}

export function makeYjsUpdate(): ArrayBuffer {
  const doc = new Y.Doc()
  doc.getXmlFragment('document')
  const update = toArrayBuffer(Y.encodeStateAsUpdate(doc))
  doc.destroy()
  return update
}

export function makeYjsUpdateWithBlocks(blocks: Array<PartialNoteBlock>): ArrayBuffer {
  const doc = noteBlocksToYDoc(blocks, 'document')
  try {
    return toArrayBuffer(Y.encodeStateAsUpdate(doc))
  } finally {
    doc.destroy()
  }
}
