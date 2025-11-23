import { Plus } from 'lucide-react'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import { VIEW_MODE, type ViewMode } from '~/hooks/useCategoryView'
import { EmptyState as EmptyStateComponent } from '~/components/content-grid-page/empty-state'

interface EmptyStateProps {
  viewMode: ViewMode
  isAtRoot: boolean
  onCreateTag: () => void
  config: TagCategoryConfig
}

export function EmptyState({
  viewMode,
  isAtRoot,
  onCreateTag,
  config,
}: EmptyStateProps) {
  if (
    viewMode === VIEW_MODE.flat ||
    (viewMode === VIEW_MODE.folderized && isAtRoot)
  ) {
    return (
      <EmptyStateComponent
        icon={config.icon}
        title={`No ${config.plural.toLowerCase()} yet`}
        description={`Create your first ${config.singular.toLowerCase()} to start organizing your campaign.`}
        action={{
          label: `Create First ${config.singular}`,
          onClick: () => onCreateTag(),
          icon: Plus,
        }}
      />
    )
  }
  if (viewMode === VIEW_MODE.folderized && !isAtRoot) {
    return (
      <EmptyStateComponent
        icon={config.icon}
        title="No content in this folder"
        description={`This folder is empty. Create a ${config.singular.toLowerCase()} to get started.`}
        action={{
          label: `Create ${config.singular}`,
          onClick: () => onCreateTag(),
          icon: Plus,
        }}
      />
    )
  }
  return null
}

