import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc } from '@blocknote/core/yjs'
import { migrateLegacyMediaBlocks } from '../functions/migrateLegacyMediaBlocks'
import { parseEditorBlocks } from '../parseEditorBlocks'
import { yjsUpdatesToBlocks } from '../../notes/blocknoteNode'
import { testBlockNoteId } from '../../_test/factories.helper'
import { headlessLegacyMediaDecodeEditorSchema } from '../../../shared/editor-blocks/editor-blocknote-schema'

describe('migrateLegacyMediaBlocks', () => {
  it('converts legacy image blocks to external URL embeds', () => {
    expect(
      migrateLegacyMediaBlocks([
        {
          id: testBlockNoteId('legacy-image'),
          type: 'image',
          props: {
            url: 'https://example.com/image.png',
            name: 'image.png',
            previewWidth: 320,
          },
        },
      ]),
    ).toEqual([
      {
        id: testBlockNoteId('legacy-image'),
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/image.png',
          name: 'image.png',
          previewWidth: 320,
        },
      },
    ])
  })

  it('preserves children recursively', () => {
    const result = migrateLegacyMediaBlocks([
      {
        id: testBlockNoteId('parent'),
        type: 'paragraph',
        props: {},
        children: [
          {
            id: testBlockNoteId('legacy-audio'),
            type: 'audio',
            props: { url: 'https://example.com/nested.mp3' },
          },
        ],
      },
    ])

    expect(result[0]?.children?.[0]?.type).toBe('embed')
  })

  it('normalizes legacy media before strict editor block parsing', () => {
    const [block] = parseEditorBlocks([
      {
        id: testBlockNoteId('legacy-video'),
        type: 'video',
        props: { url: 'https://example.com/movie.mp4' },
      },
    ])

    expect(block).toMatchObject({
      id: testBlockNoteId('legacy-video'),
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/movie.mp4',
      },
    })
  })

  it('decodes legacy media Yjs documents before migrating to canonical embeds', () => {
    const [block] = yjsUpdatesToBlocks([
      {
        update: makeLegacyMediaYjsUpdate([
          {
            id: testBlockNoteId('legacy-yjs-image'),
            type: 'image',
            props: {
              url: 'https://example.com/from-yjs.png',
              name: 'from-yjs.png',
            },
          },
        ]),
      },
    ])

    expect(block).toMatchObject({
      id: testBlockNoteId('legacy-yjs-image'),
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
  const editor = BlockNoteEditor.create({
    schema: headlessLegacyMediaDecodeEditorSchema,
    _headless: true,
  })
  const doc = blocksToYDoc(
    editor as unknown as Parameters<typeof blocksToYDoc>[0],
    blocks as Parameters<typeof blocksToYDoc>[1],
    'document',
  )
  try {
    const update = Y.encodeStateAsUpdate(doc)
    const copy = new Uint8Array(update.byteLength)
    copy.set(update)
    return copy.buffer
  } finally {
    editor._tiptapEditor?.destroy()
    doc.destroy()
  }
}
