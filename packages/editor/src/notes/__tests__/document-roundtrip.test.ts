import { describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import {
  DOMAIN_ID_KIND,
  generateDomainId,
  generateUuidV7,
  isUuidV7,
} from '../../resources/domain-id'
import type { UuidV7 } from '../../resources/domain-id'
import {
  NOTE_YJS_FRAGMENT,
  canonicalizeNoteYjsDocument,
  noteBlocksToYDoc,
  noteYDocToBlocks,
} from '../document/headless-yjs'

describe('canonical note document', () => {
  it('allocates canonical identities for every partial block and rejects empty documents', () => {
    const document = noteBlocksToYDoc(
      [
        {
          type: 'paragraph',
          children: [{ type: 'paragraph' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )

    const [block] = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
    expect(isUuidV7(block?.id ?? '')).toBe(true)
    expect(isUuidV7(block?.children?.[0]?.id ?? '')).toBe(true)
    expect(() => noteBlocksToYDoc([], NOTE_YJS_FRAGMENT)).toThrow(
      'requires an array of note blocks',
    )
  })

  it('round-trips mixed formatted blocks, nesting, tables, and values with stable block IDs', () => {
    const ids = Array.from({ length: 8 }, () => generateDomainId(DOMAIN_ID_KIND.noteBlock))
    const valueId = generateUuidV7()
    const document = noteBlocksToYDoc(
      [
        {
          id: ids[0],
          type: 'heading',
          props: { level: 2 },
          content: [
            {
              type: 'text',
              text: 'Styled',
              styles: { bold: true, italic: true, textColor: 'red' },
            },
          ],
        },
        {
          id: ids[1],
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'Parent' }],
          children: [
            {
              id: ids[2],
              type: 'checkListItem',
              props: { checked: true },
              content: [{ type: 'text', text: 'Child' }],
            },
          ],
        },
        {
          id: ids[3],
          type: 'quote',
          content: [{ type: 'value', props: { valueId, label: 'Armor', expressionSource: '12' } }],
        },
        {
          id: ids[4],
          type: 'codeBlock',
          props: { language: 'typescript' },
          content: [{ type: 'text', text: 'const armor = 12' }],
        },
        { id: ids[5], type: 'divider' },
        {
          id: ids[6],
          type: 'table',
          content: {
            type: 'tableContent',
            columnWidths: [120, 160],
            rows: [
              {
                cells: [
                  { type: 'tableCell', content: [{ type: 'text', text: 'Name' }] },
                  { type: 'tableCell', content: [{ type: 'text', text: 'Value' }] },
                ],
              },
            ],
          },
        },
        {
          id: ids[7],
          type: 'toggleListItem',
          content: [{ type: 'text', text: 'Details' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )

    const decoded = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
    expect(decoded.map((block) => block.id)).toEqual(ids.filter((_, index) => index !== 2))
    expect(decoded[1]?.children?.[0]?.id).toBe(ids[2])
    expect(decoded.map((block) => block.type)).toEqual([
      'heading',
      'bulletListItem',
      'quote',
      'codeBlock',
      'divider',
      'table',
      'toggleListItem',
    ])
    expect(decoded[0]?.content).toEqual([
      { type: 'text', text: 'Styled', styles: { bold: true, italic: true, textColor: 'red' } },
    ])
    expect(decoded[2]?.content).toEqual([
      { type: 'value', props: { valueId, label: 'Armor', expressionSource: '12' } },
    ])
  })

  it('rejects legacy value identities instead of decoding a compatibility shape', () => {
    expect(() =>
      noteBlocksToYDoc(
        [
          {
            id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
            type: 'paragraph',
            content: [
              {
                type: 'value',
                props: {
                  valueId: 'legacy-value' as UuidV7,
                  label: 'Legacy',
                  expressionSource: '1',
                },
              },
            ],
          },
        ],
        NOTE_YJS_FRAGMENT,
      ),
    ).toThrow('requires an array of note blocks')
  })

  it('rejects duplicate block and note-local value identities across the full tree', () => {
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    expect(() =>
      noteBlocksToYDoc(
        [
          { id: blockId, type: 'paragraph' },
          { id: blockId, type: 'paragraph' },
        ],
        NOTE_YJS_FRAGMENT,
      ),
    ).toThrow('Duplicate note block identity')
    expect(() =>
      noteBlocksToYDoc(
        [
          {
            id: blockId,
            type: 'paragraph',
            children: [{ id: blockId, type: 'paragraph' }],
          },
        ],
        NOTE_YJS_FRAGMENT,
      ),
    ).toThrow('Duplicate note block identity')

    const valueId = generateUuidV7()
    expect(() =>
      noteBlocksToYDoc(
        [
          {
            type: 'paragraph',
            content: [{ type: 'value', props: { valueId, label: 'First', expressionSource: '1' } }],
            children: [
              {
                type: 'paragraph',
                content: [
                  { type: 'value', props: { valueId, label: 'Second', expressionSource: '2' } },
                ],
              },
            ],
          },
        ],
        NOTE_YJS_FRAGMENT,
      ),
    ).toThrow('Duplicate note value identity')
    expect(() =>
      noteBlocksToYDoc(
        [
          {
            type: 'paragraph',
            content: [{ type: 'value', props: { valueId, label: 'First', expressionSource: '1' } }],
          },
          {
            type: 'table',
            content: {
              type: 'tableContent',
              columnWidths: [100],
              rows: [
                {
                  cells: [
                    {
                      type: 'tableCell',
                      content: [
                        {
                          type: 'value',
                          props: { valueId, label: 'Second', expressionSource: '2' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
        NOTE_YJS_FRAGMENT,
      ),
    ).toThrow('Duplicate note value identity')
  })

  it('canonicalizes a duplicated block identity in the Yjs fragment', () => {
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const document = noteBlocksToYDoc(
      [{ id: blockId, type: 'paragraph', content: [{ type: 'text', text: 'First' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const blockGroup = document.getXmlFragment(NOTE_YJS_FRAGMENT).get(0)
    if (!(blockGroup instanceof Y.XmlElement)) throw new Error('Expected block group')
    const blockContainer = blockGroup.get(0)
    if (!(blockContainer instanceof Y.XmlElement)) throw new Error('Expected block container')
    blockGroup.insert(1, [blockContainer.clone()])

    const blocks = canonicalizeNoteYjsDocument(document, NOTE_YJS_FRAGMENT)

    expect(blocks).toHaveLength(2)
    expect(blocks?.some((block) => block.id === blockId)).toBe(true)
    expect(new Set(blocks?.map((block) => block.id)).size).toBe(2)
    expect(blocks?.every((block) => isUuidV7(block.id))).toBe(true)
    expect(noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)).toEqual(blocks)
    document.destroy()
  })
})
