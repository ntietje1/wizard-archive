import { useCallback } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { TagCategory } from 'convex/tags/types'

interface CategoryDeleteConfirmDialogProps {
  category: TagCategory
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}

export function CategoryDeleteConfirmDialog({
  category,
  isDeleting,
  onConfirm,
  onClose,
}: CategoryDeleteConfirmDialogProps) {
  const deleteCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.deleteTagCategory),
  })

  const handleConfirm = useCallback(async () => {
    await deleteCategory
      .mutateAsync({ categoryId: category._id })
      .then(() => {
        toast.success('Category deleted successfully')
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to delete category')
      })
      .finally(() => {
        onConfirm?.()
        onClose()
      })
  }, [deleteCategory, category._id, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Category"
      description="Are you sure you want to delete this category? This will also delete all tags and notes in this category. This action cannot be undone."
      confirmLabel="Delete Category"
      confirmVariant="destructive"
      isLoading={deleteCategory.isPending}
    />
  )
}
