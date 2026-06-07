import { useState } from 'react'
import { toast } from 'sonner'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { MenuDialogState } from './menu-dialogs'
import type { PermissionLevel } from 'shared/permissions/types'
import type { MenuContext } from './types'
import type { ActionHandlers } from './menu-registry'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { handleError } from '~/shared/utils/logger'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'

import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useToggleBookmark } from '~/features/sidebar/hooks/useBookmarks'
import { isFile, isGameMap } from '~/features/sidebar/utils/sidebar-item-utils'
import { useSession } from '~/features/sidebar/hooks/useGameSession'
import { useFileSystem } from '~/features/filesystem/useFileSystem'
import { createDownloadActions } from './download-actions'
import { createCreationActions } from './creation-actions'

interface UseMenuActionsOptions {
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export function useMenuActions(options: UseMenuActionsOptions = {}) {
  const { onDialogOpen, onDialogClose } = options
  const { navigateToItem } = useEditorNavigation()
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)
  const { openParentFolders } = useOpenParentFolders()
  const { createItem } = useCreateFileSystemItem()
  const { getDefaultName } = useSidebarValidation()
  const { campaignId } = useCampaign()
  const convex = useConvex()
  const { endCurrentSession, startSession: startNewSession } = useSession()
  const toggleBookmarkMutation = useToggleBookmark()
  const filesystemActionsApi = useFileSystem()
  const downloadActions = createDownloadActions({ campaignId, convex })
  const creationActions = createCreationActions({
    campaignId,
    createItem,
    getDefaultName,
    openParentFolders,
  })

  const [editMapDialog, setEditMapDialog] = useState<Id<'sidebarItems'> | null>(null)
  const [editFileDialog, setEditFileDialog] = useState<Id<'sidebarItems'> | null>(null)
  const [editSidebarItemDialog, setEditSidebarItemDialog] = useState<AnySidebarItem | null>(null)

