import { testResourceId } from '../../../../../../shared/test/resource-id'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { RIGHT_SIDEBAR_CONTENT } from '../content'
import { createRuntimeRightSidebarSource } from '../runtime-source'
import { createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { testId } from '../../../test/id'
import { testHistoryEntryId } from '../../../test/history-entry-id'
import { createAvailableSearch } from './test-helpers'
import { RightSidebarContainer } from '../container'
import { RightSidebarPanel } from '../panels'
import type { ResourceHistory } from '../../../filesystem/history-types'
import type { EditHistoryEntry } from '../../../filesystem/history-contract'
import { SHARE_STATUS } from '../../../../../../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import type { BlockMeta, NoteItemWithContent } from '../../../notes/item-contract'
import type { NoteBlock } from '../../../notes/document/model'
import type { NoteBlockId } from '../../../resources/domain-id'
import { DOMAIN_ID_KIND } from '../../../resources/domain-id'
import { testDomainId } from '../../../test/domain-id'

class IntersectionObserverStub {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('right-sidebar panel source', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves unsupported search reasons for item link panels', () => {
    const source = createRuntimeRightSidebarSource(
      createTestWorkspaceRuntime({
        search: {
          status: 'unsupported',
          reason: 'not_implemented',
        },
      }),
      { navigateToHeading: vi.fn() },
    )

    expect(source.itemLinks).toEqual({ status: 'unsupported', reason: 'not_implemented' })
  })

  it('builds panels from right-sidebar filesystem facets', () => {
    const note = createNote()
    const getItemLinks = vi.fn(() => ({
      status: 'success' as const,
      links: [
        {
          id: 'link-1',
          query: 'Target Note',
          displayName: null,
          item: { id: testResourceId('target-id'), name: 'Target Note' },
        },
      ],
    }))
    const source = createRuntimeRightSidebarSource(
      {
        navigation: { openItem: vi.fn() },
        filesystem: {
          catalog: {
            getKnownItemById: () => note,
          },
          current: {
            item: note,
            contentItem: null,
            availabilityState: {
              status: 'not_found',
              label: note.name,
              message: 'Page not found.',
            },
          },
          history: { status: 'unsupported', reason: 'not_implemented' },
          permissions: {
            canAccessItem: () => true,
            getMemberItemPermissionLevel: () => PERMISSION_LEVEL.NONE,
          },
          search: {
            status: 'available',
            itemLinks: { status: 'available', getItemLinks },
          },
          resourceContent: {
            status: 'available',
            ensureContentState: vi.fn(),
            getContentState: () => ({
              status: 'not_found',
              label: note.name,
              item: undefined,
              folderChildren: [],
              isLoading: false,
              error: null,
            }),
            resolveItem: () => null,
          },
          sharing: {
            viewAsParticipant: { status: 'unsupported', reason: 'not_available' },
          },
        },
      },
      { navigateToHeading: vi.fn() },
    )

    render(
      <RightSidebarPanel
        contentId={RIGHT_SIDEBAR_CONTENT.backlinks}
        itemId={note.id}
        source={source}
      />,
    )

    expect(screen.getByRole('button', { name: /Target Note/ })).toBeInTheDocument()
    expect(getItemLinks).toHaveBeenCalledWith({ itemId: note.id, kind: 'backlinks' })
  })

  it('maps current item availability reasons into outline state', () => {
    const note = createNote()
    const source = createRuntimeRightSidebarSource(
      createTestWorkspaceRuntime({
        item: note,
        availabilityState: {
          status: 'trashed',
          label: note.name,
          message: 'This item is in the trash.',
        },
      }),
      { navigateToHeading: vi.fn() },
    )

    expect(source.outline.getOutlineState(note.id)).toEqual({
      status: 'unavailable',
      availabilityState: {
        status: 'trashed',
        label: note.name,
        message: 'This item is in the trash.',
      },
    })
  })

  it('uses view-as note block visibility for current note outline headings', () => {
    const playerId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'outline_player')
    const note = createNoteWithHeadings({
      visible: blockMeta(PERMISSION_LEVEL.EDIT, {
        shareStatus: SHARE_STATUS.ALL_SHARED,
      }),
      hidden: blockMeta(PERMISSION_LEVEL.EDIT, {
        hiddenFrom: [playerId],
        shareStatus: SHARE_STATUS.ALL_SHARED,
      }),
    })
    const source = createRuntimeRightSidebarSource(
      createTestWorkspaceRuntime({
        item: note,
        viewAsParticipant: {
          status: 'available',
          isPending: false,
          participants: [],
          selectedParticipantId: playerId,
          setSelectedParticipantId: vi.fn(),
        },
      }),
      { navigateToHeading: vi.fn() },
    )

    expect(source.outline.getOutlineState(note.id)).toEqual({
      status: 'success',
      headings: [
        {
          level: 1,
          normalizedText: 'visible',
          noteBlockId: 'visible',
          text: 'Visible',
        },
      ],
    })
  })

  it('renders the active panel from injected data capabilities', () => {
    const note = createNote()
    const getItemLinks = vi.fn(() => ({
      status: 'success' as const,
      links: [
        {
          id: 'link-1',
          query: 'Target Note',
          displayName: null,
          item: { id: testResourceId('target-id'), name: 'Target Note' },
        },
      ],
    }))
    const source = createRuntimeRightSidebarSource(
      createTestWorkspaceRuntime({ search: createAvailableSearch({ getItemLinks }) }),
      { navigateToHeading: vi.fn() },
    )

    render(
      <RightSidebarPanel
        contentId={RIGHT_SIDEBAR_CONTENT.backlinks}
        itemId={note.id}
        source={source}
      />,
    )

    expect(screen.getByRole('button', { name: /Target Note/ })).toBeInTheDocument()
    expect(getItemLinks).toHaveBeenCalledWith({ itemId: note.id, kind: 'backlinks' })
  })

  it('routes history preview and rollback through the injected source', () => {
    const note = createNote()
    const entry = historyEntry({ itemId: note.id })
    const previewEntry = vi.fn()
    const requestRollback = vi.fn()
    const source = createRuntimeRightSidebarSource(
      createTestWorkspaceRuntime({
        history: createAvailableHistory(note.id, entry, { previewEntry, requestRollback }),
        item: note,
      }),
      { navigateToHeading: vi.fn() },
    )

    render(
      <RightSidebarPanel
        contentId={RIGHT_SIDEBAR_CONTENT.history}
        itemId={note.id}
        source={source}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Unknown edited content/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))

    expect(previewEntry).toHaveBeenCalledWith(entry.id)
    expect(requestRollback).toHaveBeenCalledWith(entry.id)
  })

  it('falls back to an available panel when the stored active panel is unsupported', () => {
    const note = createNote()
    const source = createRuntimeRightSidebarSource(createTestWorkspaceRuntime({}), {
      navigateToHeading: vi.fn(),
    })

    render(
      <RightSidebarContainer
        item={note}
        sidebar={{
          activeContentId: RIGHT_SIDEBAR_CONTENT.history,
          close: vi.fn(),
          isLoaded: true,
          open: vi.fn(),
          setActiveContent: vi.fn(),
          setSize: vi.fn(),
          setVisible: vi.fn(),
          size: 300,
          visible: true,
        }}
        source={{
          ...source,
          history: { status: 'unavailable' },
          itemLinks: { status: 'unsupported', reason: 'not_available' },
        }}
      />,
    )

    expect(screen.getByText('Page was not found.')).toBeInTheDocument()
  })
})

