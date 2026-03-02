import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConvex } from '@convex-dev/react-query'
import JSZip from 'jszip'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { PermissionLevel } from 'convex/permissions/types'
import type { MenuContext } from './types'
import type { ActionHandlers } from './menu-registry'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useEditorNavigationContext } from '~/hooks/useEditorNavigationContext'
import { getSelectedTypeAndSlug } from '~/hooks/useSelectedItem'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'

import { useCampaign } from '~/hooks/useCampaign'
import { useToggleBookmark } from '~/hooks/useBookmarks'
import { isFile, isFolder, isGameMap, isNote } from '~/lib/sidebar-item-utils'
import { assertNever } from '~/lib/utils'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { FileDialog } from '~/components/forms/file-form/file-dialog'
import { SidebarItemEditDialog } from '~/components/forms/sidebar-item-form/sidebar-item-edit-dialog'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { useSession } from '~/hooks/useSession'
import { convertBlocksToMarkdown } from '~/lib/text-to-blocks'
import {
  getDescendantCount,
  useAllSidebarItems,
  useTrashedSidebarItems,
} from '~/hooks/useSidebarItems'

interface UseMenuActionsOptions {
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export function useMenuActions(options: UseMenuActionsOptions = {}) {
  const { onDialogOpen, onDialogClose } = options
  const { navigateToItem, navigateToMap, clearEditorContent } =
    useEditorNavigationContext()
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)
  const { openParentFolders } = useOpenParentFolders()
  const {
    createItem,
    getDefaultName,
    moveItem,
    permanentlyDeleteItem,
    emptyTrashBin,
  } = useSidebarItemMutations()
  const { campaignId } = useCampaign()
  const convex = useConvex()
  const { endCurrentSession, startSession: startNewSession } = useSession()
  const toggleBookmarkMutation = useToggleBookmark()
  const { parentItemsMap } = useAllSidebarItems()
  const { data: allTrashedItems, parentItemsMap: trashedParentItemsMap } =
    useTrashedSidebarItems()

  const [deleteFolderDialog, setDeleteFolderDialog] = useState<Folder | null>(
    null,
  )
  const [editMapDialog, setEditMapDialog] = useState<Id<'gameMaps'> | null>(
    null,
  )
  const [editFileDialog, setEditFileDialog] = useState<Id<'files'> | null>(null)
  const [editSidebarItemDialog, setEditSidebarItemDialog] =
    useState<AnySidebarItem | null>(null)
  const [confirmPermanentDeleteItem, setConfirmPermanentDeleteItem] =
    useState<AnySidebarItem | null>(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)

