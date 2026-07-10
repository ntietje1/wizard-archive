import { blocksToYDoc as bnBlocksToYDoc } from '@blocknote/core/yjs'
import { describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import { testNoteBlockId } from '../../../test/blocknote-id'
import { noteBlocksToYDoc, decodeNoteYjsUpdatesToBlocks } from '../headless-yjs'
import { destroyHeadlessBlockNoteEditor } from '../headless-editor-cleanup'
import { createHeadlessBlockNoteEditor } from '../headless-editor'
import { headlessLegacyMediaDecodeNoteSchema } from '../legacy-media-migration'
import type { PartialNoteBlock } from '../model'

const FRAGMENT = 'document'

describe('decodeNoteYjsUpdatesToBlocks', () => {
  it('decodes editor Yjs updates into canonical note blocks', () => {
    const content: Array<PartialNoteBlock> = [
      {
        id: testNoteBlockId('intro'),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Decoded from Yjs.', styles: {} }],
      },
    ]
    const sourceDoc = noteBlocksToYDoc(content, FRAGMENT)
    const update = Y.encodeStateAsUpdate(sourceDoc)

    try {
      expect(decodeNoteYjsUpdatesToBlocks([{ update }], FRAGMENT)).toEqual([
        expect.objectContaining({
          id: testNoteBlockId('intro'),
          type: 'paragraph',
          content: [expect.objectContaining({ text: 'Decoded from Yjs.' })],
        }),
      ])
    } finally {
      sourceDoc.destroy()
    }
  })

  it('decodes legacy media Yjs updates into canonical embed blocks', () => {
    const [block] = decodeNoteYjsUpdatesToBlocks(
      [
        {
          update: makeLegacyMediaYjsUpdate([
            {
              id: testNoteBlockId('legacy-yjs-image'),
              type: 'image',
              props: {
                url: 'https://example.com/from-yjs.png',
                name: 'from-yjs.png',
              },
            },
          ]),
        },
      ],
      FRAGMENT,
    )

    expect(block).toMatchObject({
      id: testNoteBlockId('legacy-yjs-image'),
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/from-yjs.png',
        name: 'from-yjs.png',
      },
    })
  })
})

function makeLegacyMediaYjsUpdate(blocks: Array<Record<string, unknown>>): ArrayBuffer {
  const editor = createHeadlessBlockNoteEditor({
    schema: headlessLegacyMediaDecodeNoteSchema,
  })
  const doc = bnBlocksToYDoc(
    editor as unknown as Parameters<typeof bnBlocksToYDoc>[0],
    blocks as Parameters<typeof bnBlocksToYDoc>[1],
    FRAGMENT,
  )
  try {
    const update = Y.encodeStateAsUpdate(doc)
    const copy = new Uint8Array(update.byteLength)
    copy.set(update)
    return copy.buffer
  } finally {
    destroyHeadlessBlockNoteEditor(editor)
    doc.destroy()
  }
}
