import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId, generateUuidV7 } from '../../resources/domain-id'
import type { UuidV7 } from '../../resources/domain-id'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc, noteYDocToBlocks } from '../document/headless-yjs'

describe('canonical note document', () => {
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
})
