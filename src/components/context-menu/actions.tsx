import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'
import type { MenuContext } from './types'
import type { ActionHandlers } from './menu-registry'
import type { Id } from 'convex/_generated/dataModel'
import type { Tag, TagCategory } from 'convex/tags/types'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useCampaign } from '~/hooks/useCampaign'
import {
  isFolder,
  isGameMap,
  isNote,
  isTag,
  isTagCategory,
} from '~/lib/sidebar-item-utils'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import CharacterTagDialog from '~/components/forms/category-tag-form/character-tag-form/character-tag-dialog'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { CategoryDialog } from '~/components/forms/category-form/category-dialog'
import { NoteDeleteConfirmDialog } from '~/components/dialogs/delete/note-delete-confirm-dialog'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useSession } from '~/hooks/useSession'

export function useMenuActions() {
  const {
    navigateToCategory,
    navigateToItem,
    navigateToMap,
    navigateToItemAndPage,
    clearEditorContent,
  } = useEditorNavigation()
  const { setRenamingId } = useFileSidebar()
  const { openParentFolders } = useOpenParentFolders()
  const { createNote } = useNoteActions()
  const { createFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const campaign = campaignWithMembership.data?.campaign
  const convex = useConvex()
  const { item: currentItem } = useCurrentItem()
  const { endCurrentSession, startNewSession } = useSession()

  const [deleteNoteDialog, setDeleteNoteDialog] = useState<Note | null>(null)
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<Folder | null>(
    null,
  )
  const [deleteTagDialog, setDeleteTagDialog] = useState<{
    tag: Tag
    category: TagCategory
  } | null>(null)
  const [deleteMapDialog, setDeleteMapDialog] = useState<GameMap | null>(null)
  const [createTagDialog, setCreateTagDialog] = useState<{
    category: TagCategory
    parentId?: SidebarItemId
  } | null>(null)
  const [createMapDialog, setCreateMapDialog] = useState<{
    parentId?: SidebarItemId
    navigateToParent?: boolean
    parentItem?: AnySidebarItem
  } | null>(null)
  const [createCategoryDialog, setCreateCategoryDialog] = useState(false)
  const [editMapDialog, setEditMapDialog] = useState<Id<'gameMaps'> | null>(
    null,
  )
  const [editCategoryDialog, setEditCategoryDialog] =
    useState<TagCategory | null>(null)
  const [editTagDialog, setEditTagDialog] = useState<{
    tag: Tag
    category: TagCategory
    parentId?: SidebarItemId
  } | null>(null)

  const handleCreatePageMapSuccess = useCallback(
    async (
      mapSlug: string | undefined,
      parentId: SidebarItemId | undefined,
      parentItem: AnySidebarItem | undefined,
    ) => {
      if (parentId) {
        await openParentFolders(parentId)
      }
      if (parentItem && mapSlug) {
        navigateToItemAndPage(parentItem, mapSlug)
      }
    },
    [openParentFolders, navigateToItemAndPage],
  )

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
      } else if (isTag(item) && ctx.category) {
        setDeleteTagDialog({
          tag: item,
          category: ctx.category,
        })
      } else if (isGameMap(item)) {
        setDeleteMapDialog(item)
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
          categoryId: ctx.category?._id,
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
          categoryId: ctx.category?._id,
        })
        await openParentFolders(result.folderId)
        setRenamingId(result.folderId)
      },
      [campaignId, createFolder, openParentFolders, setRenamingId],
    ),

    createTag: (ctx: MenuContext) => {
      if (!ctx.category) return
      setCreateTagDialog({
        category: ctx.category,
        parentId: ctx.item?._id,
      })
    },

    createMap: (ctx: MenuContext) => {
      setCreateMapDialog({ parentId: ctx.item?._id })
    },

    createPageNote: useCallback(
      async (ctx: MenuContext) => {
        if (!campaignId || !ctx.item) return

        const parentId = ctx.item._id
        const { noteId, slug } = await createNote.mutateAsync({
          campaignId,
          parentId,
          categoryId: ctx.category?._id,
        })

        await openParentFolders(noteId)

        navigateToItemAndPage(ctx.item, slug)

        setRenamingId(noteId)
      },
      [
        campaignId,
        createNote,
        openParentFolders,
        navigateToItemAndPage,
        setRenamingId,
      ],
    ),

    createPageMap: useCallback((ctx: MenuContext) => {
      if (!ctx.item) return
      const parentId = ctx.item._id
      setCreateMapDialog({
        parentId,
        navigateToParent: true,
        parentItem: ctx.item,
      })
    }, []),

    createCanvas: () => {
      toast.error('Canvas not implemented')
    },

    createCategory: () => {
      setCreateCategoryDialog(true)
    },

    goToCategory: useCallback(
      (ctx: MenuContext) => {
        if (ctx.category?.slug) {
          navigateToCategory(ctx.category.slug)
        }
      },
      [navigateToCategory],
    ),

    editCategory: (ctx: MenuContext) => {
      if (isTagCategory(ctx.item)) {
        setEditCategoryDialog(ctx.item)
      }
    },

    editMap: (ctx: MenuContext) => {
      if (isGameMap(ctx.item)) {
        setEditMapDialog(ctx.item._id)
      }
    },

    editTag: (ctx: MenuContext) => {
      if (isTag(ctx.item) && ctx.category) {
        setEditTagDialog({
          tag: ctx.item,
          category: ctx.category,
          parentId: ctx.item._id,
        })
      }
    },

    pinToMap: useCallback((ctx: MenuContext) => {
      if (!ctx.item || !ctx.activeMapId) return

      // Check if already pinned using context data
      if (ctx.pinnedItemIds?.has(ctx.item._id)) {
        toast.error('Item is already pinned on this map')
        return
      }

      // Dispatch event to map viewer to enter pin placement mode
      // Icon and color will be determined from the item when placing the pin
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

    startSession: useCallback(
      (ctx: MenuContext) => {
        if (!campaignId || !ctx.category) return

        // Start new session
        const now = new Date()
        startNewSession({
          color: '#6366F1',
          description: now.toISOString(),
          parentId: ctx.item?._id,
        })
        toast.success('Session started')
      },
      [campaignId, startNewSession],
    ),

    endSession: useCallback(() => {
      if (!campaignId) return

      // End current session
      endCurrentSession.mutate({ campaignId })
      toast.success('Session ended')
    }, [campaignId, endCurrentSession]),
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

        {deleteTagDialog && (
          <TagDeleteConfirmDialog
            key={`delete-tag-${deleteTagDialog.tag._id}`}
            tag={deleteTagDialog.tag}
            isDeleting={true}
            onConfirm={() => {
              if (currentItem?._id === deleteTagDialog.tag._id) {
                clearEditorContent()
              }
            }}
            onClose={() => setDeleteTagDialog(null)}
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

        {createTagDialog &&
          (() => {
            const { category, parentId } = createTagDialog
            const categorySlug = category.slug
            const dialogKey = `create-tag-${category._id}-${parentId || 'root'}`

            if (
              campaignId &&
              categorySlug === SYSTEM_DEFAULT_CATEGORIES.Character.slug
            ) {
              return (
                <CharacterTagDialog
                  key={dialogKey}
                  mode="create"
                  isOpen={true}
                  onClose={() => setCreateTagDialog(null)}
                  campaignId={campaignId}
                  categoryId={category._id}
                  parentId={parentId}
                />
              )
            }

            if (
              campaignId &&
              categorySlug === SYSTEM_DEFAULT_CATEGORIES.Location.slug
            ) {
              return (
                <LocationTagDialog
                  key={dialogKey}
                  mode="create"
                  isOpen={true}
                  onClose={() => setCreateTagDialog(null)}
                  campaignId={campaignId}
                  categoryId={category._id}
                  parentId={parentId}
                />
              )
            }

            // for other categories, use generic dialog
            if (campaignId) {
              return (
                <GenericTagDialog
                  key={dialogKey}
                  mode="create"
                  isOpen={true}
                  onClose={() => setCreateTagDialog(null)}
                  campaignId={campaignId}
                  categoryId={category._id}
                  parentId={parentId}
                />
              )
            }
          })()}

        {createMapDialog && campaignId && (
          <MapDialog
            key={`create-map-${createMapDialog.parentId || 'root'}`}
            isOpen={true}
            onClose={() => setCreateMapDialog(null)}
            campaignId={campaignId}
            parentId={createMapDialog.parentId}
            onSuccess={
              createMapDialog.navigateToParent && createMapDialog.parentItem
                ? (mapSlug) =>
                    handleCreatePageMapSuccess(
                      mapSlug,
                      createMapDialog.parentId,
                      createMapDialog.parentItem,
                    )
                : undefined
            }
          />
        )}

        {createCategoryDialog && campaign && (
          <CategoryDialog
            key="create-category"
            mode="create"
            isOpen={true}
            onClose={() => setCreateCategoryDialog(false)}
            campaignId={campaign._id}
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

        {editCategoryDialog && campaign && (
          <CategoryDialog
            key={`edit-category-${editCategoryDialog._id}`}
            mode="edit"
            isOpen={true}
            onClose={() => setEditCategoryDialog(null)}
            category={editCategoryDialog}
            onSuccess={() => setEditCategoryDialog(null)}
          />
        )}

        {editTagDialog &&
          (() => {
            const { category, tag, parentId } = editTagDialog
            const categorySlug = category.slug
            const dialogKey = `edit-tag-${tag._id}`

            if (
              campaignId &&
              categorySlug === SYSTEM_DEFAULT_CATEGORIES.Character.slug
            ) {
              return (
                <CharacterTagDialog
                  key={dialogKey}
                  mode="edit"
                  isOpen={true}
                  onClose={() => setEditTagDialog(null)}
                  campaignId={campaignId}
                  categoryId={category._id}
                  parentId={parentId}
                  tag={tag as any}
                />
              )
            }

            if (
              campaignId &&
              categorySlug === SYSTEM_DEFAULT_CATEGORIES.Location.slug
            ) {
              return (
                <LocationTagDialog
                  key={dialogKey}
                  mode="edit"
                  isOpen={true}
                  onClose={() => setEditTagDialog(null)}
                  campaignId={campaignId}
                  categoryId={category._id}
                  parentId={parentId}
                  tag={tag as any}
                />
              )
            }

            // for other categories, use generic dialog
            if (campaignId) {
              return (
                <GenericTagDialog
                  key={dialogKey}
                  mode="edit"
                  isOpen={true}
                  onClose={() => setEditTagDialog(null)}
                  campaignId={campaignId}
                  categoryId={category._id}
                  parentId={parentId}
                  tag={tag}
                />
              )
            }
          })()}
      </>
    ),
    [
      deleteNoteDialog,
      deleteFolderDialog,
      deleteTagDialog,
      deleteMapDialog,
      createTagDialog,
      createMapDialog,
      createCategoryDialog,
      editMapDialog,
      editCategoryDialog,
      editTagDialog,
      campaignId,
      campaign,
      currentItem,
      clearEditorContent,
      handleCreatePageMapSuccess,
    ],
  )

  // Return Dialogs as a stable component function
  const Dialogs = useCallback(() => dialogsContent, [dialogsContent])

  return {
    actions,
    Dialogs,
  }
}
