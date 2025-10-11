import { createFileRoute, useParams, useRouter } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { CreateActionCard } from '~/components/content-grid-page/create-action-card'
import { EmptyState } from '~/components/content-grid-page/empty-state'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'
import { useCampaign } from '~/contexts/CampaignContext'
import GenericTagDialog from '~/components/forms/category-tag-dialogs/generic-tag-dialog/generic-dialog'
import type { Tag } from 'convex/tags/types'
import { TagIcon, Edit, Plus, Trash2 } from '~/lib/icons'
import type { TagCategoryConfig } from '~/components/forms/category-tag-dialogs/base-tag-dialog/types'
import { PageHeader } from '~/components/content-grid-page/page-header'
import { toast } from 'sonner'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
)({
  component: GenericCategoryPage,
})

function GenericCategoryPage() {
  const { dmUsername, campaignSlug, campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const params = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
  })
  const categorySlug = params?.categorySlug
  const router = useRouter()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const categoryQuery = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id
        ? {
            campaignId: campaign._id,
            slug: categorySlug,
          }
        : 'skip',
    ),
  )

  const tags = useQuery(
    convexQuery(
      api.tags.queries.getTagsByCategory,
      campaign?._id && categoryQuery.data?._id
        ? { campaignId: campaign._id, categoryId: categoryQuery.data._id }
        : 'skip',
    ),
  )

  const config: TagCategoryConfig = {
    singular: categoryQuery.data?.displayName || '',
    plural: categoryQuery.data?.pluralDisplayName || '',
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

  if (
    campaignWithMembership.status === 'pending' ||
    categoryQuery.status === 'pending' ||
    tags.status === 'pending' ||
    !tags.data
  ) {
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
      />
      <ContentGrid>
        {tags.data.length > 0 && (
          <CreateActionCard
            onClick={() => setCreating(true)}
            title={`New ${config.singular}`}
            description={`Add a new ${config.singular.toLowerCase()} to your campaign`}
            icon={TagIcon}
          />
        )}

        {tags.data.map((tag) => (
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

        {tags.data.length === 0 && (
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
      </ContentGrid>

      {creating && (
        <GenericTagDialog
          mode="create"
          isOpen={creating}
          onClose={() => setCreating(false)}
          config={config}
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
