import { EDITOR_MODE } from 'shared/editor/types'
import { validateSidebarItemNameWithSiblings } from 'shared/sidebar-items/name'
import type { EditorWorkspaceSource } from '~/features/editor/workspace/editor-workspace-source'
import type { INITIAL_DEMO_WORKSPACE, DemoWorkspaceAction } from './demo-workspace-model'
import { createDemoWorkspaceProjection, selectedDemoItem } from './demo-workspace-model'
import type { Dispatch } from 'react'
import type { Id } from 'convex/_generated/dataModel'

type DemoWorkspaceState = typeof INITIAL_DEMO_WORKSPACE

const DEMO_CAMPAIGN_ID = 'demo-campaign' as Id<'campaigns'>

const noop = () => {}

export function createLocalDemoEditorWorkspaceSource({
  dispatch,
  workspace,
}: {
  dispatch: Dispatch<DemoWorkspaceAction>
  workspace: DemoWorkspaceState
}): EditorWorkspaceSource {
  const selectedItem = selectedDemoItem(workspace)
  const projection = createDemoWorkspaceProjection(workspace)
  const contentItem = selectedItem
    ? (projection.itemsById.get(selectedItem.id as Id<'sidebarItems'>) ?? null)
    : null

  return {
    currentItem: {
      item: contentItem,
      contentItem,
      editorSearch: selectedItem ? { item: contentItem?.slug } : {},
      isLoading: false,
      itemError: null,
      hasRequestedItem: workspace.activeView === 'item',
    },
    editorMode: {
      editorMode: EDITOR_MODE.EDITOR,
      campaignActor: { kind: 'dm', campaignId: DEMO_CAMPAIGN_ID },
      viewAsPlayerId: undefined,
      canEdit: true,
      setEditorMode: noop,
      setViewAsPlayerId: noop,
    },
    filesystem: {
      activeItemsById: projection.itemsById,
      trashItems: [],
    },
    campaign: {
      campaignId: DEMO_CAMPAIGN_ID,
      isCampaignLoaded: true,
      isDm: true,
    },
    chrome: {
      rightSidebar: {
        activeContentId: 'outline',
        close: noop,
        isLoaded: false,
        open: noop,
        setActiveContent: noop,
        setSize: noop,
        setVisible: noop,
        size: 320,
        toggle: noop,
        visible: false,
      },
      topbar: {
        contextMenu: {
          enabled: false,
          item: contentItem,
        },
        history: {
          toggle: noop,
        },
        share: {
          visible: false,
        },
        viewAsPlayer: {
          isPending: false,
          playerMembers: [],
          selectedPlayerId: undefined,
          setSelectedPlayerId: noop,
          visible: false,
        },
      },
    },
    interactions: {
      emptyWorkspaceDrop: { status: 'disabled', reason: 'unsupported' },
    },
    commands: {
      renameItem: (item, name) =>
        dispatch({ type: 'renameItem', itemId: String(item._id), title: name }),
      openItem: (item) => dispatch({ type: 'selectItem', itemId: String(item._id) }),
      getItemLinkProps: () => null,
      validateItemName: (name, parentId, excludeId) =>
        validateSidebarItemNameWithSiblings(
          name,
          projection.items.filter((item) => item.parentId === parentId),
          excludeId,
        ),
    },
    pendingItemName: selectedItem?.title ?? '',
    setPendingItemName: (title) => dispatch({ type: 'renameSelectedItem', title }),
    requestedSlug: contentItem?.slug ?? null,
    canViewCurrentItem: Boolean(contentItem),
    availabilityState: contentItem
      ? { status: 'available', label: contentItem.name, item: contentItem }
      : { status: 'not_found', label: 'Demo item', message: 'Select an item from the sidebar.' },
    createMissingRequestedNote: noop,
    isCreatingMissingRequestedNote: false,
  }
}
