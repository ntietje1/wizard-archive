import { useTransition } from 'react'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'
import { handleError } from '~/shared/utils/logger'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import type { EditorWorkspaceSource } from './editor-workspace-source'

export function useLiveEditorWorkspaceSource(): EditorWorkspaceSource {
  const currentItem = useCurrentItem()
  const editorMode = useEditorMode()
  const filesystem = useFileSystemReadModel()
  const campaign = useCampaign()
  const pendingItemName = useSidebarUIStore((s) => s.pendingItemName)
  const setPendingItemName = useSidebarUIStore((s) => s.setPendingItemName)
  const { createItem } = useCreateFileSystemItem()
  const { getDefaultName } = useSidebarValidation()
  const { openParentFolders } = useOpenParentFolders()
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
      try {
        const result = await createItem({
          type: SIDEBAR_ITEM_TYPES.notes,
          parentTarget: { kind: 'direct', parentId: null },
          name: getDefaultName(SIDEBAR_ITEM_TYPES.notes, null),
        })
        openParentFolders(result.id)
      } catch (error) {
        handleError(error, 'Failed to create note')
      }
    })
  }

  return {
    currentItem,
    editorMode,
    filesystem,
    campaign,
    pendingItemName,
    setPendingItemName,
    requestedSlug,
    canViewCurrentItem,
    availabilityState,
    createMissingRequestedNote,
    isCreatingMissingRequestedNote,
  }
}
