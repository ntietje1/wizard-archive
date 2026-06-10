import { EDITOR_MODE } from 'shared/editor/types'
import { validateSidebarItemNameWithSiblings } from 'shared/sidebar-items/name'
import { assertSidebarItemSlug } from 'shared/sidebar-items/slug'
import type { EditorWorkspaceSource } from '~/features/editor/workspace/editor-workspace-source'
import type { FileViewerSource } from '~/features/editor/components/viewer/file/file-viewer-source'
import type { INITIAL_DEMO_WORKSPACE, DemoWorkspaceAction } from './demo-workspace-model'
import { createDemoWorkspaceProjection, selectedDemoItem } from './demo-workspace-model'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'
import type { Dispatch } from 'react'
import type { Id } from 'convex/_generated/dataModel'

type DemoWorkspaceState = typeof INITIAL_DEMO_WORKSPACE

const DEMO_CAMPAIGN_ID = 'demo-campaign' as Id<'campaigns'>

const noop = () => {}
const EmptyHistoryPreview = () => null
const EmptyRollbackDialog = () => null

export function createLocalDemoEditorWorkspaceSource({
  dispatch,
  fileViewerSource,
  workspace,
}: {
  dispatch: Dispatch<DemoWorkspaceAction>
  fileViewerSource: FileViewerSource
  workspace: DemoWorkspaceState
}): EditorWorkspaceSource {
  const selectedItem = selectedDemoItem(workspace)
  const projection = createDemoWorkspaceProjection(workspace)
  const contentItem = selectedItem
    ? (projection.itemsById.get(selectedItem.id as Id<'sidebarItems'>) ?? null)
    : null

  return {
    content: {
      currentItem: {
        item: contentItem,
        contentItem,
        editorSearch: selectedItem ? { item: contentItem?.slug } : {},
        isLoading: false,
        itemError: null,
        hasRequestedItem: workspace.activeView === 'item',
      },
      requestedSlug: contentItem?.slug ?? null,
      canViewCurrentItem: Boolean(contentItem),
      availabilityState: contentItem
        ? { status: 'available', label: contentItem.name, item: contentItem }
        : {
            status: 'not_found',
            label: 'Demo item',
            message: 'Select an item from the sidebar.',
          },
    },
    permissions: {
      editorMode: EDITOR_MODE.EDITOR,
      campaignActor: { kind: 'dm', campaignId: DEMO_CAMPAIGN_ID },
      viewAsPlayerId: undefined,
      canEdit: true,
      setEditorMode: noop,
      setViewAsPlayerId: noop,
      viewAsPlayer: {
        isPending: false,
        playerMembers: [],
        selectedPlayerId: undefined,
        setSelectedPlayerId: noop,
        visible: false,
      },
    },
    index: {
      activeItemsById: projection.itemsById,
      trashItems: [],
    },
    workspace: {
      campaignId: DEMO_CAMPAIGN_ID,
      isCampaignLoaded: true,
      isDm: true,
    },
    items: {
      itemActions: {
        enabled: false,
        item: contentItem,
      },
      createItem: ({ name, type }) => {
        const command = SIDEBAR_ITEM_CREATION_COMMANDS.find((candidate) => candidate.type === type)
        if (!command) return null

        const id = `local-${command.key}-${workspace.nextLocalNoteIndex}`
        dispatch({ type: 'createItem', commandKey: command.key })
        if (name?.trim()) {
          dispatch({ type: 'renameItem', itemId: id, title: name })
        }
        return { id: id as Id<'sidebarItems'>, slug: assertSidebarItemSlug(id) }
      },
      createMissingRequestedNote: noop,
      creationDraft: {
        pendingName: selectedItem?.title ?? '',
        setPendingName: (title) => dispatch({ type: 'renameSelectedItem', title }),
      },
      emptyWorkspaceDrop: { status: 'disabled', reason: 'unsupported' },
      isCreatingMissingRequestedNote: false,
      renameItem: (item, name) =>
        dispatch({ type: 'renameItem', itemId: String(item._id), title: name }),
      validateItemName: (name, parentId, excludeId) =>
        validateSidebarItemNameWithSiblings(
          name,
          projection.items.filter((item) => item.parentId === parentId),
          excludeId,
        ),
    },
    navigation: {
      openItem: (item) => dispatch({ type: 'selectItem', itemId: String(item._id) }),
      openItemBySlug: (slug) => dispatch({ type: 'selectItem', itemId: String(slug) }),
      getItemLinkProps: () => null,
    },
    history: {
      preview: {
        previewingEntryId: null,
        clearItemSession: noop,
        PreviewComponent: EmptyHistoryPreview,
      },
      rollback: {
        DialogComponent: EmptyRollbackDialog,
      },
    },
    sharing: {
      visible: false,
    },
    files: {
      viewer: fileViewerSource,
    },
  }
}
