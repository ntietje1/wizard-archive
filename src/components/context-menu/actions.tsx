import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConvex } from '@convex-dev/react-query'
import JSZip from 'jszip'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { FileDeleteConfirmDialog } from '../dialogs/delete/file-delete-confirm-dialog'
import type { MenuContext } from './types'
import type { ActionHandlers } from './menu-registry'
import type { PermissionLevel } from 'convex/shares/types'
import type { Id } from 'convex/_generated/dataModel'
import type { Note } from 'convex/notes/types'
import type { DownloadableItem, Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { File } from 'convex/files/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useCampaign } from '~/hooks/useCampaign'
import { useToggleBookmark } from '~/hooks/useBookmarks'
import { isFile, isFolder, isGameMap, isNote } from '~/lib/sidebar-item-utils'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { FileDialog } from '~/components/forms/file-form/file-dialog'
import { SidebarItemEditDialog } from '~/components/forms/sidebar-item-form/sidebar-item-edit-dialog'
import { NoteDeleteConfirmDialog } from '~/components/dialogs/delete/note-delete-confirm-dialog'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useSession } from '~/hooks/useSession'
import { convertBlocksToMarkdown } from '~/lib/text-to-blocks'

interface UseMenuActionsOptions {
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export function useMenuActions(options: UseMenuActionsOptions = {}) {
  const { onDialogOpen, onDialogClose } = options
  const { navigateToItem, navigateToMap, clearEditorContent } =
    useEditorNavigation()
  const { setRenamingId } = useFileSidebar()
  const { openParentFolders } = useOpenParentFolders()
  const { createNote } = useNoteActions()
  const { createFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const convex = useConvex()
  const { item: currentItem } = useCurrentItem()
  const { endCurrentSession, startNewSession } = useSession()
  const toggleBookmarkMutation = useToggleBookmark()

  const [deleteNoteDialog, setDeleteNoteDialog] = useState<Note | null>(null)
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<Folder | null>(
    null,
  )
  const [deleteMapDialog, setDeleteMapDialog] = useState<GameMap | null>(null)
  const [createMapDialog, setCreateMapDialog] = useState<{
    parentId?: Id<'folders'>
  } | null>(null)
  const [createFileDialog, setCreateFileDialog] = useState<{
    parentId?: Id<'folders'>
  } | null>(null)
  const [deleteFileDialog, setDeleteFileDialog] = useState<File | null>(null)
  const [editMapDialog, setEditMapDialog] = useState<Id<'gameMaps'> | null>(
    null,
  )
  const [editFileDialog, setEditFileDialog] = useState<Id<'files'> | null>(null)
  const [editSidebarItemDialog, setEditSidebarItemDialog] =
    useState<AnySidebarItem | null>(null)

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
      if (isNote(item)) {
        setDeleteNoteDialog(item)
        onDialogOpen?.()
      } else if (isFolder(item)) {
        setDeleteFolderDialog(item)
        onDialogOpen?.()
      } else if (isGameMap(item)) {
        setDeleteMapDialog(item)
        onDialogOpen?.()
      } else if (isFile(item)) {
        setDeleteFileDialog(item)
        onDialogOpen?.()
      }
    },

    showInSidebar: useCallback(
      async (ctx: MenuContext) => {
        if (!ctx.item) return
        await openParentFolders(ctx.item._id)
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
        const parentId = ctx.item?._id
        const { noteId } = await createNote.mutateAsync({
          campaignId,
          parentId,
        })
        await openParentFolders(noteId)
        setRenamingId(noteId)
      },
      [campaignId, createNote, openParentFolders, setRenamingId],
    ),

    createFolder: useCallback(
      async (ctx: MenuContext) => {
        if (!campaignId) return

        if (ctx.item && !isFolder(ctx.item)) {
          console.error('Invalid parent type')
          return
        }
        const parentId = ctx.item?._id
        const result = await createFolder.mutateAsync({
          campaignId,
          parentId,
        })
        await openParentFolders(result.folderId)
        setRenamingId(result.folderId)
      },
      [campaignId, createFolder, openParentFolders, setRenamingId],
    ),

    createMap: (ctx: MenuContext) => {
      if (ctx.item && !isFolder(ctx.item)) {
        console.error('Invalid parent type')
        return
      }
      setCreateMapDialog({ parentId: ctx.item?._id })
      onDialogOpen?.()
    },

    createFile: (ctx: MenuContext) => {
      if (ctx.item && !isFolder(ctx.item)) {
        console.error('Invalid parent type')
        return
      }
      setCreateFileDialog({ parentId: ctx.item?._id })
      onDialogOpen?.()
    },

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
          await convex.mutation(api.gameMaps.mutations.removeItemPin, {
            mapPinId: ctx.activePin._id,
          })
          toast.success('Pin removed')
        } catch (error) {
          console.error('Failed to remove pin:', error)
          toast.error('Failed to remove pin')
        }
      },
      [convex],
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

      // Start new session
      startNewSession({})
      toast.success('Session started')
    }, [campaignId, startNewSession]),

    endSession: useCallback(() => {
      if (!campaignId) return

      // End current session
      endCurrentSession.mutate({ campaignId })
      toast.success('Session ended')
    }, [campaignId, endCurrentSession]),

    setGeneralAccessLevel: useCallback(
      async (ctx: MenuContext, level: PermissionLevel | undefined) => {
        if (!campaignId || !ctx.item) return

        try {
          await convex.mutation(api.shares.mutations.setAllPlayersPermission, {
            campaignId,
            sidebarItemId: ctx.item._id,
            permissionLevel: level,
          })
          if (level === undefined) {
            toast.success('Reset to default access')
          } else if (level === 'none') {
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
        const fileName = ctx.item.name ?? defaultItemName(ctx.item)
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

    downloadNote: useCallback((ctx: MenuContext) => {
      if (!ctx.item || !isNote(ctx.item)) return

      try {
        const markdown = convertBlocksToMarkdown(ctx.item.content)
        const baseName = ctx.item.name ?? defaultItemName(ctx.item)
        const fileName = baseName.endsWith('.md') ? baseName : `${baseName}.md`

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
    }, []),

    downloadMap: useCallback((ctx: MenuContext) => {
      if (!ctx.item || !isGameMap(ctx.item)) return

      if (!ctx.item.imageUrl) {
        toast.error('Map image URL not available')
        return
      }

      try {
        const mapName = ctx.item.name ?? defaultItemName(ctx.item)
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
          const { folderName, items } = await convex.query(
            api.folders.queries.getFolderContentsForDownload,
            { folderId: ctx.item._id },
          )

          if (items.length === 0) {
            toast.dismiss(toastId)
            toast.info('Folder is empty')
            return
          }

          toast.loading('Downloading items...', { id: toastId })

          const zip = new JSZip()

          const downloadPromises = items.map(async (item: DownloadableItem) => {
            try {
              if (
                item.type === SIDEBAR_ITEM_TYPES.files ||
                item.type === SIDEBAR_ITEM_TYPES.gameMaps
              ) {
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
              } else if (item.type === SIDEBAR_ITEM_TYPES.notes) {
                const markdown = convertBlocksToMarkdown(item.content)
                zip.file(item.path, markdown)
              } else {
                console.warn(`Unknown item type`, item)
                return
              }
            } catch (error) {
              console.warn(`Failed to process: ${item.path}`, error)
            }
          })

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
      [convex],
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

        const downloadPromises = items.map(async (item: DownloadableItem) => {
          try {
            if (
              item.type === SIDEBAR_ITEM_TYPES.files ||
              item.type === SIDEBAR_ITEM_TYPES.gameMaps
            ) {
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
            } else if (item.type === SIDEBAR_ITEM_TYPES.notes) {
              const markdown = convertBlocksToMarkdown(item.content)
              zip.file(item.path, markdown)
            } else {
              console.warn(`Unknown item type`, item)
              return
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

    toggleBookmark: useCallback(
      (ctx: MenuContext) => {
        if (!campaignId || !ctx.item) return

        toggleBookmarkMutation
          .mutateAsync({
            campaignId,
            sidebarItemId: ctx.item._id,
            sidebarItemType: ctx.item.type,
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
        {deleteNoteDialog && (
          <NoteDeleteConfirmDialog
            key={`delete-note-${deleteNoteDialog._id}`}
            note={deleteNoteDialog}
            isDeleting={true}
            onConfirm={() => {
              if (currentItem?._id === deleteNoteDialog._id) {
                clearEditorContent()
              }
            }}
            onClose={closeDialog(setDeleteNoteDialog)}
          />
        )}

        {deleteFolderDialog && (
          <FolderDeleteConfirmDialog
            key={`delete-folder-${deleteFolderDialog._id}`}
            folder={deleteFolderDialog}
            isDeleting={true}
            onConfirm={() => {
              if (currentItem?._id === deleteFolderDialog._id) {
                clearEditorContent()
              }
            }}
            onClose={closeDialog(setDeleteFolderDialog)}
          />
        )}

        {deleteMapDialog && (
          <MapDeleteConfirmDialog
            key={`delete-map-${deleteMapDialog._id}`}
            map={deleteMapDialog}
            isDeleting={true}
            onConfirm={() => {
              if (currentItem?._id === deleteMapDialog._id) {
                clearEditorContent()
              }
            }}
            onClose={closeDialog(setDeleteMapDialog)}
          />
        )}

        {deleteFileDialog && (
          <FileDeleteConfirmDialog
            key={`delete-file-${deleteFileDialog._id}`}
            file={deleteFileDialog}
            isDeleting={true}
            onConfirm={() => {
              if (currentItem?._id === deleteFileDialog._id) {
                clearEditorContent()
              }
            }}
            onClose={closeDialog(setDeleteFileDialog)}
          />
        )}

        {createMapDialog && campaignId && (
          <MapDialog
            key={`create-map-${createMapDialog.parentId || 'root'}`}
            isOpen={true}
            onClose={closeDialog(setCreateMapDialog)}
            campaignId={campaignId}
            parentId={createMapDialog.parentId}
          />
        )}

        {createFileDialog && campaignId && (
          <FileDialog
            key={`create-file-${createFileDialog.parentId || 'root'}`}
            isOpen={true}
            onClose={closeDialog(setCreateFileDialog)}
            campaignId={campaignId}
            parentId={createFileDialog.parentId}
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
      </>
    ),
    [
      deleteNoteDialog,
      deleteFolderDialog,
      deleteMapDialog,
      createMapDialog,
      editMapDialog,
      editFileDialog,
      editSidebarItemDialog,
      campaignId,
      currentItem,
      clearEditorContent,
      createFileDialog,
      deleteFileDialog,
      closeDialog,
    ],
  )

  // Return Dialogs as a stable component function
  const Dialogs = useCallback(() => dialogsContent, [dialogsContent])

  return {
    actions,
    Dialogs,
  }
}
