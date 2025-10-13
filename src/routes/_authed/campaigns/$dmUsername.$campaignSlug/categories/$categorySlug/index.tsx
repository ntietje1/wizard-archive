import {
  createFileRoute,
  useParams,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useState } from 'react'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { FolderCard } from '~/routes/_authed/campaigns/$dmUsername.$campaignSlug/categories/$categorySlug/-components/folder-card'
import { EmptyState } from '~/components/content-grid-page/empty-state'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'
import { useCampaign } from '~/contexts/CampaignContext'
import GenericTagDialog from '~/components/forms/category-tag-dialogs/generic-tag-dialog/generic-dialog'
import { TagIcon, Plus, Folder as FolderIcon } from '~/lib/icons'
import type { TagCategoryConfig } from '~/components/forms/category-tag-dialogs/base-tag-dialog/types'
import { toast } from 'sonner'
import { useCategoryView, VIEW_MODE } from '~/hooks/useCategoryView'
import { useFolderActions } from '~/hooks/useFolderActions'
import { CategoryHeader } from './-components/category-header'
import type { Id } from 'convex/_generated/dataModel'
import { TagCard } from './-components/tag-card'
import { getCategoryIcon } from '~/lib/category-icons'
import {
  FolderDialog,
  type FolderFormValues,
} from '~/components/forms/folder-dialog/folder-dialog'

type CategorySearch = {
  folderId?: string
}

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
)({
  component: GenericCategoryPage,
  validateSearch: (search: Record<string, unknown>): CategorySearch => {
    return {
      folderId:
        typeof search.folderId === 'string' ? search.folderId : undefined,
    }
  },
})

function GenericCategoryPage() {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const params = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
  })
  const categorySlug = params?.categorySlug
  const navigate = useNavigate()
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
  })
  const parentFolderId = search.folderId as Id<'folders'> | undefined

  const [creatingTag, setCreatingTag] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)

  const handleFolderNavigation = (folderId: string | undefined) => {
    navigate({
      to: '.',
      search: {
        folderId,
      },
    })
  }

  const {
    viewMode,
    toggleViewMode,
    tags,
    folders,
    categoryData,
    breadcrumbs,
    navigateToFolder,
    navigateToBreadcrumb,
    isLoading,
  } = useCategoryView({
    categorySlug,
    currentFolderId: search.folderId,
    onNavigate: handleFolderNavigation,
  })

  const { createFolder } = useFolderActions()

  const config: TagCategoryConfig | undefined = categoryData
    ? {
        singular: categoryData.displayName,
        plural: categoryData.pluralDisplayName,
        categorySlug,
        icon: getCategoryIcon(categoryData.iconName),
      }
    : undefined

  const handleCreateFolder = async (values: FolderFormValues) => {
    if (!campaign || !categoryData) return

    try {
      await createFolder.mutateAsync({
        campaignId: campaign._id,
        categoryId: categoryData._id,
        parentFolderId: parentFolderId,
        name: values.name,
      })
      toast.success('Folder created')
    } catch (error) {
      toast.error('Failed to create folder')
    }
  }

  const showBreadcrumbs =
    viewMode === VIEW_MODE.folderized && breadcrumbs.length > 0
  const isAtRoot = breadcrumbs.length === 0
  const hasContent = (tags?.length ?? 0) > 0 || (folders?.length ?? 0) > 0

  if (isLoading || !config) {
    return (
      <div className="flex-1 p-6">
        <CategoryHeader
          config={config}
          onNavigateBreadcrumb={() => {}}
          showBreadcrumbs={false}
          breadcrumbs={[]}
          isLoading={true}
        />
        <CardGridSkeleton
          count={6}
          showCreateCard={true}
          cardHeight="h-[180px]"
        />
      </div>
    )
  }

  return (
    <div className="flex-1 p-6">
      <CategoryHeader
        config={config}
        showBreadcrumbs={showBreadcrumbs}
        breadcrumbs={breadcrumbs}
        onNavigateBreadcrumb={navigateToBreadcrumb}
        onCreateFolder={() => setCreatingFolder(true)}
        onCreateTag={() => setCreatingTag(true)}
        onToggleViewMode={toggleViewMode}
        viewMode={viewMode}
      />

      <ContentGrid>
        {/* Folder Cards */}
        {viewMode === VIEW_MODE.folderized &&
          folders?.map((folder) => (
            <FolderCard
              key={folder._id}
              id={folder._id}
              name={folder.name || ''}
              onClick={() => navigateToFolder(folder)}
            />
          ))}

        {/* Tag Cards */}
        {tags?.map((tag) => (
          <TagCard key={tag._id} tag={tag} config={config} />
        ))}

        {/* Empty State */}
        {!hasContent && viewMode === VIEW_MODE.flat && (
          <EmptyState
            icon={config.icon}
            title={`No ${config.plural.toLowerCase()} yet`}
            description={`Create your first ${config.singular.toLowerCase()} to start organizing your campaign.`}
            action={{
              label: `Create First ${config.singular}`,
              onClick: () => setCreatingTag(true),
              icon: Plus,
            }}
          />
        )}

        {!hasContent && viewMode === VIEW_MODE.folderized && isAtRoot && (
          <EmptyState
            icon={config.icon}
            title={`No ${config.plural.toLowerCase()} yet`}
            description={`Create your first ${config.singular.toLowerCase()} to start organizing your campaign.`}
            action={{
              label: `Create First ${config.singular}`,
              onClick: () => setCreatingTag(true),
              icon: Plus,
            }}
          />
        )}

        {!hasContent && viewMode === VIEW_MODE.folderized && !isAtRoot && (
          <EmptyState
            icon={config.icon}
            title="No content in this folder"
            description={`This folder is empty. Create a ${config.singular.toLowerCase()} to get started.`}
            action={{
              label: `Create ${config.singular}`,
              onClick: () => setCreatingTag(true),
              icon: Plus,
            }}
          />
        )}
      </ContentGrid>

      {creatingTag && (
        <GenericTagDialog
          mode="create"
          isOpen={creatingTag}
          onClose={() => setCreatingTag(false)}
          config={config}
          parentFolderId={parentFolderId}
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
    </div>
  )
}
