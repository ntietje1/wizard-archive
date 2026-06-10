import { fireEvent, render, screen } from '@testing-library/react'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { describe, expect, it, vi } from 'vitest'
import { FileTopbar } from '../file-topbar'
import { createNote } from '~/test/factories/sidebar-item-factory'
import type { EditorWorkspaceSource } from '../../../workspace/editor-workspace-source'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'

const currentItemState = vi.hoisted(() => ({
  item: null as ReturnType<typeof createNote> | null,
}))

const rightSidebarState = vi.hoisted(() => ({
  toggle: vi.fn(),
}))

vi.mock('../editable-breadcrumb', () => ({
  EditableBreadcrumb: ({ item }: { item: { name: string } }) => <span>{item.name}</span>,
  EditableName: () => <input aria-label="Item name" />,
  SidebarItemBreadcrumb: ({ item }: { item: { name: string } }) => <span>{item.name}</span>,
}))

vi.mock('../topbar-item-content/item-button-wrapper', () => ({
  ItemButtonWrapper: () => <div />,
}))

vi.mock('~/features/context-menu/components/editor-context-menu', () => ({
  EditorContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('FileTopbar', () => {
  it('does not open history when the current item only grants view permission', () => {
    currentItemState.item = createNote({
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      updatedTime: Date.now(),
    })

    render(<FileTopbar source={createWorkspaceSource()} />)

    fireEvent.click(screen.getByRole('button', { name: /toggle history panel/i }))

    expect(rightSidebarState.toggle).not.toHaveBeenCalled()
  })
})

function createWorkspaceSource(): EditorWorkspaceSource {
  const item = currentItemState.item
  const contentItem = item as AnySidebarItemWithContent | null
  const campaignId = 'campaign_1' as Id<'campaigns'>
  return {
    currentItem: {
      item,
      contentItem,
      editorSearch: {},
      isLoading: false,
      itemError: null,
      hasRequestedItem: true,
    },
    editorMode: {
      editorMode: 'editor',
      canEdit: true,
      campaignActor: { kind: 'player', campaignId },
      viewAsPlayerId: undefined,
      setEditorMode: vi.fn(),
      setViewAsPlayerId: vi.fn(),
    },
    filesystem: {
      activeItemsById: new Map(item ? [[item._id, item]] : []),
      trashItems: [],
    },
    campaign: {
      campaignId,
      isCampaignLoaded: true,
      isDm: false,
    },
    chrome: {
      rightSidebar: {
        visible: false,
        activeContentId: 'history',
        size: 300,
        isLoaded: true,
        setSize: vi.fn(),
        setVisible: vi.fn(),
        setActiveContent: vi.fn(),
        open: vi.fn(),
        close: vi.fn(),
        toggle: rightSidebarState.toggle,
      },
      topbar: {
        contextMenu: {
          enabled: false,
          item,
        },
        history: {
          toggle: rightSidebarState.toggle,
        },
        share: {
          visible: false,
        },
        viewAsPlayer: {
          isPending: false,
          playerMembers: [],
          selectedPlayerId: undefined,
          setSelectedPlayerId: vi.fn(),
          visible: false,
        },
      },
    },
    interactions: {
      emptyWorkspaceDrop: {
        status: 'disabled',
        reason: 'unsupported',
      },
    },
    historyPreview: {
      previewingEntryId: null,
      clearItemSession: vi.fn(),
      PreviewComponent: () => null,
      RollbackDialogComponent: () => null,
    },
    viewers: {
      file: {
        resolveFile: (file) => ({
          allowObjectUrl: false,
          contentType: file.contentType,
          downloadUrl: file.downloadUrl,
          name: file.name,
          size: null,
        }),
        getEmptyFileUpload: () => null,
      },
    },
    commands: {
      renameItem: vi.fn(),
      openItem: vi.fn(),
      getItemLinkProps: vi.fn(() => null),
      validateItemName: vi.fn(() => ({ valid: true as const })),
    },
    pendingItemName: '',
    setPendingItemName: vi.fn(),
    requestedSlug: null,
    canViewCurrentItem: true,
    availabilityState: {
      status: 'available',
      label: item?.name ?? 'Page',
      item: contentItem!,
    },
    createMissingRequestedNote: vi.fn(),
    isCreatingMissingRequestedNote: false,
  }
}