function historyEntry(overrides: Partial<EditHistoryEntry> = {}): EditHistoryEntry {
  return {
    id: testHistoryEntryId('history-1'),
    createdAt: Date.UTC(2026, 0, 1),
    action: 'content_edited',
    workspaceId: testId<'campaigns'>('campaign-1'),
    memberId: testId<'campaignMembers'>('member-1'),
    hasSnapshot: true,
    itemId: testResourceId('note-1'),
    itemType: 'note',
    metadata: null,
    ...overrides,
  } as EditHistoryEntry
}

function createAvailableHistory(
  itemId: EditHistoryEntry['itemId'],
  entry: EditHistoryEntry,
  controls: Partial<
    Pick<
      Extract<ResourceHistory, { status: 'available' }>,
      'previewEntry' | 'requestRollback' | 'clearPreview' | 'clearRollback' | 'clearItemSession'
    >
  > = {},
): Extract<ResourceHistory, { status: 'available' }> {
  return {
    status: 'available',
    itemId,
    entries: {
      loadMore: vi.fn(),
      state: {
        canEdit: true,
        entries: [entry],
        membersMap: new Map(),
        myMemberId: null,
        previewingEntryId: null,
        status: 'Exhausted',
      },
    },
    previewingEntryId: null,
    preview: { status: 'unavailable', entryTime: undefined },
    previewEntry: vi.fn(),
    rollbackEntryId: null,
    rollback: { status: 'closed', isRestoring: false },
    requestRollback: vi.fn(),
    restoreRollback: vi.fn(),
    clearPreview: vi.fn(),
    clearRollback: vi.fn(),
    clearItemSession: vi.fn(),
    ...controls,
  }
}

function createNoteWithHeadings(blockMetaById: Record<string, BlockMeta>): NoteItemWithContent {
  const content = Object.keys(blockMetaById).map(createHeadingBlock)
  return {
    ...createNote({ allPermissionLevel: PERMISSION_LEVEL.VIEW }),
    ancestors: [],
    blockMeta: blockMetaById,
    blockShareAccessWarnings: [],
    content,
  } as NoteItemWithContent
}

function createHeadingBlock(id: string): NoteBlock {
  return {
    id: id as NoteBlockId,
    type: 'heading',
    props: {
      backgroundColor: 'default',
      level: 1,
      textAlignment: 'left',
      textColor: 'default',
    },
    content: [{ type: 'text', text: id === 'visible' ? 'Visible' : 'Hidden', styles: {} }],
    children: [],
  } as NoteBlock
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
