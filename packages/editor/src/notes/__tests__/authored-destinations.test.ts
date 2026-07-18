import { describe, expect, it } from 'vite-plus/test'
import {
  noteAuthoredDestinations,
  remapNoteAuthoredDestinations,
} from '../document/authored-destinations'
import {
  parseSerializedAuthoredDestination,
  serializeAuthoredDestination,
} from '../../resources/authored-destination'
import type { AuthoredDestination } from '../../resources/authored-destination-contract'
import { parseSafeHttpsUrl } from '../../resources/authored-destination-contract'
import type { NoteBlock } from '../document/model'
import { testDomainId } from '../../test/domain-id'

describe('note authored destinations', () => {
  it('extracts embeds and inline links from the full note tree', () => {
    const resourceId = testDomainId('resource', 'note-link-target')
    const url = parseSafeHttpsUrl('https://example.com/reference')
    if (!url) throw new Error('Expected a safe test URL')
    const external = { kind: 'externalUrl', url } as const
    const blocks = [
      paragraph([
        {
          type: 'resourceLink',
          props: {
            destination: serializeAuthoredDestination({
              kind: 'internal',
              target: { kind: 'resource', resourceId },
            }),
            label: 'Reference',
          },
        },
      ]),
      {
        id: testDomainId('noteBlock', 'nested-parent'),
        type: 'paragraph',
        props: {},
        children: [
          {
            id: testDomainId('noteBlock', 'nested-embed'),
            type: 'embed',
            props: { destination: serializeAuthoredDestination(external) },
          },
        ],
      },
    ] satisfies ReadonlyArray<NoteBlock>

    expect(noteAuthoredDestinations(blocks)).toEqual([
      { kind: 'internal', target: { kind: 'resource', resourceId } },
      external,
    ])
  })

  it('remaps every internal note destination once and preserves presentation data', () => {
    const sourceResourceId = testDomainId('resource', 'source-link-target')
    const copiedResourceId = testDomainId('resource', 'copied-link-target')
    const sourceBlockId = testDomainId('noteBlock', 'source-heading-target')
    const copiedBlockId = testDomainId('noteBlock', 'copied-heading-target')
    const blocks = [
      paragraph([
        resourceLink({
          kind: 'internal',
          target: {
            kind: 'noteBlock',
            resourceId: sourceResourceId,
            blockId: sourceBlockId,
            presentation: 'heading',
          },
        }),
      ]),
      {
        id: testDomainId('noteBlock', 'remapped-embed'),
        type: 'embed',
        props: {
          destination: serializeAuthoredDestination({
            kind: 'internal',
            target: { kind: 'resource', resourceId: sourceResourceId },
          }),
          previewWidth: 480,
        },
      },
    ] satisfies ReadonlyArray<NoteBlock>
    const targetMap = [
      {
        source: {
          kind: 'noteBlock',
          resourceId: sourceResourceId,
          blockId: sourceBlockId,
          presentation: 'heading',
        },
        destination: {
          kind: 'noteBlock',
          resourceId: copiedResourceId,
          blockId: copiedBlockId,
          presentation: 'heading',
        },
      },
      {
        source: { kind: 'resource', resourceId: sourceResourceId },
        destination: { kind: 'resource', resourceId: copiedResourceId },
      },
    ] as const

    const result = remapNoteAuthoredDestinations(blocks, targetMap, 'new_campaign_clone')

    expect(result.status).toBe('completed')
    if (result.status !== 'completed') return
    const linkBlock = result.blocks[0]
    expect(linkBlock?.type).toBe('paragraph')
    if (linkBlock?.type !== 'paragraph') return
    const inline = linkBlock.content?.[0]
    expect(inline?.type).toBe('resourceLink')
    if (inline?.type !== 'resourceLink') return
    expect(parseSerializedAuthoredDestination(inline.props.destination)).toEqual({
      kind: 'internal',
      target: {
        kind: 'noteBlock',
        resourceId: copiedResourceId,
        blockId: copiedBlockId,
        presentation: 'heading',
      },
    })
    expect(inline.props.label).toBe('Reference')
    const embed = result.blocks[1]
    expect(embed?.type).toBe('embed')
    if (embed?.type !== 'embed') return
    expect(parseSerializedAuthoredDestination(embed.props.destination)).toEqual({
      kind: 'internal',
      target: { kind: 'resource', resourceId: copiedResourceId },
    })
    expect(embed.props.previewWidth).toBe(480)
  })

  it('reports an unmapped clone target without rewriting a partial document', () => {
    const resourceId = testDomainId('resource', 'unmapped-link-target')
    const blocks = [
      paragraph([
        resourceLink({
          kind: 'internal',
          target: { kind: 'resource', resourceId },
        }),
      ]),
    ]

    expect(remapNoteAuthoredDestinations(blocks, [], 'new_campaign_clone')).toEqual({
      status: 'unmapped',
      target: { kind: 'resource', resourceId },
    })
  })
})

function paragraph(
  content: Extract<NoteBlock, { type: 'paragraph' }>['content'],
): Extract<NoteBlock, { type: 'paragraph' }> {
  return {
    id: testDomainId('noteBlock', `paragraph-${JSON.stringify(content)}`),
    type: 'paragraph',
    props: {},
    content,
  }
}

function resourceLink(destination: AuthoredDestination) {
  return {
    type: 'resourceLink' as const,
    props: { destination: serializeAuthoredDestination(destination), label: 'Reference' },
  }
}
