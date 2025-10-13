import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Tag } from 'convex/tags/types'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-dialogs/base-tag-dialog/types'
import GenericTagDialog from '~/components/forms/category-tag-dialogs/generic-tag-dialog/generic-dialog'
import { useCampaign } from '~/contexts/CampaignContext'
import { Edit, TagIcon, Trash2 } from '~/lib/icons'

interface TagCardProps {
  tag: Tag
  config: TagCategoryConfig
}

export function TagCard({ tag, config }: TagCardProps) {
  const router = useRouter()
  const { dmUsername, campaignSlug } = useCampaign()

  const [editing, setEditing] = useState<Tag | null>(null)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteTag = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.deleteTag),
  })

  const handleDelete = async () => {
    if (!deletingTag) return
    setIsDeleting(true)
    try {
      await deleteTag.mutateAsync({ tagId: deletingTag._id })
      setDeletingTag(null)
    } catch (_) {
      toast.error('Failed to delete tag')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <ContentCard
        key={tag._id}
        title={tag.displayName}
        description={tag.description}
        color={tag.color}
        badges={[
          {
            text: config.singular,
            icon: config.icon,
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
            icon: Edit,
            onClick: (e) => {
              e.stopPropagation()
              setEditing(tag)
            },
            'aria-label': 'Edit',
          },
          {
            icon: Trash2,
            onClick: (e) => {
              e.stopPropagation()
              setDeletingTag(tag)
            },
            'aria-label': 'Delete',
            variant: 'destructive-subtle',
          },
        ]}
      />

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
        isOpen={!!deletingTag}
        onClose={() => setDeletingTag(null)}
        onConfirm={handleDelete}
        title={`Delete ${config.singular}`}
        description={`Are you sure you want to delete ${deletingTag?.displayName}? This will also remove references in your notes. This action cannot be undone.`}
        confirmLabel={`Delete ${config.singular}`}
        isLoading={isDeleting}
        icon={TagIcon}
      />
    </>
  )
}
