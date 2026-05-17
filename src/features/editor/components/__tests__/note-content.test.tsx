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

vi.mock('@blocknote/core', () => ({
  BlockNoteEditor: {
    create: vi.fn((options?: { initialContent?: Array<CustomBlock> }) => ({
      document: options?.initialContent ?? [],
      replaceBlocks: vi.fn(),
      _tiptapEditor: { destroy: vi.fn(), view: {} },
    })),
  },
}))

vi.mock('convex/notes/editorSpecs', () => ({
  editorSchema: {},
}))

vi.mock('../note-view', () => ({
  NoteView: (props: { editor: { document: Array<CustomBlock> } }) => {
    noteViewSpy(props)
    return <div data-testid="note-view" />
  },
}))

vi.mock('~/features/editor/hooks/useOwnedBlockNoteEditor', () => ({
  useOwnedBlockNoteEditor: ({ createEditor }: { createEditor: () => unknown }) => createEditor(),
}))

vi.mock('~/features/editor/hooks/useLinkResolver', () => ({
  useLinkResolver: () => vi.fn(),
}))

vi.mock('~/features/editor/hooks/useNoteYjsCollaboration', () => ({
  useNoteYjsCollaboration: () => ({
    doc: null,
    provider: null,
    instanceId: 'test-instance',
    isLoading: true,
  }),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({ data: null }),
}))

vi.mock('../extensions/link-click-handler', () => ({
  LinkClickHandler: () => null,
}))

vi.mock('../extensions/wiki-link/wiki-link-autocomplete', () => ({
  WikiLinkAutocomplete: () => null,
}))

vi.mock('~/features/editor/utils/destroy-blocknote-editor', () => ({
  destroyBlockNoteEditor: vi.fn(),
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
