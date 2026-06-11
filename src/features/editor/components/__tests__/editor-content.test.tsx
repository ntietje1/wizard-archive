import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { EditorContent } from '../editor-content'
import { LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS } from '../../workspace/live-note-document-source'
import { createTestCanvasViewerSource } from '~/test/factories/canvas-viewer-source-factory'
import type { EditorWorkspaceSource } from '../../workspace/editor-workspace-source'

vi.mock('~/features/context-menu/components/editor-context-menu', () => ({
  EditorContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('EditorContent', () => {
  it('renders the empty workspace through the source-owned drop zone', () => {
    render(<EditorContent source={createEmptyWorkspaceSource({ dropStatus: 'enabled' })} />)

    expect(screen.getByTestId('empty-workspace-drop-zone')).toHaveTextContent(
      'Select an item from the sidebar to view it.',
    )
  })

  it('renders the empty workspace without a drop zone when the source disables that capability', () => {
    render(<EditorContent source={createEmptyWorkspaceSource({ dropStatus: 'disabled' })} />)

    expect(screen.getByText('Select an item from the sidebar to view it.')).toBeInTheDocument()
    expect(screen.queryByTestId('empty-workspace-drop-zone')).not.toBeInTheDocument()
  })
})

function createEmptyWorkspaceSource({
  dropStatus,
}: {
  dropStatus: 'enabled' | 'disabled'
}): EditorWorkspaceSource {
  const campaignId = 'campaign_1' as Id<'campaigns'>
  return {
    content: {
      currentItem: {
        item: null,
        contentItem: null,
        editorSearch: {},
        isLoading: false,
        itemError: null,
        hasRequestedItem: false,
      },
      requestedSlug: null,
      canViewCurrentItem: false,
      availabilityState: {
        status: 'not_found',
        label: 'Page',
        message: 'Page not found.',
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
      activeItemsById: new Map(),
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
        item: null,
      },
      createItem: vi.fn(() => null),
      createMissingRequestedNote: vi.fn(),
      creationDraft: {
        pendingName: '',
        setPendingName: vi.fn(),
      },
      emptyWorkspaceDrop:
        dropStatus === 'enabled'
          ? {
              status: 'enabled',
              accepts: {
                externalFiles: true,
                sidebarItems: true,
              },
              target: {
                ref: createRef<HTMLDivElement>(),
                isFileDropTarget: false,
                isSidebarItemDropTarget: false,
              },
            }
          : {
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
