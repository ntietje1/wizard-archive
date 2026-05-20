import { describe, expect, it } from 'vitest'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc as bnBlocksToYDoc } from '@blocknote/core/yjs'
import { createEditorSchema } from '../../editorSchema'
import { yDocToBlocks } from 'convex/notes/blocknote'
import type { CustomBlockNoteEditor, CustomPartialBlock } from 'convex/notes/editorSpecs'

function createTestEditor(initialContent: Array<CustomPartialBlock>): CustomBlockNoteEditor {
  return BlockNoteEditor.create({
    schema: createEditorSchema(),
    initialContent,
  }) as CustomBlockNoteEditor
}

describe('inline value schema round-trip', () => {
  it('round-trips inline values from the frontend schema into the backend schema', () => {
    const editor = createTestEditor([
      {
        id: 'paragraph-block-1',
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bonus ', styles: {} },
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'prof_bonus',
              expressionSource: '3',
            },
          },
        ] as never,
      },
    ])

    const doc = bnBlocksToYDoc(editor, editor.document, 'document')

    try {
      const blocks = yDocToBlocks(doc, 'document')
      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toMatchObject({
        id: 'paragraph-block-1',
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bonus ' },
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'prof_bonus',
              expressionSource: '3',
            },
          },
        ],
      })
    } finally {
      editor._tiptapEditor.destroy()
      doc.destroy()
    }
  })
})
