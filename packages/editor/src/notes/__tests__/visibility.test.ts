import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { SHARE_STATUS } from '../../../../../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { getVisibleNoteBlocks } from '../visibility'

import { DOMAIN_ID_KIND } from '../../resources/domain-id'
import { testDomainId } from '../../test/domain-id'
import type { NoteBlock } from '../document/model'
import type { BlockMeta, NoteItemWithContent } from '../../notes/item-contract'

describe('note block visibility', () => {
  it('keeps only blocks the current reader can view outside view-as mode', () => {
    const note = createNote({
      visible: {
        myPermissionLevel: PERMISSION_LEVEL.VIEW,
        shareStatus: SHARE_STATUS.NOT_SHARED,
        sharedWith: [],
      },
      hidden: {
        myPermissionLevel: PERMISSION_LEVEL.NONE,
        shareStatus: SHARE_STATUS.ALL_SHARED,
        sharedWith: [],
      },
    })

    expect(
      getVisibleNoteBlocks(note, {
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.NONE,
        viewAsPlayerId: undefined,
      }).map((block) => block.id),
    ).toEqual(['visible'])
  })

  it('removes hidden descendants from otherwise visible blocks', () => {
    const note = createNote({
      parent: {
        myPermissionLevel: PERMISSION_LEVEL.VIEW,
        shareStatus: SHARE_STATUS.NOT_SHARED,
        sharedWith: [],
      },
      child: {
        myPermissionLevel: PERMISSION_LEVEL.NONE,
        shareStatus: SHARE_STATUS.NOT_SHARED,
        sharedWith: [],
      },
      sibling: {
        myPermissionLevel: PERMISSION_LEVEL.VIEW,
        shareStatus: SHARE_STATUS.NOT_SHARED,
        sharedWith: [],
      },
    })
    note.content = [
      {
        ...createBlock('parent'),
        children: [createBlock('child'), createBlock('sibling')],
      },
    ]

    expect(
      getVisibleNoteBlocks(note, {
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.NONE,
        viewAsPlayerId: undefined,
      }),
    ).toEqual([
      expect.objectContaining({
        id: 'parent',
        children: [expect.objectContaining({ id: 'sibling' })],
      }),
    ])
  })

  it('resolves player visibility from note permission and block share state in view-as mode', () => {
    const playerId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'visibility_player')
    const note = createNote({
      inherited: {
        myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
        shareStatus: SHARE_STATUS.ALL_SHARED,
        sharedWith: [],
      },
      direct: {
        myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
        shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
        sharedWith: [playerId],
      },
      denied: {
        myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
        shareStatus: SHARE_STATUS.ALL_SHARED,
        sharedWith: [],
        hiddenFrom: [playerId],
      },
    })

    expect(
      getVisibleNoteBlocks(note, {
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.VIEW,
        viewAsPlayerId: playerId,
      }).map((block) => block.id),
    ).toEqual(['inherited', 'direct'])
  })
})

function createNote(blockMeta: Record<string, BlockMeta>): NoteItemWithContent {
  const content = Object.keys(blockMeta).map(createBlock)
  return {
    id: 'note-1' as ResourceId,
    blockMeta,
    blockShareAccessWarnings: [],
    content,
    name: 'Test note',
    parentId: null,
    type: 'notes',
  } as unknown as NoteItemWithContent
}

function createBlock(id: string): NoteBlock {
  return {
    id,
    type: 'paragraph',
    content: [],
  } as unknown as NoteBlock
}