  const actions: ActionHandlers = {
    open: useCallback(
      (ctx: MenuContext) => {
        if (!ctx.item) return
        navigateToItem(ctx.item)
      },
      [navigateToItem],
    ),

    rename: useCallback(
      async (ctx: MenuContext) => {
        if (!ctx.item) return
        await openParentFolders(ctx.item._id)
        setRenamingId(ctx.item._id)
      },
      [openParentFolders, setRenamingId],
    ),

    delete: (ctx: MenuContext) => {
      if (!ctx.item) return
      const item = ctx.item

      // Non-empty folders: show confirmation dialog
      if (isFolder(item)) {
        const children = parentItemsMap.get(item._id)
        if (children && children.length > 0) {
          setDeleteFolderDialog(item)
          onDialogOpen?.()
          return
        }
      }

      // Everything else (including empty folders): trash immediately
      const current = getSelectedTypeAndSlug()
      if (current && item.type === current.type && item.slug === current.slug) {
        clearEditorContent()
      }
      moveItem(item, { deleted: true }).then(
        () => toast.success('Moved to trash'),
        (error) => {
          console.error(error)
          toast.error('Failed to move to trash')
        },
      )
    },

    showInSidebar: useCallback(
      (ctx: MenuContext) => {
        if (!ctx.item) return
        openParentFolders(ctx.item._id)
      },
      [openParentFolders],
    ),

    createNote: useCallback(
      async (ctx: MenuContext) => {
        if (!campaignId) return
        if (ctx.item && !isFolder(ctx.item)) {
          console.error('Invalid parent type')
          return
        }
        try {
          const result = await createItem({
            type: SIDEBAR_ITEM_TYPES.notes,
            campaignId,
            parentId: ctx.item?._id ?? null,
            name: getDefaultName(SIDEBAR_ITEM_TYPES.notes, ctx.item?._id ?? null),
          })
          openParentFolders(result.id)
          navigateToItem(result)
        } catch (error) {
          console.error(error)
          toast.error('Failed to create note')
        }
      },
      [
        campaignId,
        createItem,
        getDefaultName,
        openParentFolders,
        navigateToItem,
      ],
    ),

    createFolder: useCallback(
      async (ctx: MenuContext) => {
        if (!campaignId) return
        if (ctx.item && !isFolder(ctx.item)) {
          console.error('Invalid parent type')
          return
        }
        try {
          const result = await createItem({
            type: SIDEBAR_ITEM_TYPES.folders,
            campaignId,
            parentId: ctx.item?._id ?? null,
            name: getDefaultName(SIDEBAR_ITEM_TYPES.folders, ctx.item?._id ?? null),
          })
          openParentFolders(result.id)
          navigateToItem(result)
        } catch (error) {
          console.error(error)
          toast.error('Failed to create folder')
        }
      },
      [
        campaignId,
        createItem,
        getDefaultName,
        openParentFolders,
        navigateToItem,
      ],
    ),

    createMap: useCallback(
      async (ctx: MenuContext) => {
        if (!campaignId) return
        if (ctx.item && !isFolder(ctx.item)) {
          console.error('Invalid parent type')
          return
        }
        try {
          const result = await createItem({
            type: SIDEBAR_ITEM_TYPES.gameMaps,
            campaignId,
            parentId: ctx.item?._id ?? null,
            name: getDefaultName(SIDEBAR_ITEM_TYPES.gameMaps, ctx.item?._id ?? null),
          })
          openParentFolders(result.id)
          navigateToItem(result)
        } catch (error) {
          console.error(error)
          toast.error('Failed to create map')
        }
      },
      [
        campaignId,
        createItem,
        getDefaultName,
        openParentFolders,
        navigateToItem,
      ],
    ),

    createFile: useCallback(
      async (ctx: MenuContext) => {
        if (!campaignId) return
        if (ctx.item && !isFolder(ctx.item)) {
          console.error('Invalid parent type')
          return
        }
        try {
          const result = await createItem({
            type: SIDEBAR_ITEM_TYPES.files,
            campaignId,
            parentId: ctx.item?._id ?? null,
            name: getDefaultName(SIDEBAR_ITEM_TYPES.files, ctx.item?._id ?? null),
          })
          openParentFolders(result.id)
          navigateToItem(result)
        } catch (error) {
          console.error(error)
          toast.error('Failed to create file')
        }
      },
      [
        campaignId,
        createItem,
        getDefaultName,
        openParentFolders,
        navigateToItem,
      ],
    ),

    createCanvas: () => {
      toast.error('Canvas not implemented')
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

    pinToMap: useCallback((ctx: MenuContext) => {
      if (!ctx.item || !ctx.activeMap) return

      if (ctx.activeMap.pins.some((pin) => pin.item?._id === ctx.item?._id)) {
        toast.error('Item is already pinned on this map')
        // TODO: add highlight of pin here
        return
      }

      // Dispatch event to map viewer to enter pin placement mode
      const event = new CustomEvent('map-pin-placement-request', {
        detail: {
          itemId: ctx.item._id,
        },
      })
      window.dispatchEvent(event)
      toast.info('Click on the map to place the pin')
    }, []),

    goToMapPin: useCallback(
      (ctx: MenuContext) => {
        if (!ctx.item || !ctx.activeMap) return

        if (
          !ctx.activeMap.pins.some((pin) => pin.item?._id === ctx.item?._id)
        ) {
          toast.error('Item is not pinned on this map')
          return
        }

        try {
          // Navigate to the map
          const map = ctx.activeMap
          navigateToMap(map.slug)
          toast.info('Highlighting map pin... (coming soon)')
        } catch (error) {
          console.error('Failed to navigate to map pin:', error)
          toast.error('Failed to navigate to map pin')
        }
      },
      [navigateToMap],
    ),

    createMapPin: useCallback((ctx: MenuContext) => {
      if (!ctx.item || !ctx.activeMap) return

      toast.info('Create Pin Here... (coming soon)')
    }, []),

    removeMapPin: useCallback(
      async (ctx: MenuContext) => {
        if (!ctx.activePin) return

        try {
          if (!campaignId) return
          await convex.mutation(api.gameMaps.mutations.removeItemPin, {
            campaignId,
            mapPinId: ctx.activePin._id,
          })
          toast.success('Pin removed')
        } catch (error) {
          console.error('Failed to remove pin:', error)
          toast.error('Failed to remove pin')
        }
      },
      [convex, campaignId],
    ),

    togglePinVisibility: useCallback(
      async (ctx: MenuContext) => {
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
          console.error('Failed to toggle pin visibility:', error)
          toast.error('Failed to toggle pin visibility')
        }
      },
      [convex, campaignId],
    ),

    moveMapPin: useCallback((ctx: MenuContext) => {
      if (!ctx.activePin) return

      // Dispatch event to map viewer to enter pin move mode
      const event = new CustomEvent('map-pin-move-request', {
        detail: {
          pinId: ctx.activePin._id,
        },
      })
      window.dispatchEvent(event)
    }, []),

    startSession: useCallback(() => {
      if (!campaignId) return
      startNewSession.mutate(
        { campaignId },
        {
          onSuccess: () => toast.success('Session started'),
          onError: (error: unknown) => {
            console.error('Failed to start session:', error)
            toast.error('Failed to start session')
          },
        },
      )
    }, [campaignId, startNewSession]),

    endSession: useCallback(() => {
      if (!campaignId) return
      endCurrentSession.mutate(
        { campaignId },
        {
          onSuccess: () => toast.success('Session ended'),
          onError: (error) => {
            console.error('Failed to end session:', error)
            toast.error('Failed to end session')
          },
        },
      )
    }, [campaignId, endCurrentSession]),

    setGeneralAccessLevel: useCallback(
      async (ctx: MenuContext, level: PermissionLevel | null) => {
        if (!campaignId || !ctx.item) return

        try {
          await convex.mutation(
            api.sidebarShares.mutations.setAllPlayersPermission,
            {
              campaignId,
              sidebarItemId: ctx.item._id,
              permissionLevel: level,
            },
          )
          if (level === null) {
            toast.success('Reset to default access')
          } else if (level === PERMISSION_LEVEL.NONE) {
            toast.success('Access set to none')
          } else {
            toast.success(`Access set to ${level}`)
          }
        } catch (error) {
          console.error('Failed to set general access level:', error)
          toast.error('Failed to update access level')
        }
      },
      [campaignId, convex],
    ),

    downloadFile: useCallback((ctx: MenuContext) => {
      if (!ctx.item || !isFile(ctx.item)) return

      if (!ctx.item.downloadUrl) {
        toast.error('Download URL not available')
        return
      }

      try {
        const fileName = ctx.item.name
        const link = document.createElement('a')
        link.href = ctx.item.downloadUrl ?? ''
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Download started')
      } catch (error) {
        console.error('Failed to download file:', error)
        toast.error('Failed to download file')
      }
    }, []),

    downloadNote: useCallback(
      async (ctx: MenuContext) => {
        if (!ctx.item || !isNote(ctx.item)) return

        try {
          const fullItem = await convex.query(
            api.sidebarItems.queries.getSidebarItem,
            { id: ctx.item._id, campaignId: ctx.item.campaignId },
          )
          if (!fullItem || fullItem.type !== SIDEBAR_ITEM_TYPES.notes) {
            toast.error('Failed to load note content')
            return
          }

          const visibleContent = fullItem.content.filter((block) => {
            const meta = fullItem.blockMeta[block.id]
            if (!meta) return true
            return meta.myPermissionLevel !== PERMISSION_LEVEL.NONE
          })
          const markdown = convertBlocksToMarkdown(visibleContent)
          const baseName = ctx.item.name
          const fileName = baseName.endsWith('.md')
            ? baseName
            : `${baseName}.md`

          const blob = new Blob([markdown], { type: 'text/markdown' })
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = fileName
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(link.href)

          toast.success('Download started')
        } catch (error) {
          console.error('Failed to download note:', error)
          toast.error('Failed to download note')
        }
      },
      [convex],
    ),

    downloadMap: useCallback((ctx: MenuContext) => {
      if (!ctx.item || !isGameMap(ctx.item)) return

      if (!ctx.item.imageUrl) {
        toast.error('Map image URL not available')
        return
      }

      try {
        const mapName = ctx.item.name
        const link = document.createElement('a')
        link.href = ctx.item.imageUrl
        link.download = mapName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Download started')
      } catch (error) {
        console.error('Failed to download map:', error)
        toast.error('Failed to download map')
      }
    }, []),

    downloadFolder: useCallback(
      async (ctx: MenuContext) => {
        if (!ctx.item || !isFolder(ctx.item)) return

        const toastId = toast.loading('Preparing download...')

        try {
          if (!campaignId) {
            toast.dismiss(toastId)
            return
          }
          const { folderName, items } = await convex.query(
            api.folders.queries.getFolderContentsForDownload,
            { campaignId, folderId: ctx.item._id },
          )

          if (items.length === 0) {
            toast.dismiss(toastId)
            toast.info('Folder is empty')
            return
          }

          toast.loading('Downloading items...', { id: toastId })

          const zip = new JSZip()

          const downloadPromises: Array<Promise<void>> = items.map(
            async (item) => {
              try {
                switch (item.type) {
                  case SIDEBAR_ITEM_TYPES.files:
                  case SIDEBAR_ITEM_TYPES.gameMaps: {
                    if (!item.downloadUrl) {
                      console.warn(`No download URL for: ${item.path}`)
                      return
                    }
                    const response = await fetch(item.downloadUrl)
                    if (!response.ok) {
                      console.warn(`Failed to fetch: ${item.path}`)
                      return
                    }
                    const blob = await response.blob()
                    zip.file(item.path, blob)
                    break
                  }
                  case SIDEBAR_ITEM_TYPES.notes: {
                    const markdown = convertBlocksToMarkdown(item.content)
                    zip.file(item.path, markdown)
                    break
                  }
                  default:
                    assertNever(item)
                }
              } catch (error) {
                console.warn(`Failed to process: ${item.path}`, error)
              }
            },
          )

          await Promise.all(downloadPromises)

          toast.loading('Creating zip file...', { id: toastId })

          const zipBlob = await zip.generateAsync({ type: 'blob' })
          const zipFileName = `${folderName}.zip`

          const link = document.createElement('a')
          link.href = URL.createObjectURL(zipBlob)
          link.download = zipFileName
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(link.href)

          toast.dismiss(toastId)
          toast.success(`Downloaded ${items.length} item(s)`)
        } catch (error) {
          console.error('Failed to download folder:', error)
          toast.dismiss(toastId)
          toast.error('Failed to download folder')
        }
      },
      [convex, campaignId],
    ),

    downloadAll: useCallback(async () => {
      if (!campaignId) return

      const toastId = toast.loading('Preparing download...')

      try {
        const { items } = await convex.query(
          api.folders.queries.getRootContentsForDownload,
          { campaignId },
        )

        if (items.length === 0) {
          toast.dismiss(toastId)
          toast.info('No items to download')
          return
        }

        toast.loading('Downloading items...', { id: toastId })

        const zip = new JSZip()

        const downloadPromises = items.map(async (item) => {
          try {
            switch (item.type) {
              case SIDEBAR_ITEM_TYPES.files:
              case SIDEBAR_ITEM_TYPES.gameMaps: {
                if (!item.downloadUrl) {
                  console.warn(`No download URL for: ${item.path}`)
                  return
                }
                const response = await fetch(item.downloadUrl)
                if (!response.ok) {
                  console.warn(`Failed to fetch: ${item.path}`)
                  return
                }
                const blob = await response.blob()
                zip.file(item.path, blob)
                break
              }
              case SIDEBAR_ITEM_TYPES.notes: {
                const markdown = convertBlocksToMarkdown(item.content)
                zip.file(item.path, markdown)
                break
              }
              default:
                assertNever(item)
            }
          } catch (error) {
            console.warn(`Failed to process: ${item.path}`, error)
          }
        })

        await Promise.all(downloadPromises)

        toast.loading('Creating zip file...', { id: toastId })

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const zipFileName = 'campaign-export.zip'

        const link = document.createElement('a')
        link.href = URL.createObjectURL(zipBlob)
        link.download = zipFileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)

        toast.dismiss(toastId)
        toast.success(`Downloaded ${items.length} item(s)`)
      } catch (error) {
        console.error('Failed to download all items:', error)
        toast.dismiss(toastId)
        toast.error('Failed to download')
      }
    }, [convex, campaignId]),

