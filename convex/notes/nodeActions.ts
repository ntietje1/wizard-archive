'use node'

import * as Y from 'yjs'
import { v } from 'convex/values'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc, yDocToBlocks } from '@blocknote/core/yjs'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { customBlockValidator } from '../blocks/schema'
import { editorSchema } from './editorSpecs'
import type { CustomBlock } from './editorSpecs'

function uint8ToArrayBuffer(uint8: Uint8Array): ArrayBuffer {
  if (uint8.byteOffset === 0 && uint8.byteLength === uint8.buffer.byteLength) {
    return uint8.buffer as ArrayBuffer
  }
  return uint8.buffer.slice(
    uint8.byteOffset,
    uint8.byteOffset + uint8.byteLength,
  ) as ArrayBuffer
}

/**
 * Converts blocks to a Yjs update and pushes it as the initial state
 * for a newly created note. Runs in Node.js to support @blocknote/core.
 */
export const initializeNoteContent = internalAction({
  args: {
    noteId: v.id('notes'),
    content: v.array(customBlockValidator),
  },
  handler: async (ctx, { noteId, content }) => {
    if (content.length === 0) return

    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      _headless: true,
    })
    let doc: Y.Doc | undefined
    try {
      doc = blocksToYDoc(editor, content as Array<CustomBlock>)
      const update = uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc))
      await ctx.runMutation(
        internal.notes.internalMutations.pushYjsUpdateInternal,
        {
          documentId: noteId,
          update,
        },
      )
    } finally {
      doc?.destroy()
      editor._tiptapEditor.destroy()
    }
  },
})

/**
 * Reads the Yjs document for a note, converts it to blocks, and saves them.
 * Runs in Node.js to support @blocknote/core.
 */
export const persistNoteBlocksNode = internalAction({
  args: {
    documentId: v.id('notes'),
  },
  handler: async (ctx, { documentId }) => {
    const updates = await ctx.runQuery(
      internal.yjsSync.internalQueries.getUpdatesInternal,
      { documentId },
    )

    const doc = new Y.Doc()
    let editor: ReturnType<typeof BlockNoteEditor.create> | undefined
    try {
      for (const entry of updates) {
        Y.applyUpdate(doc, new Uint8Array(entry.update))
      }

      editor = BlockNoteEditor.create({
        schema: editorSchema,
        _headless: true,
      })
      const blocks = yDocToBlocks(editor, doc)

      await ctx.runMutation(
        internal.notes.internalMutations.saveNoteBlocksInternal,
        { noteId: documentId, content: blocks },
      )
    } finally {
      doc.destroy()
      editor?._tiptapEditor.destroy()
    }
  },
})
