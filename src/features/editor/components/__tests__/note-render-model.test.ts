import { describe, expect, it } from 'vitest'
import { SHARE_STATUS } from 'convex/blockShares/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { resolveNoteRenderModel } from '../note-render-model'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { NoteWithContent } from 'convex/notes/types'

describe('resolveNoteRenderModel', () => {
  it('keeps the collaborative session warm while DM view-as renders a read-only projection', () => {
    const playerId = testId<'campaignMembers'>('player-1')
    const visible = createBlock('visible')
    const hidden = createBlock('hidden')
    const note = createNoteWithContent({
      content: [visible, hidden],
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      blockMeta: {
        [visible.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
        [hidden.id]: {
          myPermissionLevel: PERMISSION_LEVEL.NONE,
          shareStatus: SHARE_STATUS.NOT_SHARED,
          sharedWith: [],
        },
      },
    })

    const model = resolveNoteRenderModel({
      source: { kind: 'live', note },
      requestedEditable: true,
      isDm: true,
      viewAsPlayerId: playerId,
      allItemsMap: new Map([[note._id, note]]),
    })

    expect(model.source).toBe('live')
    expect(model.renderMode).toBe('static-with-collaboration')
    expect(model.content).toEqual([visible])
  })

  it('uses collaborative rendering when the current user can edit and is not in view-as mode', () => {
    const block = createBlock('editable')
    const note = createNoteWithContent({
      content: [block],
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
      blockMeta: {},
    })

    const model = resolveNoteRenderModel({
      source: { kind: 'live', note },
      requestedEditable: true,
      isDm: false,
      viewAsPlayerId: undefined,
      allItemsMap: new Map([[note._id, note]]),
    })

    expect(model.source).toBe('live')
    expect(model.renderMode).toBe('collaborative')
    expect(model.content).toEqual([block])
  })

  it('never opens a collaboration session for raw historical content', () => {
    const block = createBlock('snapshot')

    const model = resolveNoteRenderModel({
      source: { kind: 'raw', noteId: undefined, content: [block] },
      requestedEditable: false,
      isDm: true,
      viewAsPlayerId: undefined,
      allItemsMap: new Map(),
    })

    expect(model.source).toBe('raw')
    expect(model.renderMode).toBe('static')
    expect(model.content).toEqual([block])
  })
})

function createBlock(id: string): CustomBlock {
  return { id, type: 'paragraph', content: [] } as unknown as CustomBlock
}

function createNoteWithContent({
  content,
  myPermissionLevel,
  blockMeta,
}: Pick<NoteWithContent, 'content' | 'myPermissionLevel' | 'blockMeta'>): NoteWithContent {
  return {
    ...createNote({
      _id: testId<'sidebarItems'>('note-1'),
      myPermissionLevel,
    }),
    ancestors: [],
    content,
    blockMeta,
  }
}
