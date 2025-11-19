import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { forwardRef, useMemo } from 'react'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import type { Folder } from 'convex/notes/types'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import {
  useCategoryCreateItem,
  useCategoryNewFolder,
  useCategoryRenameFolder,
  useCategoryDeleteFolder,
  useCategoryNewMap,
} from '~/hooks/useCategoryContextMenu'
import { MapDialog } from '~/components/forms/map-form/map-dialog'

export interface CategoryContextMenuProps {
  children: React.ReactNode
  categoryConfig: TagCategoryConfig
  folder?: Folder
}

export const CategoryContextMenu = forwardRef<
  ContextMenuRef,
  CategoryContextMenuProps
>(({ children, categoryConfig, folder }, ref) => {
  const createItem = useCategoryCreateItem(categoryConfig, folder)
  const newFolder = useCategoryNewFolder(categoryConfig, folder)
  const newMap = useCategoryNewMap(categoryConfig, folder)
  const renameFolder = useCategoryRenameFolder(folder)
  const deleteFolder = useCategoryDeleteFolder(folder)

  const menuItems = useMemo(() => {
    const items = [createItem.menuItem, newFolder.menuItem]
    if (newMap.menuItem) {
      items.push(newMap.menuItem)
    }
    if (renameFolder.menuItem) {
      items.push(renameFolder.menuItem)
    }
    if (deleteFolder.menuItem) {
      items.push(deleteFolder.menuItem)
    }
    return items.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    )
  }, [
    createItem.menuItem,
    newFolder.menuItem,
    newMap.menuItem,
    renameFolder.menuItem,
    deleteFolder.menuItem,
  ])

  return (
    <>
      <ContextMenu ref={ref} items={menuItems} menuClassName="w-64">
        {children}
      </ContextMenu>

      <GenericTagDialog
        mode="create"
        isOpen={createItem.isDialogOpen}
        onClose={() => createItem.setIsDialogOpen(false)}
        config={categoryConfig}
        parentFolderId={folder?._id}
      />

      {folder && deleteFolder.menuItem && (
        <FolderDeleteConfirmDialog
          folder={folder}
          isDeleting={deleteFolder.isDialogOpen}
          onClose={() => deleteFolder.setIsDialogOpen(false)}
        />
      )}

      {newMap.campaignId && (
        <MapDialog
          isOpen={newMap.isDialogOpen}
          onClose={() => newMap.setIsDialogOpen(false)}
          campaignId={newMap.campaignId}
          categoryId={newMap.categoryId}
          parentFolderId={newMap.parentFolderId}
        />
      )}
    </>
  )
})