  const actions: ActionHandlers = {
    open: (ctx: MenuContext) => {
      if (!ctx.item) return
      void navigateToItem(ctx.item.slug)
    },

    rename: (ctx: MenuContext) => {
      if (!ctx.item) return
      openParentFolders(ctx.item._id)
      setRenamingId(ctx.item._id)
    },

    showInSidebar: (ctx: MenuContext) => {
      if (!ctx.item) return
      openParentFolders(ctx.item._id)
    },

    editMap: (ctx: MenuContext) => {
      if (isGameMap(ctx.item)) {
        setEditMapDialog(ctx.item._id)
        onDialogOpen?.()
      }
    },

    editFile: (ctx: MenuContext) => {
      if (isFile(ctx.item)) {
        setEditFileDialog(ctx.item._id)
        onDialogOpen?.()
      }
    },

    editItem: (ctx: MenuContext) => {
      if (ctx.item) {
        setEditSidebarItemDialog(ctx.item)
        onDialogOpen?.()
      }
    },

    pinToMap: (ctx: MenuContext) => {
      if (!ctx.activeMap) return
      const pinnedItemIds = new Set(ctx.activeMap.pins.map((pin) => pin.itemId))
      const itemIds: Array<Id<'sidebarItems'>> = []
      for (const item of ctx.selectedItems ?? []) {
        if (item._id !== ctx.activeMap._id && !pinnedItemIds.has(item._id)) {
          itemIds.push(item._id)
        }
      }
      if (itemIds.length === 0) {
        toast.error('Selected items are already pinned on this map')
        return
      }

      const event = new CustomEvent('map-pin-placement-request', {
        detail: {
          itemIds,
        },
      })
      window.dispatchEvent(event)
      toast.info(
        itemIds.length === 1
          ? 'Click on the map to place the pin'
          : 'Click on the map to place pins',
      )
    },

    goToMapPin: (ctx: MenuContext) => {
      if (!ctx.item || !ctx.activeMap) return

      if (!ctx.activeMap.pins.some((pin) => pin.item?._id === ctx.item?._id)) {
        toast.error('Item is not pinned on this map')
        return
      }

      try {
        // Navigate to the map
        const map = ctx.activeMap
        void navigateToItem(map.slug)
        toast.info('Highlighting map pin... (coming soon)')
      } catch (error) {
        handleError(error, 'Failed to navigate to map pin')
      }
    },

    createMapPin: (ctx: MenuContext) => {
      if (!ctx.item || !ctx.activeMap) return

      toast.info('Create Pin Here... (coming soon)')
    },

    removeMapPin: async (ctx: MenuContext) => {
      if (!ctx.activePin) return

      try {
        if (!campaignId) return
        await convex.mutation(api.gameMaps.mutations.removeItemPin, {
          campaignId,
          mapPinId: ctx.activePin._id,
        })
        toast.success('Pin removed')
      } catch (error) {
        handleError(error, 'Failed to remove pin')
      }
    },

    togglePinVisibility: async (ctx: MenuContext) => {
      if (!ctx.activePin) return

      const newVisible = ctx.activePin.visible !== true
      try {
        if (!campaignId) return
        await convex.mutation(api.gameMaps.mutations.updatePinVisibility, {
          campaignId,
          mapPinId: ctx.activePin._id,
          visible: newVisible,
        })
        toast.success(newVisible ? 'Pin shown' : 'Pin hidden')
      } catch (error) {
        handleError(error, 'Failed to toggle pin visibility')
      }
    },

    moveMapPin: (ctx: MenuContext) => {
      if (!ctx.activePin) return

      // Dispatch event to map viewer to enter pin move mode
      const event = new CustomEvent('map-pin-move-request', {
        detail: {
          pinId: ctx.activePin._id,
        },
      })
      window.dispatchEvent(event)
    },

    startSession: () => {
      startNewSession.mutate(
        {},
        {
          onSuccess: () => toast.success('Session started'),
        },
      )
    },

    endSession: () => {
      endCurrentSession.mutate(
        {},
        {
          onSuccess: () => toast.success('Session ended'),
        },
      )
    },

    setGeneralAccessLevel: async (ctx: MenuContext, level: PermissionLevel | null) => {
      if (!campaignId) return
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return

      try {
        await convex.mutation(api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems, {
          campaignId,
          sidebarItemIds: items.map((item) => item._id),
          permissionLevel: level,
        })
        const target = items.length === 1 ? 'item' : `${items.length} items`
        if (level === null) {
          toast.success(`Reset ${target} to default access`)
        } else if (level === PERMISSION_LEVEL.NONE) {
          toast.success(`Access set to none for ${target}`)
        } else {
          toast.success(`Access set to ${level} for ${target}`)
        }
      } catch (error) {
        handleError(error, 'Failed to update access level')
      }
    },

    ...creationActions,
    ...downloadActions,

    delete: async (ctx: MenuContext) => {
      const items = ctx.selectedItems ?? []
      if (items.length > 0) {
        await filesystemActionsApi.requestTrashItems(items.map((item) => item._id))
      }
    },

    restore: async (ctx: MenuContext) => {
      const items = ctx.selectedItems ?? []
      if (items.length > 0) {
        await filesystemActionsApi.restoreItems(
          items.map((item) => item._id),
          null,
        )
      }
    },

    permanentlyDelete: (ctx: MenuContext) => {
      const items = ctx.selectedItems ?? []
      if (items.length > 0) {
        filesystemActionsApi.confirmDeleteForever(items.map((item) => item._id))
      }
    },

    paste: async (ctx: MenuContext) => {
      await filesystemActionsApi.pasteIntoTarget({
        clickedItem: ctx.item,
        operationItems: ctx.selectedItems ?? [],
      })
    },

    duplicate: async (ctx: MenuContext) => {
      const items = ctx.selectedItems ?? []
      if (items.length > 0) {
        await filesystemActionsApi.duplicateItems(items.map((item) => item._id))
      }
    },

    emptyTrash: () => {
      filesystemActionsApi.confirmEmptyTrash()
      onDialogOpen?.()
    },

    toggleBookmark: async (ctx: MenuContext) => {
      if (!campaignId) return
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return

      const results = await Promise.allSettled(
        items.map((item) =>
          toggleBookmarkMutation.mutateAsync({
            sidebarItemId: item._id,
          }),
        ),
      )
      const failures = results.filter((result) => result.status === 'rejected')
      const successCount = results.length - failures.length
      if (failures.length > 0) {
        const error = new Error(`${failures.length} of ${items.length} bookmark updates failed`)
        if (successCount === 0) {
          handleError(
            error,
            items.length === 1 ? 'Failed to toggle bookmark' : 'Failed to toggle bookmarks',
          )
          return
        }
        toast.error(`${successCount} bookmarks updated, ${failures.length} failed`)
        return
      }
      toast.success(items.length === 1 ? 'Bookmark updated' : 'Bookmarks updated')
    },
  }

  const makeCloseHandler = <T,>(setter: React.Dispatch<React.SetStateAction<T | null>>) => {
    return () => {
      setter(null)
      onDialogClose?.()
    }
  }

  const dialogState: MenuDialogState = {
    editMapDialog,
    editFileDialog,
    editSidebarItemDialog,
    campaignId,
    closeMapDialog: makeCloseHandler(setEditMapDialog),
    closeFileDialog: makeCloseHandler(setEditFileDialog),
    closeSidebarItemDialog: makeCloseHandler(setEditSidebarItemDialog),
  }

  return {
    actions,
    filesystem: filesystemActionsApi,
    dialogState,
  }
}
