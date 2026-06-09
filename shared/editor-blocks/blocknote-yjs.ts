import type * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc as bnBlocksToYDoc, yDocToBlocks as bnYDocToBlocks } from '@blocknote/core/yjs'
import { partialBlockNoteDocumentSchema } from './blockSchemas'
import {
  headlessEditorSchema,
  headlessLegacyMediaDecodeEditorSchema,
} from './editor-blocknote-schema'
import { migrateLegacyMediaBlocks } from './legacyMediaBlocks'
import type { CustomBlock, CustomPartialBlock } from './types'

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
  const editor = BlockNoteEditor.create({
    schema: headlessLegacyMediaDecodeEditorSchema,
    _headless: true,
  })
  try {
    return migrateLegacyMediaBlocks(
      bnYDocToBlocks(editor, doc, fragment) as Array<Record<string, unknown>>,
    ) as Array<CustomBlock>
  } finally {
    destroyHeadlessEditor(editor)
  }
}

function destroyHeadlessEditor(editor: { _tiptapEditor?: { destroy?: () => void } | null }): void {
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
  const normalizedBlocks = Array.isArray(blocks) ? migrateLegacyMediaBlocks(blocks) : blocks
  const result = partialBlockNoteDocumentSchema.safeParse(normalizedBlocks)
  if (!result.success) {
    throw new TypeError('blocksToYDoc requires an array of BlockNote-compatible blocks')
  }
  return result.data
}
