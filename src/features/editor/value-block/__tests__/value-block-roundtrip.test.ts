import { describe, expect, it } from 'vitest'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc as bnBlocksToYDoc } from '@blocknote/core/yjs'
import { createEditorSchema } from '../../editor-specs'
import { yDocToBlocks } from '~/features/editor/blocknote-yjs'
import type { CustomPartialBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'

function createTestEditor(initialContent: Array<CustomPartialBlock>): CustomBlockNoteEditor {
  return BlockNoteEditor.create({
    schema: createEditorSchema(),
    initialContent: initialContent as NonNullable<
      Parameters<typeof BlockNoteEditor.create>[0]
    >['initialContent'],
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
