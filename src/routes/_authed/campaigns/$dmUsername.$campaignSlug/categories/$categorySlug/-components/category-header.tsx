import { Button } from '~/components/shadcn/ui/button'
import { FolderPlus, Plus, Edit } from '~/lib/icons'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import { CategoryBreadcrumb } from './category-breadcrumb'
import type { FolderAncestor, ViewMode } from '~/hooks/useCategoryView'
import type { Id } from 'convex/_generated/dataModel'
import { Skeleton } from '~/components/shadcn/ui/skeleton'

interface CategoryHeaderProps {
  config?: TagCategoryConfig
  breadcrumbs?: FolderAncestor[]
  onNavigateBreadcrumb: (index: number) => void
  showFolderActions?: boolean
  onCreateFolder?: () => void
  onToggleViewMode?: () => void
  viewMode?: ViewMode
  onCreateTag?: () => void
  onEditCategory?: () => void
  isLoading?: boolean
  categoryId?: Id<'tagCategories'>
}

export function CategoryHeader({
  config,
  breadcrumbs,
  onNavigateBreadcrumb,
  onCreateFolder,
  onToggleViewMode,
  viewMode,
  onCreateTag,
  onEditCategory,
  isLoading,
  categoryId,
}: CategoryHeaderProps) {
  if (!config || isLoading) {
    return (
      <div className="mb-6">
        <CategoryBreadcrumb
          config={config}
          breadcrumbs={breadcrumbs}
          onNavigate={onNavigateBreadcrumb}
          isLoading={true}
          viewMode={viewMode}
          onToggleViewMode={onToggleViewMode}
          categoryId={categoryId}
        />
        <div className="flex items-start justify-between gap-4 pb-1">
          <Skeleton className="h-6 w-[600px]" />
          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-9 w-[100px]" />
            <Skeleton className="h-9 w-[100px]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <CategoryBreadcrumb
        config={config}
        breadcrumbs={breadcrumbs}
        onNavigate={onNavigateBreadcrumb}
        isLoading={isLoading}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        categoryId={categoryId}
      />

      <div className="flex items-start justify-between gap-4 pl-1">
        <p className="text-muted-foreground">
          Manage {config.plural.toLowerCase()} for your campaign. Each{' '}
          {config.singular.toLowerCase()} automatically creates a tag that can
          be used in your notes.
        </p>
        <div className="flex gap-2 shrink-0">
          {onEditCategory && (
            <Button variant="outline" onClick={onEditCategory}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Category
            </Button>
          )}
          {onCreateTag && (
            <Button variant="outline" onClick={onCreateTag}>
              <Plus className="w-4 h-4 mr-2" />
              New {config.singular}
            </Button>
          )}
          {onCreateFolder && viewMode && (
            <Button
              variant="outline"
              onClick={onCreateFolder}
              disabled={viewMode === 'flat'}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
