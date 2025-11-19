import {
  ContextMenu,
  type ContextMenuRef,
  type ContextMenuItem,
} from '~/components/context-menu/base/context-menu'
import { forwardRef, useMemo } from 'react'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Folder } from 'convex/notes/types'
import {
  useCategoryCreateItem,
  useCategoryNewFolderWithDialog,
  useCategoryEditFolder,
} from '~/hooks/useCategoryContextMenu'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import CharacterTagDialog from '~/components/forms/category-tag-form/character-tag-form/character-tag-dialog'
import { useFolderActions } from '~/hooks/useFolderActions'
import { toast } from 'sonner'

export interface CharacterFolderContextMenuProps {
  children: React.ReactNode
  categoryConfig?: TagCategoryConfig
  folder?: Folder
}

export const CharacterFolderContextMenu = forwardRef<
  ContextMenuRef,
  CharacterFolderContextMenuProps
>(({ children, categoryConfig, folder }, ref) => {
  const createItem = useCategoryCreateItem(categoryConfig, folder)
  const newFolder = useCategoryNewFolderWithDialog(categoryConfig, folder)
  const editFolder = useCategoryEditFolder(folder)
  const { updateFolder } = useFolderActions()

  const menuItems = useMemo(() => {
    if (!categoryConfig) {
      return []
    }
    if (folder) {
      if (!editFolder.menuItem) {
        return []
      }
      return [editFolder.menuItem]
    }
    const items: ContextMenuItem[] = []
    if (createItem.menuItem) {
      items.push(createItem.menuItem)
    }
    if (newFolder.menuItem) {
      items.push(newFolder.menuItem)
    }
    return items
  }, [
    folder,
    categoryConfig,
    createItem.menuItem,
    newFolder.menuItem,
    editFolder.menuItem,
  ])

  return (
    <>
      <ContextMenu ref={ref} items={menuItems} menuClassName="w-64">
        {children}
      </ContextMenu>

      {categoryConfig && !folder && (
        <>
          <CharacterTagDialog
            mode="create"
            isOpen={createItem.isDialogOpen}
            onClose={() => createItem.setIsDialogOpen(false)}
            config={categoryConfig}
            parentFolderId={undefined}
          />
          <FolderDialog
            isOpen={newFolder.isDialogOpen}
            onClose={() => newFolder.setIsDialogOpen(false)}
            mode="create"
            onSubmit={newFolder.onSubmit}
          />
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
