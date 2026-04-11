import * as Y from 'yjs'
import { blocksToYDoc } from '../../notes/blocknote'
import type { CustomPartialBlock } from '../../notes/editorSpecs'

export type TestInlineContent = {
  type: string
  text?: string
  styles?: Record<string, boolean | string>
}

/**
 * Simplified block type for tests. BlockNote's `PartialBlock` has an optional
 * `type` discriminant which prevents TypeScript from narrowing per-variant in
 * object literals. This type captures the shape tests actually use while
 * keeping basic structural checking.
 */
export type TestBlock = {
  id?: string
  type: string
  props?: Record<string, unknown>
  content?: Array<TestInlineContent>
  children?: Array<TestBlock>
}

export function makeYjsUpdate(): ArrayBuffer {
  const doc = new Y.Doc()
  // Side-effect: ensures the 'document' fragment exists in the Y.Doc state before encoding
  doc.getXmlFragment('document')
  const update = Y.encodeStateAsUpdate(doc)
  const ab = update.buffer.slice(update.byteOffset, update.byteOffset + update.byteLength)
  doc.destroy()
  return ab as ArrayBuffer
}

export function makeYjsUpdateWithBlocks(blocks: Array<TestBlock>): ArrayBuffer {
  const doc = blocksToYDoc(blocks as Array<CustomPartialBlock>, 'document')
  try {
    const update = Y.encodeStateAsUpdate(doc)
    return update.buffer.slice(
      update.byteOffset,
      update.byteOffset + update.byteLength,
    ) as ArrayBuffer
  } finally {
    doc.destroy()
  }
}
