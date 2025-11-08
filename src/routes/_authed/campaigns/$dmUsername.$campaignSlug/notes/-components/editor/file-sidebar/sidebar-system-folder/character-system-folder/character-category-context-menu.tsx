import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import type { CategoryContextMenuProps } from '../generic-category-folder/category-context-menu'
import { UserPlus, Users } from '~/lib/icons'
import { useCampaign } from '~/contexts/CampaignContext'
import { useRouter } from '@tanstack/react-router'
import { forwardRef, useState, useMemo } from 'react'
import { useFolderState } from '~/hooks/useFolderState'
import CharacterTagDialog from '~/components/forms/category-tag-form/character-tag-form/character-tag-dialog'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import {
  useCategoryCreateItem,
  useCategoryNewFolderWithDialog,
  useCategoryRenameFolder,
  useCategoryDeleteFolder,
} from '~/hooks/useCategoryContextMenu'
import type { ContextMenuItem } from '~/components/context-menu/context-menu'

export const CharacterCategoryFolderContextMenu = forwardRef<
  ContextMenuRef,
  CategoryContextMenuProps
>(({ categoryConfig, children, folder }, ref) => {
  const router = useRouter()
  const { dmUsername, campaignSlug } = useCampaign()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const { openFolder } = useFolderState(
    folder?._id || categoryConfig?.categorySlug || '',
  )

  const baseCreateItem = useCategoryCreateItem(categoryConfig, folder)
  const newFolder = useCategoryNewFolderWithDialog(categoryConfig, folder)
  const renameFolder = useCategoryRenameFolder(folder)
  const deleteFolder = useCategoryDeleteFolder(folder)

  const handleCreateItem = () => {
    openFolder()
    setIsCreateDialogOpen(true)
  }

  const createItem: ContextMenuItem | null = useMemo(() => {
    if (!baseCreateItem.menuItem || !categoryConfig) return null
    return {
      ...baseCreateItem.menuItem,
      icon: <UserPlus className="h-4 w-4" />,
      onClick: handleCreateItem,
    }
  }, [baseCreateItem.menuItem, categoryConfig, handleCreateItem])

  const menuItems = useMemo(() => {
    const items: ContextMenuItem[] = []
    if (createItem) {
      items.push(createItem)
    }
    if (newFolder.menuItem) {
      items.push(newFolder.menuItem)
    }
    if (renameFolder.menuItem) {
      items.push(renameFolder.menuItem)
    }
    if (deleteFolder.menuItem) {
      items.push(deleteFolder.menuItem)
    }
    if (!folder && categoryConfig) {
      items.push({
        type: 'action' as const,
        icon: <Users className="h-4 w-4" />,
        label: `Go to ${categoryConfig.plural}`,
        onClick: () => {
          router.navigate({
            to: '/campaigns/$dmUsername/$campaignSlug/categories/characters',
            params: {
              dmUsername,
              campaignSlug,
            },
          })
        },
      })
    }
    return items
  }, [
    createItem,
    newFolder.menuItem,
    renameFolder.menuItem,
    deleteFolder.menuItem,
    folder,
    categoryConfig,
    router,
    dmUsername,
    campaignSlug,
  ])

  return (
    <>
      <ContextMenu ref={ref} items={menuItems} menuClassName="w-64">
        {children}
      </ContextMenu>
      {categoryConfig && (
        <>
          <CharacterTagDialog
            mode="create"
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            config={categoryConfig}
            parentFolderId={folder?._id}
            navigateToNote={false}
          />
          <FolderDialog
            isOpen={newFolder.isDialogOpen}
            onClose={() => newFolder.setIsDialogOpen(false)}
            mode="create"
            onSubmit={newFolder.onSubmit}
          />
        </>
      )}
    </>
  )
})
