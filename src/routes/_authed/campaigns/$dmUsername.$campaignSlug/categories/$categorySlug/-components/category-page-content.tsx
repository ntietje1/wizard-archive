import { useState, useEffect } from 'react'
import type React from 'react'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { toast } from 'sonner'
import { useCategoryView, VIEW_MODE } from '~/hooks/useCategoryView'
import { CategoryHeader } from './category-header'
import type { Id } from 'convex/_generated/dataModel'
import { TagCard } from './tag-card'
import { FolderCard } from './folder-card'
import { EmptyState } from './empty-state'
import {
  FolderDialog,
  type FolderFormValues,
} from '~/components/forms/folder-dialog/folder-dialog'
import { useFolderActions } from '~/hooks/useFolderActions'
import { CategoryDragProvider } from '~/contexts/CategoryDragContext'
import { CategoryDialog } from '~/components/forms/category-form/category-dialog'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import type { ComponentType } from 'react'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import type { TagDialogProps } from '~/components/forms/category-tag-form/base-tag-form/types'

interface CategoryPageContentProps {
  categorySlug: string
  currentFolderId?: Id<'folders'>
  onNavigate: (folderId?: Id<'folders'>) => void
  onCategoryUpdated?: (newSlug: string) => void
  TagCardComponent?: ComponentType<React.ComponentProps<typeof TagCard>>
  FolderCardComponent?: ComponentType<React.ComponentProps<typeof FolderCard>>
  TagDialogComponent?: ComponentType<TagDialogProps<any>>
  HeaderComponent?: ComponentType<React.ComponentProps<typeof CategoryHeader>>
  EmptyStateComponent?: ComponentType<React.ComponentProps<typeof EmptyState>>
}

export function CategoryPageContent({
  categorySlug,
  currentFolderId,
  onNavigate,
  onCategoryUpdated,
  TagCardComponent = TagCard,
  FolderCardComponent = FolderCard,
  TagDialogComponent = GenericTagDialog,
  HeaderComponent = CategoryHeader,
  EmptyStateComponent = EmptyState,
}: CategoryPageContentProps) {
  const [creatingTag, setCreatingTag] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [editingCategory, setEditingCategory] = useState(false)

  const {
    viewMode,
    toggleViewMode,
    tags,
    folders,
    categoryData,
    categoryConfig,
    campaignId,
    canEditCategory,
    breadcrumbs,
    navigateToFolder,
    navigateToBreadcrumb,
    isLoading,
    isAtRoot,
    hasContent,
    showSkeletons,
    skeletonCount,
    invalidFolderId,
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
        parentFolderId: currentFolderId,
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

  return (
    <CategoryDragProvider isEnabled={viewMode === VIEW_MODE.folderized}>
      <ScrollArea className="flex-1 p-6">
        <HeaderComponent
          config={categoryConfig}
          breadcrumbs={breadcrumbs}
          onNavigateBreadcrumb={navigateToBreadcrumb}
          onCreateFolder={() => setCreatingFolder(true)}
          onCreateTag={() => setCreatingTag(true)}
          onEditCategory={
            canEditCategory ? () => setEditingCategory(true) : undefined
          }
          onToggleViewMode={toggleViewMode}
          viewMode={viewMode}
          isLoading={isLoading}
          categoryId={categoryData?._id}
        />

        <ContentGrid>
          {/* Folder Cards */}
          {viewMode === VIEW_MODE.folderized &&
            categoryData?._id &&
            (showSkeletons
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <FolderCardComponent
                    key={`skeleton-folder-${i}`}
                    isLoading={true}
                    categoryId={categoryData._id}
                  />
                ))
              : folders?.map((folder) => (
                  <FolderCardComponent
                    key={folder._id}
                    folder={folder}
                    categoryId={categoryData._id}
                    onClick={() => navigateToFolder(folder)}
                  />
                )))}

          {/* Tag Cards */}
          {showSkeletons
            ? Array.from({ length: skeletonCount }).map((_, i) => (
                <TagCardComponent
                  key={`skeleton-tag-${i}`}
                  isLoading={true}
                  config={categoryConfig}
                />
              ))
            : tags?.map((tag) => (
                <TagCardComponent
                  key={tag._id}
                  tag={tag}
                  config={categoryConfig}
                  parentFolderId={currentFolderId}
                />
              ))}

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
            parentFolderId={currentFolderId}
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
      </ScrollArea>
    </CategoryDragProvider>
  )
}
