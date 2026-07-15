import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId, generateUuidV7 } from '../../resources/domain-id'
import { noteDocumentOutline } from '../document/outline'
import type { NoteBlock } from '../document/model'

describe('note document outline', () => {
  it('projects nested headings from canonical block identities and content', () => {
    const firstId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const nestedId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const valueId = generateUuidV7()
    const blocks: Array<NoteBlock> = [
      {
        id: firstId,
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Arrival' }],
        children: [
          {
            id: nestedId,
            type: 'heading',
            props: { level: 3 },
            content: [
              { type: 'text', text: 'Armor: ' },
              { type: 'value', props: { valueId, label: 'Class', expressionSource: '16' } },
            ],
          },
        ],
      },
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Not in the outline' }],
      },
    ]

    expect(noteDocumentOutline(blocks)).toEqual([
      { blockId: firstId, level: 1, text: 'Arrival' },
      { blockId: nestedId, level: 3, text: 'Armor: Class' },
    ])
  })

  it('gives empty headings an explicit label', () => {
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    expect(
      noteDocumentOutline([{ id: blockId, type: 'heading', props: { level: 2 }, content: [] }]),
    ).toEqual([{ blockId, level: 2, text: 'Untitled heading' }])
  })
})
