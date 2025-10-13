import {
  createFileRoute,
  useParams,
  useRouter,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { FolderCard } from '~/components/content-grid-page/folder-card'
import { CreateActionCard } from '~/components/content-grid-page/create-action-card'
import { EmptyState } from '~/components/content-grid-page/empty-state'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'
import { useCampaign } from '~/contexts/CampaignContext'
import GenericTagDialog from '~/components/forms/category-tag-dialogs/generic-tag-dialog/generic-dialog'
import type { Tag } from 'convex/tags/types'
import {
  TagIcon,
  Edit,
  Plus,
  Trash2,
  Folder as FolderIcon,
  FolderPlus,
} from '~/lib/icons'
import type { TagCategoryConfig } from '~/components/forms/category-tag-dialogs/base-tag-dialog/types'
import { PageHeader } from '~/components/content-grid-page/page-header'
import { toast } from 'sonner'
import { Button } from '~/components/shadcn/ui/button'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '~/components/shadcn/ui/breadcrumb'
import { useCategoryView, VIEW_MODE } from '~/hooks/useCategoryView'
import { useFolderActions } from '~/hooks/useFolderActions'

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
  const { dmUsername, campaignSlug, campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const params = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
  })
  const categorySlug = params?.categorySlug
  const router = useRouter()
  const navigate = useNavigate()
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
  })

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const config: TagCategoryConfig = {
    singular: categoryData?.displayName || '',
    plural: categoryData?.pluralDisplayName || '',
    categorySlug,
    icon: TagIcon,
  }

  const deleteTag = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.deleteTag),
  })

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      await deleteTag.mutateAsync({ tagId: deleting._id })
      setDeleting(null)
    } catch (_) {
      toast.error('Failed to delete tag')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!campaign || !categoryData) return

    try {
      await createFolder.mutateAsync({
        campaignId: campaign._id,
        categoryId: categoryData._id,
        parentFolderId: search.folderId as any,
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

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <PageHeader
          title={config.plural}
          description={`Manage ${config.plural.toLowerCase()} for your campaign. Each ${config.singular.toLowerCase()} automatically creates a tag that can be used in your notes.`}
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
      <PageHeader
        title={config.plural}
        description={`Manage ${config.plural.toLowerCase()} for your campaign. Each ${config.singular.toLowerCase()} automatically creates a tag that can be used in your notes.`}
        actions={
          <div className="flex gap-2">
            {viewMode === VIEW_MODE.folderized && (
              <Button variant="outline" onClick={handleCreateFolder}>
                <FolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </Button>
            )}
            <Button variant="outline" onClick={toggleViewMode}>
              {viewMode === VIEW_MODE.flat ? 'Show Folders' : 'Hide Folders'}
            </Button>
          </div>
        }
      />

      {showBreadcrumbs && (
        <div className="mb-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => navigateToBreadcrumb(-1)}
                  className="cursor-pointer"
                >
                  {config.plural}
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((ancestor, index) => (
                <div key={ancestor.id} className="flex items-center gap-1.5">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {index === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage>{ancestor.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        onClick={() => navigateToBreadcrumb(index)}
                        className="cursor-pointer"
                      >
                        {ancestor.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}

      <ContentGrid>
        {/* Create Action Card */}
        {hasContent && (
          <CreateActionCard
            onClick={() => setCreating(true)}
            title={`New ${config.singular}`}
            description={`Add a new ${config.singular.toLowerCase()} to your campaign`}
            icon={TagIcon}
          />
        )}

        {/* Folder Cards */}
        {viewMode === VIEW_MODE.folderized &&
          folders?.map((folder) => (
            <FolderCard
              key={folder._id}
              name={folder.name || 'Untitled Folder'}
              hasContent={true}
              onClick={() => navigateToFolder(folder)}
            />
          ))}

        {/* Tag Cards */}
        {tags?.map((tag) => (
          <ContentCard
            key={tag._id}
            title={tag.displayName}
            description={tag.description}
            color={tag.color}
            badges={[
              {
                text: config.singular,
                icon: <TagIcon className="w-3 h-3" />,
                variant: 'secondary',
              },
            ]}
            onClick={() =>
              router.navigate({
                to: '/campaigns/$dmUsername/$campaignSlug/notes',
                params: { dmUsername, campaignSlug },
              })
            }
            actionButtons={[
              {
                icon: <Edit className="w-4 h-4" />,
                onClick: (e) => {
                  e.stopPropagation()
                  setEditing(tag)
                },
                'aria-label': 'Edit',
              },
              {
                icon: <Trash2 className="w-4 h-4" />,
                onClick: (e) => {
                  e.stopPropagation()
                  setDeleting(tag)
                },
                'aria-label': 'Delete',
                variant: 'destructive-subtle',
              },
            ]}
          />
        ))}

        {/* Empty State */}
        {!hasContent && viewMode === VIEW_MODE.flat && (
          <EmptyState
            icon={TagIcon}
            title={`No ${config.plural.toLowerCase()} yet`}
            description={`Create your first ${config.singular.toLowerCase()} to start organizing your campaign.`}
            action={{
              label: `Create First ${config.singular}`,
              onClick: () => setCreating(true),
              icon: Plus,
            }}
          />
        )}

        {!hasContent && viewMode === VIEW_MODE.folderized && isAtRoot && (
          <EmptyState
            icon={TagIcon}
            title={`No ${config.plural.toLowerCase()} yet`}
            description={`Create your first ${config.singular.toLowerCase()} to start organizing your campaign.`}
            action={{
              label: `Create First ${config.singular}`,
              onClick: () => setCreating(true),
              icon: Plus,
            }}
          />
        )}

        {!hasContent && viewMode === VIEW_MODE.folderized && !isAtRoot && (
          <EmptyState
            icon={FolderIcon}
            title="No content in this folder"
            description={`This folder is empty. Create a ${config.singular.toLowerCase()} to get started.`}
            action={{
              label: `Create ${config.singular}`,
              onClick: () => setCreating(true),
              icon: Plus,
            }}
          />
        )}
      </ContentGrid>

      {creating && (
        <GenericTagDialog
          mode="create"
          isOpen={creating}
          onClose={() => setCreating(false)}
          config={config}
          parentFolderId={search.folderId as any}
        />
      )}

      {editing && (
        <GenericTagDialog
          mode="edit"
          isOpen={true}
          onClose={() => setEditing(null)}
          config={config}
          tag={editing}
        />
      )}

      <ConfirmationDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete ${config.singular}`}
        description={`Are you sure you want to delete ${deleting?.displayName}? This will also remove references in your notes. This action cannot be undone.`}
        confirmLabel={`Delete ${config.singular}`}
        isLoading={isDeleting}
        icon={TagIcon}
      />
    </div>
  )
}
