import { useCallback, useState, useMemo } from 'react'
import type { MenuContext } from './types'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useCampaign } from '~/contexts/CampaignContext'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import {
  isNote,
  isFolder,
  isTag,
  isGameMap,
  isTagCategory,
} from '~/lib/sidebar-item-utils'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import CharacterTagDialog from '~/components/forms/category-tag-form/character-tag-form/character-tag-dialog'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { CategoryDialog } from '~/components/forms/category-form/category-dialog'
import {
  SYSTEM_DEFAULT_CATEGORIES,
  type Tag,
  type TagCategory,
} from 'convex/tags/types'
import { NoteDeleteConfirmDialog } from '~/components/dialogs/delete/note-delete-confirm-dialog'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import { createConfig } from '~/components/forms/category-tag-form/generic-tag-form/types'
import type { ActionHandlers } from './menu-registry'

export function useMenuActions() {
  const { navigateToCategory, navigateToItem, navigateToMap } =
    useEditorNavigation()
  const { setRenamingId } = useFileSidebar()
  const { openParentFolders } = useOpenParentFolders()
  const { createNote } = useNoteActions()
  const { createFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const campaign = campaignWithMembership?.data?.campaign
  const convex = useConvex()

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
  } | null>(null)

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
        })
      }
    },

    pinToMap: useCallback(async (ctx: MenuContext) => {
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
  }

  const dialogsContent = useMemo(
    () => (
      <>
        {deleteNoteDialog && (
          <NoteDeleteConfirmDialog
            key={`delete-note-${deleteNoteDialog._id}`}
            note={deleteNoteDialog}
            isDeleting={true}
            onClose={() => setDeleteNoteDialog(null)}
          />
        )}

        {deleteFolderDialog && (
          <FolderDeleteConfirmDialog
            key={`delete-folder-${deleteFolderDialog._id}`}
            folder={deleteFolderDialog}
            isDeleting={true}
            onClose={() => setDeleteFolderDialog(null)}
          />
        )}

        {deleteTagDialog && (
          <TagDeleteConfirmDialog
            key={`delete-tag-${deleteTagDialog.tag._id}`}
            tag={deleteTagDialog.tag}
            categoryConfig={createConfig(deleteTagDialog.category)}
            isDeleting={true}
            onClose={() => setDeleteTagDialog(null)}
          />
        )}

        {deleteMapDialog && (
          <MapDeleteConfirmDialog
            key={`delete-map-${deleteMapDialog._id}`}
            map={deleteMapDialog}
            isDeleting={true}
            onClose={() => setDeleteMapDialog(null)}
          />
        )}

        {createTagDialog &&
          (() => {
            const { category, parentId } = createTagDialog
            const categorySlug = category.slug
            const categoryConfig = createConfig(category)
            const dialogKey = `create-tag-${category._id}-${parentId || 'root'}`

            if (categorySlug === SYSTEM_DEFAULT_CATEGORIES.Character.slug) {
              return (
                <CharacterTagDialog
                  key={dialogKey}
                  mode="create"
                  isOpen={true}
                  onClose={() => setCreateTagDialog(null)}
                  config={categoryConfig}
                  parentId={parentId}
                />
              )
            }

            if (categorySlug === SYSTEM_DEFAULT_CATEGORIES.Location.slug) {
              return (
                <LocationTagDialog
                  key={dialogKey}
                  mode="create"
                  isOpen={true}
                  onClose={() => setCreateTagDialog(null)}
                  config={categoryConfig}
                  parentId={parentId}
                />
              )
            }

            // For sessions and other categories, use generic dialog TODO: add session one
            return (
              <GenericTagDialog
                key={dialogKey}
                mode="create"
                isOpen={true}
                onClose={() => setCreateTagDialog(null)}
                config={categoryConfig}
                parentId={parentId}
              />
            )
          })()}

        {createMapDialog && campaignId && (
          <MapDialog
            key={`create-map-${createMapDialog.parentId || 'root'}`}
            isOpen={true}
            onClose={() => setCreateMapDialog(null)}
            campaignId={campaignId}
            parentId={createMapDialog.parentId}
          />
        )}

        {createCategoryDialog && campaign && (
          <CategoryDialog
            key="create-category"
            mode="create"
            isOpen={true}
            onClose={() => setCreateCategoryDialog(false)}
            onSuccess={() => setCreateCategoryDialog(false)}
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
            const { category, tag } = editTagDialog
            const categorySlug = category.slug
            const categoryConfig = createConfig(category)
            const dialogKey = `edit-tag-${tag._id}`

            if (categorySlug === SYSTEM_DEFAULT_CATEGORIES.Character.slug) {
              return (
                <CharacterTagDialog
                  key={dialogKey}
                  mode="edit"
                  isOpen={true}
                  onClose={() => setEditTagDialog(null)}
                  config={categoryConfig}
                  tag={tag as any}
                />
              )
            }

            if (categorySlug === SYSTEM_DEFAULT_CATEGORIES.Location.slug) {
              return (
                <LocationTagDialog
                  key={dialogKey}
                  mode="edit"
                  isOpen={true}
                  onClose={() => setEditTagDialog(null)}
                  config={categoryConfig}
                  tag={tag as any}
                />
              )
            }

            // For sessions and other categories, use generic dialog
            return (
              <GenericTagDialog
                key={dialogKey}
                mode="edit"
                isOpen={true}
                onClose={() => setEditTagDialog(null)}
                config={categoryConfig}
                tag={tag}
              />
            )
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
    ],
  )

  // Return Dialogs as a stable component function
  const Dialogs = useCallback(() => dialogsContent, [dialogsContent])

  return {
    actions,
    Dialogs,
  }
}
