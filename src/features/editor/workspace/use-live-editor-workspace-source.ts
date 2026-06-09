import { useTransition } from 'react'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import type { EditorWorkspaceSource } from './editor-workspace-source'
import { LiveEmptyWorkspaceDropZone } from './live-empty-workspace-drop-zone'

export function useLiveEditorWorkspaceSource(): EditorWorkspaceSource {
  const currentItem = useCurrentItem()
  const editorMode = useEditorMode()
  const filesystem = useFileSystemReadModel()
  const campaign = useCampaign()
  const pendingItemName = useSidebarUIStore((s) => s.pendingItemName)
  const setPendingItemName = useSidebarUIStore((s) => s.setPendingItemName)
  const {
    commands: { createSidebarItem },
  } = useSidebarWorkspaceSource()
  const [isCreatingMissingRequestedNote, startCreateTransition] = useTransition()

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

  const createMissingRequestedNote = () => {
    if (!campaign.campaignId || !requestedSlug || isCreatingMissingRequestedNote) return

    startCreateTransition(async () => {
      await createSidebarItem({
        type: SIDEBAR_ITEM_TYPES.notes,
        parentId: null,
        name: getRequestedNoteName(requestedSlug) ?? undefined,
      })
    })
  }

  return {
    currentItem,
    editorMode,
    filesystem,
    campaign,
    interactions: {
      emptyWorkspaceDrop: {
        status: 'enabled',
        accepts: {
          externalFiles: true,
          sidebarItems: true,
        },
        DropZone: LiveEmptyWorkspaceDropZone,
      },
    },
    pendingItemName,
    setPendingItemName,
    requestedSlug,
    canViewCurrentItem,
    availabilityState,
    createMissingRequestedNote,
    isCreatingMissingRequestedNote,
  }
}

function getRequestedNoteName(requestedSlug: string | null) {
  const name = requestedSlug?.trim()
  return name ? name : null
}
