import type * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc as bnBlocksToYDoc, yDocToBlocks as bnYDocToBlocks } from '@blocknote/core/yjs'
import { partialBlockNoteDocumentSchema } from '../../../convex/blocks/blockSchemas'
import { headlessEditorSchema } from '../../../shared/editor-blocknote-schema'
import type { CustomBlock, CustomPartialBlock } from '../../../convex/blocks/types'

function createHeadlessEditor() {
  return BlockNoteEditor.create({ schema: headlessEditorSchema, _headless: true })
}

export function blocksToYDoc(blocks: Array<CustomPartialBlock>, fragment: string): Y.Doc {
  const parsedBlocks = parseCustomPartialBlocks(blocks)
  const editor = createHeadlessEditor()
  try {
    return bnBlocksToYDoc(
      editor as unknown as Parameters<typeof bnBlocksToYDoc>[0],
      parsedBlocks as Parameters<typeof bnBlocksToYDoc>[1],
      fragment,
    )
  } finally {
    destroyHeadlessEditor(editor)
  }
}

export function yDocToBlocks(doc: Y.Doc, fragment: string): Array<CustomBlock> {
  const editor = createHeadlessEditor()
  try {
    return bnYDocToBlocks(editor, doc, fragment) as Array<CustomBlock>
  } finally {
    destroyHeadlessEditor(editor)
  }
}

function destroyHeadlessEditor(editor: ReturnType<typeof createHeadlessEditor>): void {
  try {
    const tiptapEditor = editor._tiptapEditor
    if (tiptapEditor && typeof tiptapEditor.destroy === 'function') {
      tiptapEditor.destroy()
    }
  } catch (error) {
    console.error('Failed to destroy tiptap editor in destroyHeadlessEditor', error)
  }
}

function parseCustomPartialBlocks(blocks: unknown): Array<CustomPartialBlock> {
  const result = partialBlockNoteDocumentSchema.safeParse(blocks)
  if (!result.success) {
    throw new TypeError('blocksToYDoc requires an array of BlockNote-compatible blocks')
  }
  return result.data
}
