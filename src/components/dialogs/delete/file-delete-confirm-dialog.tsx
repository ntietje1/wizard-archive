import { useCallback } from 'react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { File } from 'convex/files/types'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'

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
  const { deleteItem } = useSidebarItemMutations()

  const handleConfirm = useCallback(async () => {
    try {
      await deleteItem(file)
      toast.success('File deleted')
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete file')
    } finally {
      onConfirm?.()
      onClose()
    }
  }, [deleteItem, file, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete File"
      description={`Are you sure you want to delete "${file.name || 'this file'}"? This action cannot be undone.`}
      confirmLabel="Delete File"
      confirmVariant="destructive"
    />
  )
}
