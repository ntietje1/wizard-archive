import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_SHARE_STATUS } from 'convex/sidebarItems/types'
import { FileDeleteConfirmDialog } from '../dialogs/delete/file-delete-confirm-dialog'
import type { MenuContext } from './types'
import type { ActionHandlers } from './menu-registry'
import type { Id } from 'convex/_generated/dataModel'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { File } from 'convex/files/types'
import type { SidebarItemType } from 'convex/sidebarItems/types'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useCampaign } from '~/hooks/useCampaign'
import { isFile, isFolder, isGameMap, isNote } from '~/lib/sidebar-item-utils'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { FileDialog } from '~/components/forms/file-form/file-dialog'
import { NoteDeleteConfirmDialog } from '~/components/dialogs/delete/note-delete-confirm-dialog'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useSession } from '~/hooks/useSession'

export function useMenuActions() {
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

  const [deleteNoteDialog, setDeleteNoteDialog] = useState<Note | null>(null)
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<Folder | null>(
    null,
  )
  const [deleteMapDialog, setDeleteMapDialog] = useState<GameMap | null>(null)
  const [createMapDialog, setCreateMapDialog] = useState<{
    parentId?: Id<'folders'> | Id<'notes'> | Id<'gameMaps'> | Id<'files'>
  } | null>(null)
  const [createFileDialog, setCreateFileDialog] = useState<{
    parentId?: Id<'folders'> | Id<'notes'> | Id<'gameMaps'> | Id<'files'>
  } | null>(null)
  const [deleteFileDialog, setDeleteFileDialog] = useState<File | null>(null)
  const [editMapDialog, setEditMapDialog] = useState<Id<'gameMaps'> | null>(
    null,
  )
  const [editFileDialog, setEditFileDialog] = useState<Id<'files'> | null>(null)

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
      } else if (isFolder(item)) {
        setDeleteFolderDialog(item)
      } else if (isGameMap(item)) {
        setDeleteMapDialog(item)
      } else if (isFile(item)) {
        setDeleteFileDialog(item)
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
      setCreateMapDialog({ parentId: ctx.item?._id })
    },

    createFile: (ctx: MenuContext) => {
      setCreateFileDialog({ parentId: ctx.item?._id })
    },

    createCanvas: () => {
      toast.error('Canvas not implemented')
    },

    editMap: (ctx: MenuContext) => {
      if (isGameMap(ctx.item)) {
        setEditMapDialog(ctx.item._id)
      }
    },

    editFile: (ctx: MenuContext) => {
      if (isFile(ctx.item)) {
        setEditFileDialog(ctx.item._id)
      }
    },

    editItem: (_ctx: MenuContext) => {
      // For now, this is a no-op. Could be extended to edit notes
      toast.info('Edit functionality coming soon')
    },

    pinToMap: useCallback((ctx: MenuContext) => {
      if (!ctx.item || !ctx.activeMapId) return

      // Check if already pinned using context data
      if (ctx.pinnedItemIds?.has(ctx.item._id)) {
        toast.error('Item is already pinned on this map')
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
      async (ctx: MenuContext) => {
        if (!ctx.item || !ctx.activeMapId) return

        // Check if pinned using context data
        if (!ctx.pinnedItemIds?.has(ctx.item._id)) {
          toast.error('Item is not pinned on this map')
          return
        }

        try {
          // Navigate to the map
          const map = await convex.query(api.gameMaps.queries.getMap, {
            mapId: ctx.activeMapId as Id<'gameMaps'>,
          })
          navigateToMap(map.slug)
        } catch (error) {
          console.error('Failed to navigate to map pin:', error)
          toast.error('Failed to navigate to map pin')
        }
      },
      [convex, navigateToMap],
    ),

    removeMapPin: useCallback(
      async (ctx: MenuContext) => {
        if (!ctx.pinId) return

        try {
          await convex.mutation(api.gameMaps.mutations.removeItemPin, {
            mapPinId: ctx.pinId,
          })
          toast.success('Pin removed')
        } catch (error) {
          console.error('Failed to remove pin:', error)
          toast.error('Failed to remove pin')
        }
      },
      [convex],
    ),

    moveMapPin: useCallback(() => {
      // For now, just show a toast. In the future, this could enable drag mode
      toast.info('Move pin not yet implemented')
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

    toggleShareWithAll: useCallback(
      async (ctx: MenuContext) => {
        if (!campaignId || !ctx.item || !ctx.shareState) return

        const { shareStatus, playerMembers } = ctx.shareState

        try {
          // all_shared -> not_shared
          // individually_shared -> not_shared
          if (
            shareStatus === SIDEBAR_ITEM_SHARE_STATUS.ALL_SHARED ||
            shareStatus === SIDEBAR_ITEM_SHARE_STATUS.INDIVIDUALLY_SHARED
          ) {
            await convex.mutation(
              api.shares.mutations.setSidebarItemShareStatus,
              {
                campaignId,
                sidebarItemId: ctx.item._id,
                status: SIDEBAR_ITEM_SHARE_STATUS.NOT_SHARED,
              },
            )
            toast.success('Unshared from all players')
          } else {
            // not_shared -> all_shared
            await convex.mutation(
              api.shares.mutations.setSidebarItemShareStatus,
              {
                campaignId,
                sidebarItemId: ctx.item._id,
                status: SIDEBAR_ITEM_SHARE_STATUS.ALL_SHARED,
              },
            )
            toast.success(`Shared with ${playerMembers.length} player(s)`)
          }
        } catch (error) {
          console.error('Failed to toggle share:', error)
          toast.error('Failed to toggle share')
        }
      },
      [campaignId, convex],
    ),

    toggleShareWithMember: useCallback(
      async (ctx: MenuContext, memberId: Id<'campaignMembers'>) => {
        if (!campaignId || !ctx.item || !ctx.shareState) return

        const { shareStatus, sharedMemberIds } = ctx.shareState

        // Determine if currently shared with this member
        const isCurrentlyShared =
          shareStatus === SIDEBAR_ITEM_SHARE_STATUS.ALL_SHARED ||
          (shareStatus === SIDEBAR_ITEM_SHARE_STATUS.INDIVIDUALLY_SHARED &&
            sharedMemberIds.has(memberId))

        try {
          if (isCurrentlyShared) {
            await convex.mutation(api.shares.mutations.unshareSidebarItem, {
              campaignId,
              sidebarItemId: ctx.item._id,
              campaignMemberId: memberId,
            })
            toast.success('Unshared from player')
          } else {
            await convex.mutation(api.shares.mutations.shareSidebarItem, {
              campaignId,
              sidebarItemId: ctx.item._id,
              sidebarItemType: ctx.item.type,
              campaignMemberId: memberId,
            })
            toast.success('Shared with player')
          }
        } catch (error) {
          console.error('Failed to toggle individual share:', error)
          toast.error('Failed to toggle share')
        }
      },
      [campaignId, convex],
    ),
  }

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
            onClose={() => setDeleteNoteDialog(null)}
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
            onClose={() => setDeleteFolderDialog(null)}
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
            onClose={() => setDeleteMapDialog(null)}
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
            onClose={() => setDeleteFileDialog(null)}
          />
        )}

        {createMapDialog && campaignId && (
          <MapDialog
            key={`create-map-${createMapDialog.parentId || 'root'}`}
            isOpen={true}
            onClose={() => setCreateMapDialog(null)}
            campaignId={campaignId}
            parentId={createMapDialog.parentId}
          />
        )}

        {createFileDialog && campaignId && (
          <FileDialog
            key={`create-file-${createFileDialog.parentId || 'root'}`}
            isOpen={true}
            onClose={() => setCreateFileDialog(null)}
            campaignId={campaignId}
            parentId={createFileDialog.parentId}
          />
        )}

        {editMapDialog && campaignId && (
          <MapDialog
            key={`edit-map-${editMapDialog}`}
            mapId={editMapDialog}
            isOpen={true}
            onClose={() => setEditMapDialog(null)}
            campaignId={campaignId}
          />
        )}

        {editFileDialog && campaignId && (
          <FileDialog
            key={`edit-file-${editFileDialog}`}
            fileId={editFileDialog}
            isOpen={true}
            onClose={() => setEditFileDialog(null)}
            campaignId={campaignId}
            onSuccess={() => setEditFileDialog(null)}
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
      campaignId,
      currentItem,
      clearEditorContent,
      createFileDialog,
      deleteFileDialog,
    ],
  )

  // Return Dialogs as a stable component function
  const Dialogs = useCallback(() => dialogsContent, [dialogsContent])

  return {
    actions,
    Dialogs,
  }
}
