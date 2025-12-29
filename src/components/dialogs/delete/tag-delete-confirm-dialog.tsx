import { useCallback } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { Tag } from 'convex/tags/types'

interface TagDeleteConfirmDialogProps {
  tag: Tag
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}

export function TagDeleteConfirmDialog({
  tag,
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
        toast.success(`${tag.name || 'Untitled Tag'} deleted successfully`)
        return onConfirm?.()
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error(`Failed to delete ${tag.name || 'Untitled Tag'}`)
      })
      .finally(() => {
        onClose()
      })
  }, [deleteTag, tag._id, tag.name, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title={`Delete ${tag.name || 'Untitled Tag'}`}
      description={`Are you sure you want to delete "${tag.name || 'Untitled Tag'}"? This will also remove references in your notes. This action cannot be undone.`}
      confirmLabel={`Delete ${tag.name || 'Untitled Tag'}`}
      confirmVariant="destructive"
      isLoading={deleteTag.isPending}
    />
  )
}
