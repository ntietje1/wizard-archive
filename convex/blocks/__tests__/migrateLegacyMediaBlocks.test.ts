import { describe, expect, it } from 'vitest'
import { migrateLegacyMediaBlocks } from '@wizard-archive/editor/notes/document-contract'
import { parseBlockNoteBlocks } from '../parseBlockNoteBlocks'
import { testBlockNoteId } from '../../_test/factories.helper'

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
            previewHeight: 180,
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

  it('strips obsolete embed content and preview height during parsing', () => {
    const [block] = parseBlockNoteBlocks([
      {
        id: testBlockNoteId('legacy-embed-shape'),
        type: 'embed',
        content: [{ type: 'text', text: 'legacy caption', styles: {} }],
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/image.png',
          previewWidth: 320,
          previewHeight: 180,
        },
      },
    ])

    expect(block).toEqual({
      id: testBlockNoteId('legacy-embed-shape'),
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/image.png',
        previewWidth: 320,
      },
    })
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
    const [block] = parseBlockNoteBlocks([
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
})
