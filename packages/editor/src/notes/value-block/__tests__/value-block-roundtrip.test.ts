import { describe, expect, it } from 'vite-plus/test'
import { BlockNoteEditor, BlockNoteSchema } from '@blocknote/core'
import { blocksToYDoc as bnBlocksToYDoc } from '@blocknote/core/yjs'
import { customBlockSpecs } from '../../document/schema-factory'
import { noteInlineContentSpecs, noteStyleSpecs } from '../../dom-specs'
import { reactValueInlineSpec } from '../value-block-react-spec'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../../document/headless-yjs'
import type { PartialNoteBlock } from '../../document/model'
import type { CustomBlockNoteEditor } from '../../editor-schema'

const { value: _value, ...inlineContentSpecsWithoutValue } = noteInlineContentSpecs

function createValueBlockTestSchema() {
  return BlockNoteSchema.create({
    blockSpecs: customBlockSpecs,
    inlineContentSpecs: {
      ...inlineContentSpecsWithoutValue,
      value: reactValueInlineSpec,
    },
    styleSpecs: noteStyleSpecs,
  })
}

function createTestEditor(initialContent: Array<PartialNoteBlock>): CustomBlockNoteEditor {
  return BlockNoteEditor.create({
    schema: createValueBlockTestSchema(),
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
      const blocks = noteYDocToBlocks(doc, NOTE_YJS_FRAGMENT)
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
