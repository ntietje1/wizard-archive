import { fireEvent, render, screen } from '@testing-library/react'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { describe, expect, it, vi } from 'vitest'
import { FileTopbar } from '../file-topbar'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { createTestCanvasViewerSource } from '~/test/factories/canvas-viewer-source-factory'
import { LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS } from '../../../workspace/live-note-document-source'
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

    render(
      <FileTopbar onToggleHistory={rightSidebarState.toggle} source={createWorkspaceSource()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /toggle history panel/i }))

    expect(rightSidebarState.toggle).not.toHaveBeenCalled()
  })
})

function createWorkspaceSource(): EditorWorkspaceSource {
  const item = currentItemState.item
  const contentItem = item as AnySidebarItemWithContent | null
  const campaignId = 'campaign_1' as Id<'campaigns'>
  return {
    content: {
      currentItem: {
        item,
        contentItem,
        editorSearch: {},
        isLoading: false,
        itemError: null,
        hasRequestedItem: true,
      },
      requestedSlug: null,
      canViewCurrentItem: true,
      availabilityState: {
        status: 'available',
        label: item?.name ?? 'Page',
        item: contentItem!,
      },
    },
    permissions: {
      editorMode: 'editor',
      canEdit: true,
      campaignActor: { kind: 'player', campaignId },
      viewAsPlayerId: undefined,
      setEditorMode: vi.fn(),
      setViewAsPlayerId: vi.fn(),
      viewAsPlayer: {
        isPending: false,
        playerMembers: [],
        selectedPlayerId: undefined,
        setSelectedPlayerId: vi.fn(),
        visible: false,
      },
    },
    index: {
      activeItemsById: new Map(item ? [[item._id, item]] : []),
      trashItems: [],
    },
    workspace: {
      campaignId,
      isCampaignLoaded: true,
      isDm: false,
    },
    items: {
      itemActions: {
        enabled: false,
        item,
      },
      createItem: vi.fn(() => null),
      createMissingRequestedNote: vi.fn(),
      emptyWorkspaceDrop: {
        status: 'disabled',
        reason: 'unsupported',
      },
      renameItem: vi.fn(),
      isCreatingMissingRequestedNote: false,
      validateItemName: vi.fn(() => ({ valid: true as const })),
    },
    navigation: {
      openItem: vi.fn(),
      openItemBySlug: vi.fn(),
      getItemLinkProps: vi.fn(() => null),
    },
    history: {
      preview: {
        previewingEntryId: null,
        clearItemSession: vi.fn(),
        PreviewComponent: () => null,
      },
      rollback: {
        DialogComponent: () => null,
      },
    },
    sharing: {
      visible: false,
    },
    files: {
      viewer: {
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
    documents: {
      canvases: {
        viewer: createTestCanvasViewerSource(),
      },
      notes: LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS,
    },
  }
}
