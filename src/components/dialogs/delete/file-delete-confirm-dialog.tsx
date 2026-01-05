import { useCallback } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { File } from 'convex/files/types'

interface FileDeleteConfirmDialogProps {
  file: File
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}

export function FileDeleteConfirmDialog({
  file,
  isDeleting,
  onConfirm,
  onClose,
}: FileDeleteConfirmDialogProps) {
  const deleteFileMutation = useMutation({
    mutationFn: useConvexMutation(api.files.mutations.deleteFile),
  })

  const handleConfirm = useCallback(async () => {
    await deleteFileMutation
      .mutateAsync({ fileId: file._id })
      .then(() => {
        toast.success('File deleted')
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to delete file')
      })
      .finally(() => {
        onConfirm?.()
        onClose()
      })
  }, [deleteFileMutation, file._id, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete File"
      description={`Are you sure you want to delete "${file.name || 'this file'}"? This action cannot be undone.`}
      confirmLabel="Delete File"
      confirmVariant="destructive"
      isLoading={deleteFileMutation.isPending}
    />
  )
}
