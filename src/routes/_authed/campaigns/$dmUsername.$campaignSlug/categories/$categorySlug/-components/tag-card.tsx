import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Tag } from 'convex/tags/types'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import { useCampaign } from '~/contexts/CampaignContext'
import { Edit, TagIcon, Trash2 } from '~/lib/icons'
import { useDraggable } from '@dnd-kit/core'
import { CATEGORY_ITEM_TYPES, type CategoryDragData } from './dnd-utils'
import type { Id } from 'convex/_generated/dataModel'
import { getCategoryIcon } from '~/lib/category-icons'
import { useCategoryDrag } from '~/contexts/CategoryDragContext'
import { Card, CardContent, CardHeader } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'

interface TagCardProps {
  tag?: Tag
  config?: TagCategoryConfig
  parentFolderId?: Id<'folders'>
  isLoading?: boolean
}

export function TagCard({
  tag,
  config,
  parentFolderId,
  isLoading = false,
}: TagCardProps) {
  const router = useRouter()
  const { dmUsername, campaignSlug } = useCampaign()
  const { activeDragItem } = useCategoryDrag()
  const isDisabled = activeDragItem !== null

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

  const dragData: CategoryDragData | undefined =
    tag && config
      ? {
          _id: tag._id,
          type: CATEGORY_ITEM_TYPES.tags,
          name: tag.displayName,
          parentFolderId,
          noteId: tag.noteId,
          icon: getCategoryIcon(tag.category?.iconName ?? 'TagIcon'),
        }
      : undefined

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: tag?._id ?? '',
    data: dragData,
    disabled: isDisabled || !tag,
  })

  if (isLoading || !tag || !config) {
    return (
      <Card className="h-[180px]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="w-8 h-8 rounded" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={isDragging ? 'opacity-50' : ''}
      >
        <ContentCard
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
          onClick={
            isDragging
              ? () => {}
              : () =>
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
              disabled: isDisabled,
            },
            {
              icon: Trash2,
              onClick: (e) => {
                e.stopPropagation()
                setDeletingTag(tag)
              },
              'aria-label': 'Delete',
              variant: 'destructive-subtle',
              disabled: isDisabled,
            },
          ]}
        />
      </div>

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
