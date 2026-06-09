import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { EditorContent } from '../editor-content'
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
    currentItem: {
      item: null,
      contentItem: null,
      editorSearch: {},
      isLoading: false,
      itemError: null,
      hasRequestedItem: false,
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
      activeItemsById: new Map(),
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
        toggle: vi.fn(),
      },
      topbar: {
        contextMenu: {
          item: null,
        },
        history: {
          toggle: vi.fn(),
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
    },
    pendingItemName: '',
    setPendingItemName: vi.fn(),
    requestedSlug: null,
    canViewCurrentItem: false,
    availabilityState: {
      status: 'not_found',
      label: 'Page',
      message: 'Page not found.',
    },
    createMissingRequestedNote: vi.fn(),
    isCreatingMissingRequestedNote: false,
  }
}
