import { useState, useEffect } from 'react'
import type React from 'react'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { toast } from 'sonner'
import { useCategoryView, VIEW_MODE } from '~/hooks/useCategoryView'
import type { Id } from 'convex/_generated/dataModel'
import { TagCardWithContextMenu } from './tag/tag-card'
import { FolderCardWithContextMenu } from './folder/folder-card'
import { EmptyState } from './empty-state'
import { CategoryFolderContextMenu } from '~/components/context-menu/category/category-folder-context-menu'
import {
  FolderDialog,
  type FolderFormValues,
} from '~/components/forms/folder-dialog/folder-dialog'
import { useFolderActions } from '~/hooks/useFolderActions'
import { CategoryDialog } from '~/components/forms/category-form/category-dialog'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import type { ComponentType } from 'react'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import type { TagDialogProps } from '~/components/forms/category-tag-form/base-tag-form/types'
import { Button } from '~/components/shadcn/ui/button'
import { Link } from '@tanstack/react-router'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { CategoryDragProvider } from '~/contexts/CategoryDragContext'

interface CategoryPageContentProps {
  categorySlug: string
  currentFolderId?: Id<'notes'>
  onNavigate: (folderId?: Id<'notes'>) => void
  onCategoryUpdated?: (newSlug: string) => void
  TagCardComponent?: ComponentType<
    React.ComponentProps<typeof TagCardWithContextMenu>
  >
  FolderCardComponent?: ComponentType<
    React.ComponentProps<typeof FolderCardWithContextMenu>
  >
  MapCardComponent?: ComponentType<any>
  FolderContextMenuComponent: ComponentType<
    React.ComponentProps<typeof CategoryFolderContextMenu>
  >
  TagDialogComponent?: ComponentType<TagDialogProps<any>>
  EmptyStateComponent?: ComponentType<React.ComponentProps<typeof EmptyState>>
}

export function CategoryPageContent({
  categorySlug,
  currentFolderId,
  onNavigate,
  onCategoryUpdated,
  TagCardComponent = TagCardWithContextMenu,
  FolderCardComponent = FolderCardWithContextMenu,
  MapCardComponent,
  FolderContextMenuComponent,
  TagDialogComponent = GenericTagDialog,
  EmptyStateComponent = EmptyState,
}: CategoryPageContentProps) {
  const [creatingTag, setCreatingTag] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [creatingMap, setCreatingMap] = useState(false)
  const [editingCategory, setEditingCategory] = useState(false)

  const {
    viewMode,
    notesAndTags,
    folders,
    maps,
    categoryData,
    categoryConfig,
    campaignId,
    navigateToFolder,
    isAtRoot,
    hasContent,
    showSkeletons,
    folderSkeletonCount,
    noteSkeletonCount,
    invalidFolderId,
    categoryNotFound,
  } = useCategoryView({
    categorySlug,
    currentFolderId,
    onNavigate,
  })

  const { createFolder } = useFolderActions()

  useEffect(() => {
    if (invalidFolderId) {
      toast.error('Folder does not exist')
      onNavigate(undefined)
    }
  }, [invalidFolderId, onNavigate])

  const handleCreateFolder = async (values: FolderFormValues) => {
    if (!campaignId || !categoryData) return

    try {
      await createFolder.mutateAsync({
        campaignId,
        categoryId: categoryData._id,
        parentId: currentFolderId,
        name: values.name,
      })
      toast.success('Folder created')
      setCreatingFolder(false)
    } catch (error) {
      toast.error('Failed to create folder')
    }
  }

  const handleCategoryUpdated = (newSlug: string) => {
    setEditingCategory(false)
    if (onCategoryUpdated) {
      onCategoryUpdated(newSlug)
    }
  }

  if (categoryNotFound) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-bold text-gray-900">
            Category Not Found
          </h2>
          <p className="text-gray-600">
            The category "{categorySlug}" doesn't exist or you don't have
            permission to access it.
          </p>
          <Link to="/campaigns">
            <Button variant="outline" size="sm">
              Back to Campaigns //TODO: change to go back to category page
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <CategoryDragProvider>
      <FolderContextMenuComponent categoryConfig={categoryConfig}>
        <ScrollArea className="flex-1 p-6">
          <ContentGrid>
            {showSkeletons ? (
              <>
                {viewMode === VIEW_MODE.folderized &&
                  Array.from({ length: folderSkeletonCount }).map((_, i) => {
                    const FolderComponent = FolderCardComponent
                    return FolderComponent ? (
                      <FolderComponent
                        key={`skeleton-folder-${i}`}
                        isLoading={true}
                        categoryId={categoryData?._id}
                        categoryConfig={categoryConfig}
                      />
                    ) : null
                  })}
                {Array.from({ length: noteSkeletonCount }).map((_, i) => {
                  const TagComponent = TagCardComponent
                  return TagComponent ? (
                    <TagComponent
                      key={`skeleton-tag-${i}`}
                      isLoading={true}
                      config={categoryConfig}
                    />
                  ) : null
                })}
              </>
            ) : (
              <>
                {/* Folder Cards */}
                {viewMode === VIEW_MODE.folderized &&
                  folders?.map((folder) => {
                    const FolderComponent = FolderCardComponent
                    return FolderComponent ? (
                      <FolderComponent
                        key={folder._id}
                        folder={folder}
                        categoryId={categoryData?._id}
                        categoryConfig={categoryConfig}
                        onClick={() => navigateToFolder(folder)}
                      />
                    ) : null
                  })}

                {/* Tag Cards */}
                {notesAndTags?.map((note) => (
                  <TagCardComponent
                    key={note._id}
                    noteAndTag={note}
                    config={categoryConfig}
                    parentId={currentFolderId}
                  />
                ))}

                {/* Map Cards */}
                {MapCardComponent &&
                  maps?.map((map) => (
                    <MapCardComponent
                      key={map._id}
                      map={map}
                      categoryId={categoryData?._id}
                      categoryConfig={categoryConfig}
                    />
                  ))}
              </>
            )}

            {/* Empty State */}
            {!showSkeletons && !hasContent && categoryConfig && (
              <EmptyStateComponent
                viewMode={viewMode}
                isAtRoot={isAtRoot}
                onCreateTag={() => setCreatingTag(true)}
                config={categoryConfig}
              />
            )}
          </ContentGrid>

          {creatingTag && categoryConfig && (
            <TagDialogComponent
              mode="create"
              isOpen={creatingTag}
              onClose={() => setCreatingTag(false)}
              config={categoryConfig}
              parentId={currentFolderId}
            />
          )}

          {creatingFolder && (
            <FolderDialog
              mode="create"
              isOpen={creatingFolder}
              onClose={() => setCreatingFolder(false)}
              onSubmit={handleCreateFolder}
            />
          )}

          {editingCategory && categoryData && (
            <CategoryDialog
              mode="edit"
              isOpen={editingCategory}
              onClose={() => setEditingCategory(false)}
              category={categoryData}
              onSuccess={handleCategoryUpdated}
            />
          )}

          {creatingMap && campaignId && categoryData && (
            <MapDialog
              isOpen={creatingMap}
              onClose={() => setCreatingMap(false)}
              campaignId={campaignId}
              categoryId={categoryData._id}
              parentId={currentFolderId}
            />
          )}
        </ScrollArea>
      </FolderContextMenuComponent>
    </CategoryDragProvider>
  )
}
