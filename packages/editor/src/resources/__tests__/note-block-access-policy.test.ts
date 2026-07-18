import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../test/domain-id'
import { RESOURCE_PERMISSION } from '../resource-access-policy'
import {
  NOTE_BLOCK_VISIBILITY,
  noteBlockIsVisible,
  projectNoteBlockSelectionAccess,
} from '../note-block-access-policy'
import type { NoteBlockAccessPresentation } from '../note-block-access-policy'

const noteId = testDomainId('resource', 'block-access-note')
const firstBlockId = testDomainId('noteBlock', 'block-access-first')
const secondBlockId = testDomainId('noteBlock', 'block-access-second')
const viewerId = testDomainId('campaignMember', 'block-access-viewer')
const editorId = testDomainId('campaignMember', 'block-access-editor')

describe('note block access policy', () => {
  it('keeps note access as the outer gate and edit access as locked visible', () => {
    expect(
      noteBlockIsVisible(
        RESOURCE_PERMISSION.none,
        NOTE_BLOCK_VISIBILITY.visible,
        NOTE_BLOCK_VISIBILITY.visible,
      ),
    ).toBe(false)
    expect(noteBlockIsVisible(RESOURCE_PERMISSION.edit, NOTE_BLOCK_VISIBILITY.hidden)).toBe(true)
  })

  it('resolves explicit member visibility before the all-player default', () => {
    expect(
      noteBlockIsVisible(
        RESOURCE_PERMISSION.view,
        NOTE_BLOCK_VISIBILITY.visible,
        NOTE_BLOCK_VISIBILITY.hidden,
      ),
    ).toBe(false)
    expect(
      noteBlockIsVisible(
        RESOURCE_PERMISSION.view,
        NOTE_BLOCK_VISIBILITY.hidden,
        NOTE_BLOCK_VISIBILITY.visible,
      ),
    ).toBe(true)
  })

  it('projects mixed selections and locks note editors without a parallel share model', () => {
    const selection = projectNoteBlockSelectionAccess(presentation(), [firstBlockId, secondBlockId])

    expect(selection).toEqual({
      audienceVisibility: 'mixed',
      participants: [
        {
          kind: 'controllable',
          participant: expect.objectContaining({ id: viewerId }),
          visibility: 'mixed',
          hasExplicitAccess: true,
        },
        {
          kind: 'locked_visible',
          participant: expect.objectContaining({ id: editorId }),
        },
      ],
    })
  })

  it('rejects incomplete selections instead of inventing fallback policy', () => {
    expect(
      projectNoteBlockSelectionAccess(presentation(), [
        firstBlockId,
        testDomainId('noteBlock', 'missing-block'),
      ]),
    ).toBeNull()
  })
})

function presentation(): NoteBlockAccessPresentation {
  return {
    noteId,
    blocks: [
      {
        blockId: firstBlockId,
        audienceVisibility: NOTE_BLOCK_VISIBILITY.hidden,
        memberAccess: [{ memberId: viewerId, visibility: NOTE_BLOCK_VISIBILITY.visible }],
      },
      {
        blockId: secondBlockId,
        audienceVisibility: NOTE_BLOCK_VISIBILITY.visible,
        memberAccess: [],
      },
    ],
    participants: [
      {
        id: viewerId,
        displayName: 'Viewer',
        username: 'viewer',
        imageUrl: null,
        notePermission: RESOURCE_PERMISSION.view,
      },
      {
        id: editorId,
        displayName: 'Editor',
        username: 'editor',
        imageUrl: null,
        notePermission: RESOURCE_PERMISSION.edit,
      },
    ],
    participantsComplete: true,
  }
}