    restore: useCallback(
      async (ctx: MenuContext) => {
        if (!ctx.item) return
        try {
          await moveItem(ctx.item, { deleted: false })
          toast.success('Item restored')
        } catch (error) {
          console.error(error)
          toast.error('Failed to restore item')
        }
      },
      [moveItem],
    ),

    permanentlyDelete: (ctx: MenuContext) => {
      if (!ctx.item) return
      setConfirmPermanentDeleteItem(ctx.item)
      onDialogOpen?.()
    },

    emptyTrash: () => {
      setConfirmEmptyTrash(true)
      onDialogOpen?.()
    },

    toggleBookmark: useCallback(
      (ctx: MenuContext) => {
        if (!campaignId || !ctx.item) return

        toggleBookmarkMutation
          .mutateAsync({
            campaignId,
            sidebarItemId: ctx.item._id,
          })
          .catch((error) => {
            console.error('Failed to toggle bookmark:', error)
            toast.error('Failed to toggle bookmark')
          })
      },
      [campaignId, toggleBookmarkMutation],
    ),
  }

  // Helper to close a dialog and notify the parent
  const closeDialog = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T | null>>) => {
      return () => {
        setter(null)
        onDialogClose?.()
      }
    },
    [onDialogClose],
  )

  const dialogsContent = useMemo(
    () => (
      <>
        {deleteFolderDialog && (
          <FolderDeleteConfirmDialog
            key={`delete-folder-${deleteFolderDialog._id}`}
            folder={deleteFolderDialog}
            isDeleting={true}
            onConfirm={() => {
              const current = getSelectedTypeAndSlug()
              if (
                current &&
                deleteFolderDialog.type === current.type &&
                deleteFolderDialog.slug === current.slug
              ) {
                clearEditorContent()
              }
            }}
            onClose={closeDialog(setDeleteFolderDialog)}
          />
        )}

        {editMapDialog && campaignId && (
          <MapDialog
            key={`edit-map-${editMapDialog}`}
            mapId={editMapDialog}
            isOpen={true}
            onClose={closeDialog(setEditMapDialog)}
            campaignId={campaignId}
          />
        )}

        {editFileDialog && campaignId && (
          <FileDialog
            key={`edit-file-${editFileDialog}`}
            fileId={editFileDialog}
            isOpen={true}
            onClose={closeDialog(setEditFileDialog)}
            campaignId={campaignId}
            onSuccess={closeDialog(setEditFileDialog)}
          />
        )}

        {editSidebarItemDialog && (
          <SidebarItemEditDialog
            key={`edit-sidebar-item-${editSidebarItemDialog._id}`}
            item={editSidebarItemDialog}
            isOpen={true}
            onClose={closeDialog(setEditSidebarItemDialog)}
          />
        )}

        {confirmEmptyTrash && (
          <ConfirmationDialog
            key="empty-trash"
            isOpen={true}
            onClose={() => {
              setConfirmEmptyTrash(false)
              onDialogClose?.()
            }}
            onConfirm={async () => {
              if (!campaignId) return
              try {
                await emptyTrashBin()
                toast.success('Trash emptied')
              } catch (error) {
                console.error(error)
                toast.error('Failed to empty trash')
              } finally {
                setConfirmEmptyTrash(false)
                onDialogClose?.()
              }
            }}
            title="Empty Trash"
            description={`Are you sure you want to permanently delete ${allTrashedItems.length === 1 ? '1 item' : `all ${allTrashedItems.length} items`} in the trash? This action cannot be undone.`}
            confirmLabel="Empty Trash"
            confirmVariant="destructive"
          />
        )}

        {confirmPermanentDeleteItem && (
          <ConfirmationDialog
            key={`permanent-delete-${confirmPermanentDeleteItem._id}`}
            isOpen={true}
            onClose={closeDialog(setConfirmPermanentDeleteItem)}
            onConfirm={async () => {
              try {
                await permanentlyDeleteItem(confirmPermanentDeleteItem)
                toast.success('Item permanently deleted')
                const current = getSelectedTypeAndSlug()
                if (
                  current &&
                  confirmPermanentDeleteItem.type === current.type &&
                  confirmPermanentDeleteItem.slug === current.slug
                ) {
                  clearEditorContent()
                }
              } catch (error) {
                console.error(error)
                toast.error('Failed to delete item')
              } finally {
                setConfirmPermanentDeleteItem(null)
                onDialogClose?.()
              }
            }}
            title="Permanently Delete"
            description={(() => {
              const descendantCount = isFolder(confirmPermanentDeleteItem)
                ? getDescendantCount(
                    confirmPermanentDeleteItem._id,
                    trashedParentItemsMap,
                  )
                : 0
              const base = `Are you sure you want to permanently delete "${confirmPermanentDeleteItem.name}"?`
              const detail =
                descendantCount > 0
                  ? ` This will also delete ${descendantCount} ${descendantCount === 1 ? 'item' : 'items'} inside it.`
                  : ''
              return `${base}${detail} This action cannot be undone.`
            })()}
            confirmLabel="Delete Forever"
            confirmVariant="destructive"
          />
        )}
      </>
    ),
    [
      deleteFolderDialog,
      editMapDialog,
      editFileDialog,
      editSidebarItemDialog,
      confirmPermanentDeleteItem,
      confirmEmptyTrash,
      allTrashedItems,
      trashedParentItemsMap,
      campaignId,
      clearEditorContent,
      closeDialog,
      permanentlyDeleteItem,
      onDialogClose,
      emptyTrashBin,
    ],
  )

  return {
    actions,
    Dialogs: dialogsContent,
  }
}
