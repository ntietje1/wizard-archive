import * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc } from '@blocknote/core/yjs'
import { editorSchema } from '../../notes/editorSpecs'
import type { PartialBlock } from '@blocknote/core'

type AnyPartialBlock = PartialBlock<any, any, any>

export function makeYjsUpdate(): ArrayBuffer {
  const doc = new Y.Doc()
  // Side-effect: ensures the 'document' fragment exists in the Y.Doc state before encoding
  doc.getXmlFragment('document')
  const update = Y.encodeStateAsUpdate(doc)
  const ab = update.buffer.slice(
    update.byteOffset,
    update.byteOffset + update.byteLength,
  )
  doc.destroy()
  return ab as ArrayBuffer
}

export function makeYjsUpdateWithBlocks(
  blocks: Array<AnyPartialBlock>,
): ArrayBuffer {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    _headless: true,
  })
  let doc: Y.Doc | undefined
  try {
    doc = blocksToYDoc(editor, blocks, 'document')
    const update = Y.encodeStateAsUpdate(doc)
    return update.buffer.slice(
      update.byteOffset,
      update.byteOffset + update.byteLength,
    ) as ArrayBuffer
  } finally {
    doc?.destroy()
    editor._tiptapEditor.destroy()
  }
}
