import * as Y from 'yjs'
import { blocksToYDoc } from '../../../src/features/editor/blocknote-yjs'
import type { CustomPartialBlock } from '../../../src/features/editor/editor-specs'

export type TestBlock = CustomPartialBlock
type TestInlineContentArray = Extract<
  NonNullable<CustomPartialBlock['content']>,
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

export function makeYjsUpdateWithBlocks(blocks: Array<TestBlock>): ArrayBuffer {
  const doc = blocksToYDoc(blocks, 'document')
  try {
    return toArrayBuffer(Y.encodeStateAsUpdate(doc))
  } finally {
    doc.destroy()
  }
}
