import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/base/context-menu'
import type { CategoryContextMenuProps } from '../generic/category-folder-context-menu'
import { MapPin, MapPinPlus } from '~/lib/icons'
import { useCampaign } from '~/contexts/CampaignContext'
import { forwardRef, useState, useMemo, useCallback } from 'react'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFolderState } from '~/hooks/useFolderState'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import {
  useCategoryCreateItem,
  useCategoryNewFolderWithDialog,
  useCategoryRenameFolder,
  useCategoryDeleteFolder,
  useCategoryNewMap,
} from '~/hooks/useCategoryContextMenu'
import type { ContextMenuItem } from '~/components/context-menu/base/context-menu'

export const LocationCategoryFolderContextMenu = forwardRef<
  ContextMenuRef,
  CategoryContextMenuProps
>(({ categoryConfig, children, folder }, ref) => {
  const { navigateToCategory } = useEditorNavigation()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const { openFolder } = useFolderState(
    folder?._id || categoryConfig?.categorySlug || '',
  )

  const baseCreateItem = useCategoryCreateItem(categoryConfig, folder)
  const newFolder = useCategoryNewFolderWithDialog(categoryConfig, folder)
  const newMap = useCategoryNewMap(categoryConfig, folder)
  const renameFolder = useCategoryRenameFolder(folder)
  const deleteFolder = useCategoryDeleteFolder(folder)

  const handleCreateItem = useCallback(() => {
    openFolder()
    setIsCreateDialogOpen(true)
  }, [openFolder, setIsCreateDialogOpen])

  const createItem: ContextMenuItem | null = useMemo(() => {
    if (!baseCreateItem.menuItem || !categoryConfig) return null
    return {
      ...baseCreateItem.menuItem,
      icon: <MapPinPlus className="h-4 w-4" />,
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
    if (newMap.menuItem) {
      items.push(newMap.menuItem)
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
        icon: <MapPin className="h-4 w-4" />,
        label: `Go to ${categoryConfig.plural}`,
        onClick: () => {
          navigateToCategory('locations')
        },
      })
    }
    return items
  }, [
    createItem,
    newFolder.menuItem,
    newMap.menuItem,
    renameFolder.menuItem,
    deleteFolder.menuItem,
    folder,
    categoryConfig,
    navigateToCategory,
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
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
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
    </>
  )
})
