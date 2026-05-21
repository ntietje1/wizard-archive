import type * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc as bnBlocksToYDoc, yDocToBlocks as bnYDocToBlocks } from '@blocknote/core/yjs'
import { editorSchema } from './editor-specs'
import type { CustomBlock, CustomPartialBlock } from './editor-specs'

function createHeadlessEditor() {
  return BlockNoteEditor.create({ schema: editorSchema, _headless: true })
}

export function blocksToYDoc(blocks: Array<CustomPartialBlock>, fragment: string): Y.Doc {
  assertCustomPartialBlocks(blocks)
  const editor = createHeadlessEditor()
  try {
    return bnBlocksToYDoc(
      editor as unknown as Parameters<typeof bnBlocksToYDoc>[0],
      blocks as Parameters<typeof bnBlocksToYDoc>[1],
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

function assertCustomPartialBlocks(blocks: unknown): asserts blocks is Array<CustomPartialBlock> {
  if (!Array.isArray(blocks) || !blocks.every(isCustomPartialBlock)) {
    throw new TypeError('blocksToYDoc requires an array of BlockNote-compatible blocks')
  }
}

function isCustomPartialBlock(block: unknown): block is CustomPartialBlock {
  if (!block || typeof block !== 'object') return false
  if (!('type' in block) || typeof block.type !== 'string') return false
  if ('id' in block && typeof block.id !== 'string') return false
  if ('props' in block && (!block.props || typeof block.props !== 'object')) return false
  if ('content' in block && !isBlockContent(block.content)) return false
  if ('children' in block) {
    return Array.isArray(block.children) && block.children.every(isCustomPartialBlock)
  }
  return true
}

function isBlockContent(content: unknown): boolean {
  return (
    content === undefined ||
    Array.isArray(content) ||
    Boolean(content && typeof content === 'object')
  )
}
