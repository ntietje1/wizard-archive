import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { useLiveEditorWorkspaceSource } from '../use-live-editor-workspace-source'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'

const liveSourceState = vi.hoisted(() => ({
  contentItem: null as AnySidebarItemWithContent | null,
  item: null as AnySidebarItemWithContent | null,
}))

const fileSystemItemMocks = vi.hoisted(() => ({
  createItem: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: 'campaign-1',
    campaignSlug: 'campaign',
    dmUsername: 'dm',
    isCampaignLoaded: true,
    isDm: true,
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => ({ data: [], isPending: false }),
}))

vi.mock('~/features/sidebar/hooks/useCurrentItem', () => ({
  useCurrentItem: () => ({
    item: liveSourceState.item,
    contentItem: liveSourceState.contentItem,
    editorSearch: liveSourceState.item ? { item: liveSourceState.item.slug } : {},
    isLoading: false,
    itemError: null,
    hasRequestedItem: Boolean(liveSourceState.item),
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => ({
    editorMode: 'editor',
    campaignActor: { kind: 'dm', campaignId: 'campaign-1' },
    viewAsPlayerId: undefined,
    canEdit: true,
    setEditorMode: vi.fn(),
    setViewAsPlayerId: vi.fn(),
  }),
}))

vi.mock('~/features/filesystem/useEditFileSystemItem', () => ({
  useEditFileSystemItem: () => ({ editItem: vi.fn() }),
}))

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({ createItem: fileSystemItemMocks.createItem }),
}))

vi.mock('~/features/filesystem/useFileSystemReadModel', () => ({
  useFileSystemReadModel: () => ({
    activeItemsById: new Map<Id<'sidebarItems'>, AnySidebarItem>(
      liveSourceState.item ? [[liveSourceState.item._id, liveSourceState.item]] : [],
    ),
    trashItems: [],
    readModel: {
      getActiveChildren: vi.fn(() => []),
    },
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemAvailabilityState', () => ({
  useSidebarItemAvailabilityState: () =>
    liveSourceState.contentItem
      ? {
          status: 'available',
          label: liveSourceState.contentItem.name,
          item: liveSourceState.contentItem,
        }
      : { status: 'not_found', label: 'Page', message: 'Page not found.' },
}))

vi.mock('~/features/sharing/hooks/useSidebarItemsShare', () => ({
  useSidebarItemsShare: () => ({
    isPending: false,
    isMutating: false,
    aggregateShareStatus: 'not_shared',
    canShare: true,
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({ navigateToItem: vi.fn() }),
}))

vi.mock('~/features/sidebar/hooks/useLastEditorItem', () => ({
  useLastEditorItem: () => ({ setLastSelectedItem: vi.fn() }),
}))

vi.mock('~/features/sidebar/hooks/useEditorLinkProps', () => ({
  buildEditorLinkProps: () => null,
}))

vi.mock('~/features/sidebar/hooks/useSidebarValidation', () => ({
  useSidebarValidation: () => ({ validateName: vi.fn(() => ({ valid: true })) }),
}))

vi.mock('../use-live-empty-workspace-drop', () => ({
  useLiveEmptyWorkspaceDropCapability: () => ({ status: 'disabled', reason: 'unsupported' }),
}))

vi.mock('~/features/editor/components/viewer/live-history-preview-viewer', () => ({
  LiveHistoryPreviewViewer: () => null,
}))

vi.mock('~/features/editor/components/viewer/live-rollback-confirm-dialog', () => ({
  LiveRollbackConfirmDialog: () => null,
}))

vi.mock('~/features/editor/components/viewer/file/live-file-viewer-source', () => ({
  useLiveFileViewerSource: () => ({
    resolveFile: vi.fn(),
    getEmptyFileUpload: vi.fn(() => null),
  }),
}))

describe('useLiveEditorWorkspaceSource', () => {
  beforeEach(() => {
    liveSourceState.contentItem = createContentNote('note-1')
    liveSourceState.item = liveSourceState.contentItem
    fileSystemItemMocks.createItem.mockReset()
    fileSystemItemMocks.createItem.mockResolvedValue({
      id: 'created-note' as Id<'sidebarItems'>,
      slug: 'created-note',
    })
    useHistoryPreviewStore.setState({ preview: null, rollback: null })
  })

  it('exposes the current item history preview entry from the live history store', () => {
    const entryId = 'history-1' as Id<'editHistory'>
    useHistoryPreviewStore.getState().setPreviewingEntry('note-1' as Id<'sidebarItems'>, entryId)

    const { result } = renderHook(() => useLiveEditorWorkspaceSource())

    expect(result.current.history.preview.previewingEntryId).toBe(entryId)
  })

  it('does not expose a history preview entry for a different item', () => {
    useHistoryPreviewStore
      .getState()
      .setPreviewingEntry('note-2' as Id<'sidebarItems'>, 'history-1' as Id<'editHistory'>)

    const { result } = renderHook(() => useLiveEditorWorkspaceSource())

    expect(result.current.history.preview.previewingEntryId).toBeNull()
  })

  it('keys history preview to the rendered content item when sidebar metadata is optimistic', () => {
    const entryId = 'history-1' as Id<'editHistory'>
    liveSourceState.item = createContentNote('optimistic-note')
    useHistoryPreviewStore.getState().setPreviewingEntry('note-1' as Id<'sidebarItems'>, entryId)

    const { result } = renderHook(() => useLiveEditorWorkspaceSource())

    expect(result.current.history.preview.previewingEntryId).toBe(entryId)
  })

  it('creates editor items through the filesystem operation capability', async () => {
    const { result } = renderHook(() => useLiveEditorWorkspaceSource())

    await result.current.items.createItem({
      type: SIDEBAR_ITEM_TYPES.notes,
      parentId: 'folder-1' as Id<'sidebarItems'>,
      name: 'Session Notes',
    })

    expect(fileSystemItemMocks.createItem).toHaveBeenCalledWith({
      type: SIDEBAR_ITEM_TYPES.notes,
      parentTarget: {
        kind: 'direct',
        parentId: 'folder-1',
      },
      name: 'Session Notes',
    })
  })
})

function createContentNote(id: string): AnySidebarItemWithContent {
  return {
    ...createNote({ _id: id as Id<'sidebarItems'> }),
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
  } as AnySidebarItemWithContent
}
