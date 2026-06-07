'use node'

import * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { yDocToBlocks as blockNoteYDocToBlocks } from '@blocknote/core/yjs'
import { headlessLegacyMediaDecodeEditorSchema } from '../../shared/editor-blocks/editor-blocknote-schema'
import { migrateLegacyMediaBlocks } from '../../shared/editor-blocks/legacyMediaBlocks'
import { parseEditorBlocks } from '../blocks/parseEditorBlocks'
import type { Doc } from '../_generated/dataModel'
import type { CustomBlock } from '../../shared/editor-blocks/types'

const DOCUMENT_FRAGMENT_NAME = 'document'

function createHeadlessEditor() {
  return BlockNoteEditor.create({ schema: headlessLegacyMediaDecodeEditorSchema, _headless: true })
}

function destroyHeadlessEditor(editor: ReturnType<typeof createHeadlessEditor>): void {
  const tiptapEditor = editor._tiptapEditor
  if (tiptapEditor && typeof tiptapEditor.destroy === 'function') {
    tiptapEditor.destroy()
  }
}

export function yjsUpdatesToBlocks(
  updates: Array<Pick<Doc<'yjsUpdates'>, 'update'>>,
): Array<CustomBlock> {
  const doc = new Y.Doc()
  const editor = createHeadlessEditor()

  try {
    for (const row of updates) {
      Y.applyUpdate(doc, new Uint8Array(row.update))
    }
    const rawBlocks = normalizeForConvex(
      migrateLegacyMediaBlocks(
        blockNoteYDocToBlocks(editor, doc, DOCUMENT_FRAGMENT_NAME) as Array<
          Record<string, unknown>
        >,
      ),
    )
    try {
      return parseEditorBlocks(rawBlocks)
    } catch (error) {
      throw new Error(
        `Invalid BlockNote output for fragment "${DOCUMENT_FRAGMENT_NAME}": ${formatInvalidBlockNoteOutput(rawBlocks)}; ${formatError(error)}`,
      )
    }
  } finally {
    destroyHeadlessEditor(editor)
    doc.destroy()
  }
}

function formatInvalidBlockNoteOutput(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeForConvex(value: unknown): unknown {
  if (value === undefined) return null
  if (Array.isArray(value)) return value.map(normalizeForConvex)
  if (!value || typeof value !== 'object') return value

  const result: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    if (nestedValue !== undefined) {
      result[key] = normalizeForConvex(nestedValue)
    }
  }
  return result
}
