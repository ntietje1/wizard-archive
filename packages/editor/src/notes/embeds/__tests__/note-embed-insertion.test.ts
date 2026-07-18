import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import {
  EMPTY_AUTHORED_DESTINATION_SERIALIZED,
  parseSerializedAuthoredDestination,
} from '../../../resources/authored-destination'
import { DOMAIN_ID_KIND, generateDomainId } from '../../../resources/domain-id'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc, noteYDocToBlocks } from '../../document/headless-yjs'
import { settleNoteEmbedResourceCreation } from '../note-embed-insertion'

describe('note embed creation insertion', () => {
  it('settles a created resource into exactly the intended empty embed', () => {
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const document = noteBlocksToYDoc(
      [
        {
          id: blockId,
          type: 'embed',
          props: {
            destination: EMPTY_AUTHORED_DESTINATION_SERIALIZED,
            previewWidth: 480,
          },
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Retained text' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )

    settleNoteEmbedResourceCreation(
      { status: 'completed', resourceId },
      {
        blockId,
        canReplaceTarget: () => true,
        currentDocument: () => document,
        document,
        report: vi.fn(),
      },
    )

    const blocks = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
    expect(blocks).toHaveLength(2)
    expect(
      blocks[0]?.type === 'embed'
        ? parseSerializedAuthoredDestination(blocks[0].props.destination)
        : null,
    ).toEqual({
      kind: 'internal',
      target: { kind: 'resource', resourceId },
    })
  })

  it('replays one deterministic recovery insertion after the target disappears', () => {
    const missingBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const document = noteBlocksToYDoc(
      [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Retained text' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const report = vi.fn()

    settleNoteEmbedResourceCreation(
      { status: 'completed', resourceId },
      {
        blockId: missingBlockId,
        canReplaceTarget: () => true,
        currentDocument: () => document,
        document,
        report,
      },
    )

    expect(report).toHaveBeenCalledWith('Resource created, insertion failed', expect.any(Function))
    const retry = report.mock.calls.at(-1)?.[1]
    if (!retry) throw new Error('Expected an insertion retry')
    retry()
    retry()

    const recovered = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT).filter(
      (block) =>
        block.type === 'embed' &&
        parseSerializedAuthoredDestination(block.props.destination)?.kind === 'internal',
    )
    expect(recovered).toHaveLength(1)
    expect(report).toHaveBeenLastCalledWith('Resource inserted')
  })

  it('retains a safe retry when the note document rejects insertion', () => {
    const report = vi.fn()
    const document = new Y.Doc()

    settleNoteEmbedResourceCreation(
      {
        status: 'completed',
        resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
      },
      {
        blockId: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        canReplaceTarget: () => true,
        currentDocument: () => document,
        document,
        report,
      },
    )

    expect(report).toHaveBeenLastCalledWith(
      'Resource created, insertion failed',
      expect.any(Function),
    )
    const retry = report.mock.calls.at(-1)?.[1]
    if (!retry) throw new Error('Expected an insertion retry')
    retry()

    expect(report).toHaveBeenLastCalledWith(
      'Resource created, insertion failed',
      expect.any(Function),
    )
  })
})
