import React from 'react'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '~/components/shadcn/ui/breadcrumb'
import type { TagCategoryConfig } from '~/components/forms/category-tag-dialogs/base-tag-dialog/types'
import type { FolderAncestor, ViewMode } from '~/hooks/useCategoryView'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Switch } from '~/components/shadcn/ui/switch'
import type { Id } from 'convex/_generated/dataModel'
import { BreadcrumbDropZone } from './breadcrumb-drop-zone'

interface CategoryBreadcrumbProps {
  config?: TagCategoryConfig
  showBreadcrumbs?: boolean
  breadcrumbs?: FolderAncestor[]
  onNavigate: (index: number) => void
  isLoading?: boolean
  viewMode?: ViewMode
  onToggleViewMode?: () => void
  categoryId?: Id<'tagCategories'>
}

export function CategoryBreadcrumb({
  config,
  showBreadcrumbs,
  breadcrumbs = [],
  onNavigate,
  isLoading,
  viewMode,
  onToggleViewMode,
  categoryId,
}: CategoryBreadcrumbProps) {
  if (isLoading || !config) {
    return (
      <div className="mb-2 flex items-center justify-between gap-4">
        <Breadcrumb>
          <BreadcrumbList className="text-lg text-foreground">
            <BreadcrumbItem>
              <Skeleton className="h-7 w-32" />
            </BreadcrumbItem>
            {showBreadcrumbs && (
              <>
                <BreadcrumbSeparator className="[&>svg]:!size-5" />
                <BreadcrumbItem>
                  <Skeleton className="h-7 w-24" />
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <Skeleton className="h-9 w-[130px]" />
      </div>
    )
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-4">
      <Breadcrumb>
        <BreadcrumbList className="text-lg text-foreground">
          <BreadcrumbDropZone id="category-root" categoryId={categoryId} isRoot>
            <BreadcrumbItem>
              {showBreadcrumbs ? (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    onClick={() => onNavigate(-1)}
                    className="cursor-pointer font-medium text-foreground group-hover:!text-amber-600 transition-colors"
                  >
                    {config.plural}
                  </button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="font-bold text-foreground">
                  {config.plural}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </BreadcrumbDropZone>

          {showBreadcrumbs &&
            breadcrumbs.map((ancestor, index) => (
              <React.Fragment key={ancestor.id}>
                <BreadcrumbSeparator className="[&>svg]:!size-5 -mx-2 mt-1" />
                <BreadcrumbDropZone id={ancestor.id} categoryId={categoryId}>
                  <BreadcrumbItem>
                    {index === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage className="font-bold text-foreground">
                        {ancestor.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button
                          type="button"
                          onClick={() => onNavigate(index)}
                          className="cursor-pointer font-medium text-foreground group-hover:!text-amber-600 transition-colors"
                        >
                          {ancestor.name}
                        </button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </BreadcrumbDropZone>
              </React.Fragment>
            ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-muted-foreground">
          {viewMode === 'folderized' ? 'Show Folders' : 'Hide Folders'}
        </span>
        <Switch
          checked={viewMode === 'folderized'}
          onCheckedChange={onToggleViewMode}
          disabled={!onToggleViewMode}
        />
      </div>
    </div>
  )
}
