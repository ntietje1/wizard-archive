import {
  createFileRoute,
  useParams,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useState } from 'react'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { FolderCard } from '~/routes/_authed/campaigns/$dmUsername.$campaignSlug/categories/$categorySlug/-components/folder-card'
import { EmptyState } from './-components/empty-state'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'
import { useCampaign } from '~/contexts/CampaignContext'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import { toast } from 'sonner'
import { useCategoryView, VIEW_MODE } from '~/hooks/useCategoryView'
import { CategoryHeader } from './-components/category-header'
import type { Id } from 'convex/_generated/dataModel'
import { TagCard } from './-components/tag-card'
import { getCategoryIcon } from '~/lib/category-icons'
import {
  FolderDialog,
  type FolderFormValues,
} from '~/components/forms/folder-dialog/folder-dialog'
import { CATEGORY_KIND } from 'convex/tags/types'
import { useFolderActions } from '~/hooks/useFolderActions'
import { CategoryDragProvider } from '~/contexts/CategoryDragContext'
import { CategoryDialog } from '~/components/forms/category-form/category-dialog'
import { ScrollArea } from '@radix-ui/react-scroll-area'

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
  const { campaignWithMembership, dmUsername, campaignSlug } = useCampaign()
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
  const [editingCategory, setEditingCategory] = useState(false)

  const handleCategoryUpdated = (newSlug: string) => {
    if (newSlug !== categorySlug) {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug',
        params: {
          dmUsername,
          campaignSlug,
          categorySlug: newSlug,
        },
        search: {
          folderId: search.folderId,
        },
      })
    }
  }

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
    isAtRoot,
    hasContent,
    categoryConfig,
  } = useCategoryView({
    categorySlug,
    currentFolderId: search.folderId,
    onNavigate: handleFolderNavigation,
  })

  const { createFolder } = useFolderActions()

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
  const canEditCategory = categoryData?.kind === CATEGORY_KIND.User

  if (isLoading || !categoryConfig) {
    return (
      <div className="flex-1 p-6">
        <CategoryHeader
          config={categoryConfig}
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
    <CategoryDragProvider isEnabled={viewMode === VIEW_MODE.folderized}>
      <ScrollArea className="flex-1 p-6">
        <CategoryHeader
          config={categoryConfig}
          showBreadcrumbs={true}
          breadcrumbs={breadcrumbs}
          onNavigateBreadcrumb={navigateToBreadcrumb}
          onCreateFolder={() => setCreatingFolder(true)}
          onCreateTag={() => setCreatingTag(true)}
          onEditCategory={
            canEditCategory ? () => setEditingCategory(true) : undefined
          }
          onToggleViewMode={toggleViewMode}
          viewMode={viewMode}
          categoryId={categoryData?._id}
        />

        <ContentGrid>
          {/* Folder Cards */}
          {viewMode === VIEW_MODE.folderized &&
            categoryData?._id &&
            folders?.map((folder) => (
              <FolderCard
                key={folder._id}
                folder={folder}
                categoryId={categoryData?._id}
                onClick={() => navigateToFolder(folder)}
              />
            ))}

          {/* Tag Cards */}
          {tags?.map((tag) => (
            <TagCard
              key={tag._id}
              tag={tag}
              config={categoryConfig}
              parentFolderId={parentFolderId}
            />
          ))}

          {/* Empty State */}
          {!hasContent && (
            <EmptyState
              viewMode={viewMode}
              isAtRoot={isAtRoot}
              onCreateTag={() => setCreatingTag(true)}
              config={categoryConfig}
            />
          )}
        </ContentGrid>

        {creatingTag && (
          <GenericTagDialog
            mode="create"
            isOpen={creatingTag}
            onClose={() => setCreatingTag(false)}
            config={categoryConfig}
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
