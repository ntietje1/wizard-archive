import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SHARE_STATUS } from 'convex/blockShares/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { NoteContent } from '../note-content'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { NoteWithContent } from 'convex/notes/types'

const noteViewSpy = vi.hoisted(() => vi.fn())
const campaignState = vi.hoisted(() => ({
  isDm: false as boolean | undefined,
}))
const editorModeState = vi.hoisted(() => ({
  viewAsPlayerId: undefined as Id<'campaignMembers'> | undefined,
}))
const activeItemsState = vi.hoisted(() => ({
  itemsMap: new Map(),
}))

vi.mock('../blocknote-editor-instance', () => ({
  StaticBlockNoteEditor: (props: { content: Array<CustomBlock>; linkViewerMode: boolean }) => {
    noteViewSpy({
      surface: 'static',
      editor: { document: props.content },
      linkViewerMode: props.linkViewerMode,
    })
    return <div data-testid="static-note-editor" />
  },
  CollaborativeBlockNoteEditor: (props: { note?: NoteWithContent; linkViewerMode: boolean }) => {
    noteViewSpy({
      surface: 'collaborative',
      editor: { document: props.note?.content ?? [] },
      linkViewerMode: props.linkViewerMode,
    })
    return <div data-testid="collaborative-note-editor" />
  },
}))

vi.mock('~/features/editor/hooks/use-note-collaboration-session', () => ({
  useNoteCollaborationSession: () => ({
    doc: {},
    provider: {},
    instanceId: 1,
    isLoading: false,
    user: { name: 'Test User', color: '#61afef' },
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => editorModeState,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeItemsState,
}))

describe('NoteContent', () => {
  beforeEach(() => {
    noteViewSpy.mockReset()
    campaignState.isDm = false
    editorModeState.viewAsPlayerId = undefined
    activeItemsState.itemsMap = new Map()
  })

  it('filters live note blocks before rendering read-only content', async () => {
    const visibleBlock = createBlock('visible-block')
    const hiddenBlock = createBlock('hidden-block')
    const note = createNoteWithContent({
      content: [visibleBlock, hiddenBlock],
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      blockMeta: {
        [visibleBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
      },
    })

    render(<NoteContent note={note} editable={false} />)

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editor: expect.objectContaining({
            document: [visibleBlock],
          }),
        }),
      )
    })
  })

  it('renders every live note block when the note is editable', async () => {
    const visibleBlock = createBlock('visible-block')
    const hiddenBlock = createBlock('hidden-block')
    const note = createNoteWithContent({
      content: [visibleBlock, hiddenBlock],
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
      blockMeta: {
        [visibleBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
      },
    })

    render(<NoteContent note={note} editable />)

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editor: expect.objectContaining({
            document: [visibleBlock, hiddenBlock],
          }),
        }),
      )
    })
  })

  it('filters live note blocks using player visibility in DM view-as mode', async () => {
    const playerId = testId<'campaignMembers'>('player-1')
    const allSharedBlock = createBlock('all-shared-block')
    const playerSharedBlock = createBlock('player-shared-block')
    const otherPlayerBlock = createBlock('other-player-block')
    const missingMetaBlock = createBlock('missing-meta-block')
    campaignState.isDm = true
    editorModeState.viewAsPlayerId = playerId

    const note = createNoteWithContent({
      content: [allSharedBlock, playerSharedBlock, otherPlayerBlock, missingMetaBlock],
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
      blockMeta: {
        [allSharedBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
        [playerSharedBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
          sharedWith: [playerId],
        },
        [otherPlayerBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.NONE,
          shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
          sharedWith: [testId<'campaignMembers'>('player-2')],
        },
      },
    })

    render(<NoteContent note={note} editable={false} />)

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editor: expect.objectContaining({
            document: [allSharedBlock, playerSharedBlock],
          }),
        }),
      )
    })
  })

  it('keeps DM view-as static rendering in viewer link mode while collaboration stays warm', async () => {
    const playerId = testId<'campaignMembers'>('player-1')
    const visibleBlock = createBlock('visible-block')
    campaignState.isDm = true
    editorModeState.viewAsPlayerId = playerId

    const note = createNoteWithContent({
      content: [visibleBlock],
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      blockMeta: {
        [visibleBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
      },
    })
    activeItemsState.itemsMap = new Map([[note._id, note]])

    render(<NoteContent note={note} editable />)

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          surface: 'static',
          linkViewerMode: true,
          editor: expect.objectContaining({
            document: [visibleBlock],
          }),
        }),
      )
    })
  })
})

function createBlock(id: string): CustomBlock {
  return { id, type: 'paragraph', content: [] } as unknown as CustomBlock
}

function createNoteWithContent({
  content,
  myPermissionLevel,
  allPermissionLevel,
  blockMeta,
}: Pick<NoteWithContent, 'content' | 'myPermissionLevel' | 'blockMeta'> &
  Partial<Pick<NoteWithContent, 'allPermissionLevel'>>): NoteWithContent {
  return {
    ...createNote({
      _id: testId<'sidebarItems'>('note-1'),
      myPermissionLevel,
      allPermissionLevel,
    }),
    ancestors: [],
    content,
    blockMeta,
  }
}
