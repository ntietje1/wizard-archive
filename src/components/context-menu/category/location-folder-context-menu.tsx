import {
  ContextMenu,
  type ContextMenuRef,
  type ContextMenuItem,
} from '~/components/context-menu/base/context-menu'
import { forwardRef, useMemo } from 'react'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Folder } from 'convex/folders/types'
import {
  useCategoryCreateItem,
  useCategoryNewFolderWithDialog,
  useCategoryEditFolder,
  useCategoryNewMap,
} from '~/hooks/useCategoryContextMenu'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { useFolderActions } from '~/hooks/useFolderActions'
import { toast } from 'sonner'

export interface LocationFolderContextMenuProps {
  children: React.ReactNode
  categoryConfig?: TagCategoryConfig
  folder?: Folder
}

export const LocationFolderContextMenu = forwardRef<
  ContextMenuRef,
  LocationFolderContextMenuProps
>(({ children, categoryConfig, folder }, ref) => {
  const createItem = useCategoryCreateItem(categoryConfig, folder)
  const newFolder = useCategoryNewFolderWithDialog(categoryConfig, folder)
  const newMap = useCategoryNewMap(categoryConfig, folder)
  const editFolder = useCategoryEditFolder(folder)
  const { updateFolder } = useFolderActions()

  const menuItems = useMemo(() => {
    if (!categoryConfig) {
      return []
    }
    const items: ContextMenuItem[] = []

    if (folder) {
      // When right-clicking on a folder, show create options for inside the folder
      if (createItem.menuItem) {
        items.push(createItem.menuItem)
      }
      if (newFolder.menuItem) {
        items.push(newFolder.menuItem)
      }
      if (newMap.menuItem) {
        items.push(newMap.menuItem)
      }
      if (editFolder.menuItem) {
        items.push(editFolder.menuItem)
      }
    } else {
      // When right-clicking on empty space, show create options for root level
      if (createItem.menuItem) {
        items.push(createItem.menuItem)
      }
      if (newFolder.menuItem) {
        items.push(newFolder.menuItem)
      }
      if (newMap.menuItem) {
        items.push(newMap.menuItem)
      }
    }
    return items.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    )
  }, [
    folder,
    categoryConfig,
    createItem.menuItem,
    newFolder.menuItem,
    newMap.menuItem,
    editFolder.menuItem,
  ])

  return (
    <>
      <ContextMenu ref={ref} items={menuItems} menuClassName="w-64">
        {children}
      </ContextMenu>

      {categoryConfig && (
        <>
          <LocationTagDialog
            mode="create"
            isOpen={createItem.isDialogOpen}
            onClose={() => createItem.setIsDialogOpen(false)}
            config={categoryConfig}
            parentFolderId={folder?._id}
          />
          <FolderDialog
            isOpen={newFolder.isDialogOpen}
            onClose={() => newFolder.setIsDialogOpen(false)}
            mode="create"
            onSubmit={newFolder.onSubmit}
          />
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
      )}

      {folder && (
        <FolderDialog
          isOpen={editFolder.isDialogOpen}
          onClose={() => editFolder.setIsDialogOpen(false)}
          mode="edit"
          folderId={folder._id}
          initialName={folder.name || ''}
          onSubmit={async (values) => {
            try {
              await updateFolder.mutateAsync({
                folderId: folder._id,
                name: values.name,
              })
              editFolder.setIsDialogOpen(false)
              toast.success('Folder updated')
            } catch (error) {
              console.error(error)
              toast.error('Failed to update folder')
            }
          }}
        />
      )}
    </>
  )
})
