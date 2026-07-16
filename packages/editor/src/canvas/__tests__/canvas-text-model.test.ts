import { describe, expect, it } from 'vite-plus/test'
import {
  createCanvasTextDocument,
  duplicateCanvasTextDocument,
  parseCanvasTextDocument,
} from '../text/model'
import type { CanvasTextDocument } from '../text/model'
import { generateUuidV7, isUuidV7 } from '../../resources/domain-id'

describe('canvas text document', () => {
  it('creates canonical UUIDv7 block identity and derives plain text from rich content', () => {
    const content = createCanvasTextDocument('Wizards')

    expect(isUuidV7(content[0]?.id ?? '')).toBe(true)
    expect(parseCanvasTextDocument(content)).toEqual(content)
    expect(content[0]?.content).toEqual([{ type: 'text', text: 'Wizards' }])
  })

  it('accepts supported nested rich content and rejects invalid or duplicate identities', () => {
    const sharedId = generateUuidV7()
    const childId = generateUuidV7()
    const richContent: CanvasTextDocument = [
      {
        id: sharedId,
        type: 'heading',
        props: { level: 2, textAlignment: 'center' },
        content: [{ type: 'text', text: 'Harbor', styles: { bold: true, textColor: '#ef4444' } }],
        children: [
          {
            id: childId,
            type: 'checkListItem',
            props: { checked: true },
            content: [{ type: 'text', text: 'Secure the docks' }],
          },
        ],
      },
    ]

    expect(parseCanvasTextDocument(richContent)).toEqual(richContent)
    expect(parseCanvasTextDocument([{ ...richContent[0], id: 'legacy-block' }])).toBeNull()
    expect(
      parseCanvasTextDocument([
        richContent[0],
        { id: sharedId, type: 'paragraph', content: [{ type: 'text', text: 'Duplicate' }] },
      ]),
    ).toBeNull()
  })

  it('duplicates every nested block with fresh identities without changing content', () => {
    const source = createCanvasTextDocument('Parent')
    source[0]!.children = [createCanvasTextDocument('Child')[0]!]

    const duplicate = duplicateCanvasTextDocument(source)

    expect(duplicate[0]?.content).toEqual(source[0]?.content)
    expect(duplicate[0]?.children?.[0]?.content).toEqual(source[0]?.children?.[0]?.content)
    expect(duplicate[0]?.id).not.toBe(source[0]?.id)
    expect(duplicate[0]?.children?.[0]?.id).not.toBe(source[0]?.children?.[0]?.id)
    expect(parseCanvasTextDocument(duplicate)).toEqual(duplicate)
  })

  it.each(['toggleListItem', 'divider', 'embed', 'table'])(
    'rejects note-only %s blocks',
    (type) => {
      expect(parseCanvasTextDocument([{ id: generateUuidV7(), type, props: {} }])).toBeNull()
    },
  )

  it('rejects note-only inline values', () => {
    expect(
      parseCanvasTextDocument([
        {
          id: generateUuidV7(),
          type: 'paragraph',
          content: [
            {
              type: 'value',
              props: { valueId: generateUuidV7(), label: 'Value', expressionSource: '0' },
            },
          ],
        },
      ]),
    ).toBeNull()
  })
})
