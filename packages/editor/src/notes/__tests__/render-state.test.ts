import { describe, expect, it } from 'vite-plus/test'
import { SHARE_STATUS } from '../../../../../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { getNoteRenderState } from '../render-state'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { DOMAIN_ID_KIND } from '../../resources/domain-id'
import { testDomainId } from '../../test/domain-id'
import type { NoteBlock } from '../document/model'
import type { BlockMeta, NoteItemWithContent } from '../../notes/item-contract'

describe('note render state', () => {
  it('renders an editable note when editing is requested and the current user can edit', () => {
    const note = createNote({
      visible: blockMeta(PERMISSION_LEVEL.EDIT),
    })

    expect(
      getNoteRenderState({
        editable: true,
        note,
        canAccessItem: () => true,
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.NONE,
        viewAsPlayerId: undefined,
      }),
    ).toEqual({ kind: 'editable', note })
  })

  it('renders full static content when editing is not requested but full content is available', () => {
    const note = createNote({
      visible: blockMeta(PERMISSION_LEVEL.EDIT),
      localOnly: blockMeta(PERMISSION_LEVEL.NONE),
    })

    expect(
      getNoteRenderState({
        editable: false,
        note,
        canAccessItem: () => true,
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.NONE,
        viewAsPlayerId: undefined,
      }),
    ).toEqual({
      kind: 'static',
      note,
      noteId: note.id,
      content: note.content,
      evaluateValuesFromEditor: true,
    })
  })

  it('filters static content for view-as players even when the current user can edit', () => {
    const playerId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'render_state_player')
    const note = createNote({
      allPlayers: blockMeta(PERMISSION_LEVEL.EDIT, {
        shareStatus: SHARE_STATUS.ALL_SHARED,
      }),
      hidden: blockMeta(PERMISSION_LEVEL.EDIT, {
        hiddenFrom: [playerId],
        shareStatus: SHARE_STATUS.ALL_SHARED,
      }),
    })

    expect(
      getNoteRenderState({
        editable: true,
        note,
        canAccessItem: () => true,
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.VIEW,
        viewAsPlayerId: playerId,
      }),
    ).toEqual({
      kind: 'static',
      note,
      noteId: note.id,
      content: [note.content[0]],
      evaluateValuesFromEditor: false,
    })
  })

  it('renders static content when editing is requested but the current user cannot edit', () => {
    const note = createNote({
      visible: blockMeta(PERMISSION_LEVEL.VIEW),
    })

    expect(
      getNoteRenderState({
        editable: true,
        note,
        canAccessItem: (_note, requiredLevel) => requiredLevel !== PERMISSION_LEVEL.EDIT,
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.NONE,
        viewAsPlayerId: undefined,
      }),
    ).toEqual({
      kind: 'static',
      note,
      noteId: note.id,
      content: note.content,
      evaluateValuesFromEditor: false,
    })
  })
})

function createNote(blockMetaById: Record<string, BlockMeta>): NoteItemWithContent {
  const content = Object.keys(blockMetaById).map(createBlock)
  return {
    id: 'note-1' as SidebarItemId,
    blockMeta: blockMetaById,
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

function blockMeta(
  myPermissionLevel: BlockMeta['myPermissionLevel'],
  overrides: Partial<BlockMeta> = {},
): BlockMeta {
  return {
    myPermissionLevel,
    shareStatus: SHARE_STATUS.NOT_SHARED,
    sharedWith: [],
    ...overrides,
  }
}
