import { useTransition } from 'react'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useEditFileSystemItem } from '~/features/filesystem/useEditFileSystemItem'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { useSidebarItemsShare } from '~/features/sharing/hooks/useSidebarItemsShare'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { buildEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { LiveHistoryPreviewViewer } from '~/features/editor/components/viewer/live-history-preview-viewer'
import { LiveRollbackConfirmDialog } from '~/features/editor/components/viewer/live-rollback-confirm-dialog'
import { LIVE_CANVAS_VIEWER_SOURCE } from '~/features/canvas/components/live-canvas-viewer-source'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { useLiveFileViewerSource } from '~/features/editor/components/viewer/file/live-file-viewer-source'
import type { EditorWorkspaceSharingState, EditorWorkspaceSource } from './editor-workspace-source'
import { LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS } from './live-note-document-source'
import { useLiveEmptyWorkspaceDropCapability } from './use-live-empty-workspace-drop'
import { handleError } from '~/shared/utils/logger'

export function useLiveEditorWorkspaceSource(): EditorWorkspaceSource {
  const currentItem = useCurrentItem()
  const editorMode = useEditorMode()
  const filesystem = useFileSystemReadModel()
  const campaign = useCampaign()
  const campaignMembers = useCampaignMembers()
  const { editItem } = useEditFileSystemItem()
  const { createItem: createFileSystemItem } = useCreateFileSystemItem()
  const { navigateToItem } = useEditorNavigation()
  const { setLastSelectedItem } = useLastEditorItem()
  const sidebarValidation = useSidebarValidation()
  const [isCreatingMissingRequestedNote, startCreateTransition] = useTransition()
  const emptyWorkspaceDrop = useLiveEmptyWorkspaceDropCapability()
  const fileViewerSource = useLiveFileViewerSource(currentItem.contentItem)
  const shareItems = currentItem.item ? [currentItem.item] : []
  const { isPending, isMutating, aggregateShareStatus, canShare } = useSidebarItemsShare(shareItems)
  const previewingEntryId = useHistoryPreviewStore((s) =>
    currentItem.contentItem && s.preview?.itemId === currentItem.contentItem._id
      ? s.preview.entryId
      : null,
  )
  const clearItemPreviewSession = useHistoryPreviewStore((s) => s.clearItemSession)
  const playerMembers =
    campaignMembers.data?.filter((member) => member.role === CAMPAIGN_MEMBER_ROLE.Player) ?? []
  const sharing: EditorWorkspaceSharingState = campaign.isDm
    ? {
        disabled:
          currentItem.isLoading ||
          !currentItem.item ||
          currentItem.item.isTrashed === true ||
          !canShare ||
          isMutating ||
          isPending,
        items: shareItems,
        shared: Boolean(
          currentItem.item && aggregateShareStatus && aggregateShareStatus !== 'not_shared',
        ),
        visible: true,
      }
    : {
        visible: false,
      }
  const requestedSlug = getSlug(currentItem.editorSearch)
  const canViewCurrentItem =
    !!currentItem.item &&
    effectiveHasAtLeastPermission(currentItem.item, PERMISSION_LEVEL.VIEW, {
      actor: editorMode.campaignActor,
      allItemsMap: filesystem.activeItemsById,
    })
  const availabilityState = useSidebarItemAvailabilityState({
    lookup: { kind: 'slug', slug: requestedSlug },
    readableItem: currentItem.contentItem,
    readableItemLoading: currentItem.isLoading,
    readableItemError: currentItem.itemError,
    canView: canViewCurrentItem,
    subject: 'page',
    fallbackLabel: 'Page',
  })

  const createWorkspaceItem: EditorWorkspaceSource['items']['createItem'] = async ({
    name,
    parentId,
    type,
  }) => {
    if (!campaign.campaignId) return null

    try {
      return await createFileSystemItem({
        type,
        parentTarget: { kind: 'direct', parentId },
        name,
      })
    } catch (error) {
      handleError(error, 'Failed to create item')
      return null
    }
  }

  const createMissingRequestedNote = () => {
    if (!campaign.campaignId || !requestedSlug || isCreatingMissingRequestedNote) return

    startCreateTransition(async () => {
      await createWorkspaceItem({
        type: SIDEBAR_ITEM_TYPES.notes,
        parentId: null,
        name: getRequestedNoteName(requestedSlug) ?? undefined,
      })
    })
  }

  return {
    content: {
      currentItem,
      requestedSlug,
      canViewCurrentItem,
      availabilityState,
    },
    permissions: {
      ...editorMode,
      viewAsPlayer: {
        isPending: campaignMembers.isPending,
        playerMembers,
        selectedPlayerId: editorMode.viewAsPlayerId,
        setSelectedPlayerId: editorMode.setViewAsPlayerId,
        visible: Boolean(campaign.isDm),
      },
    },
    index: filesystem,
    workspace: {
      campaignId: campaign.campaignId,
      isCampaignLoaded: campaign.isCampaignLoaded,
      isDm: campaign.isDm,
    },
    items: {
      itemActions: {
        enabled: true,
        item: currentItem.item,
      },
      createItem: createWorkspaceItem,
      createMissingRequestedNote,
      emptyWorkspaceDrop,
      isCreatingMissingRequestedNote,
      renameItem: async (item, name) => {
        await editItem({ item, name })
      },
      validateItemName: sidebarValidation.validateName,
    },
    navigation: {
      openItem: (item) => {
        setLastSelectedItem(item.slug)
        return navigateToItem(item.slug)
      },
      openItemBySlug: (slug, replace) => {
        setLastSelectedItem(slug)
        return navigateToItem(slug, replace)
      },
      getItemLinkProps: (item) =>
        buildEditorLinkProps(item, {
          dmUsername: campaign.dmUsername,
          campaignSlug: campaign.campaignSlug,
        }),
    },
    history: {
      preview: {
        previewingEntryId,
        clearItemSession: clearItemPreviewSession,
        PreviewComponent: LiveHistoryPreviewViewer,
      },
      rollback: {
        DialogComponent: LiveRollbackConfirmDialog,
      },
    },
    sharing,
    files: {
      viewer: fileViewerSource,
    },
    documents: {
      canvases: {
        viewer: LIVE_CANVAS_VIEWER_SOURCE,
      },
      notes: LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS,
    },
  }
}

function getRequestedNoteName(requestedSlug: string | null) {
  const name = requestedSlug?.trim()
  return name ? name : null
}
