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

interface CategoryBreadcrumbProps {
  config?: TagCategoryConfig
  showBreadcrumbs?: boolean
  breadcrumbs?: FolderAncestor[]
  onNavigate: (index: number) => void
  isLoading?: boolean
  viewMode?: ViewMode
  onToggleViewMode?: () => void
}

export function CategoryBreadcrumb({
  config,
  showBreadcrumbs,
  breadcrumbs = [],
  onNavigate,
  isLoading,
  viewMode,
  onToggleViewMode,
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
          <BreadcrumbItem>
            {showBreadcrumbs ? (
              <BreadcrumbLink asChild>
                <button
                  type="button"
                  onClick={() => onNavigate(-1)}
                  className="cursor-pointer font-medium text-foreground hover:!text-amber-600 transition-colors"
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
          {showBreadcrumbs &&
            breadcrumbs.map((ancestor, index) => (
              <React.Fragment key={ancestor.id}>
                <BreadcrumbSeparator className="[&>svg]:!size-5" />
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
                        className="cursor-pointer font-medium text-foreground hover:!text-amber-600 transition-colors"
                      >
                        {ancestor.name}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
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
