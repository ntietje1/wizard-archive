import type * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc as bnBlocksToYDoc, yDocToBlocks as bnYDocToBlocks } from '@blocknote/core/yjs'
import { editorSchema } from './editorSpecs'
import type { CustomBlock, CustomPartialBlock } from './editorSpecs'

function createHeadlessEditor() {
  return BlockNoteEditor.create({ schema: editorSchema, _headless: true })
}

export function blocksToYDoc(blocks: Array<CustomPartialBlock>, fragment: string): Y.Doc {
  const editor = createHeadlessEditor()
  try {
    return bnBlocksToYDoc(editor, blocks, fragment)
  } finally {
    editor._tiptapEditor.destroy()
  }
}

export function yDocToBlocks(doc: Y.Doc, fragment: string): Array<CustomBlock> {
  const editor = createHeadlessEditor()
  try {
    return bnYDocToBlocks(editor, doc, fragment)
  } finally {
    editor._tiptapEditor.destroy()
  }
}
