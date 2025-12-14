import { ConfirmationDialog } from '../confirmation-dialog'
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { Tag } from 'convex/tags/types'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'

interface TagDeleteConfirmDialogProps {
  tag: Tag
  categoryConfig: TagCategoryConfig
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}

export function TagDeleteConfirmDialog({
  tag,
  categoryConfig,
  isDeleting,
  onConfirm,
  onClose,
}: TagDeleteConfirmDialogProps) {
  const deleteTag = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.deleteTag),
  })

  const handleConfirm = useCallback(async () => {
    await deleteTag
      .mutateAsync({ tagId: tag._id })
      .then(() => {
        toast.success(`${tag.name || ''} deleted successfully`)
        return onConfirm?.()
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error(`Failed to delete ${categoryConfig.singular}`)
      })
      .finally(() => {
        onClose()
      })
  }, [
    deleteTag,
    tag._id,
    tag.name || '',
    categoryConfig.singular,
    onConfirm,
    onClose,
  ])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title={`Delete ${categoryConfig.singular}`}
      description={`Are you sure you want to delete this ${categoryConfig.singular}? This will also remove references in your notes. This action cannot be undone.`}
      confirmLabel={`Delete ${tag.name || ''}`}
      confirmVariant="destructive"
      isLoading={deleteTag.isPending}
    />
  )
}
