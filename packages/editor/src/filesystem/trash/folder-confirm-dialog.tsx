import { useState } from 'react'
import { ConfirmationDialog } from '@wizard-archive/ui/components/confirmation-dialog'
import { handleError } from '../../errors/handle-error'

interface FolderDeleteConfirmDialogProps {
  descendantCount: number
  isDeleting: boolean
  onTrash: () => Promise<void>
  onConfirm?: () => void
  onClose: () => void
}

export function FolderDeleteConfirmDialog({
  descendantCount,
  isDeleting,
  onTrash,
  onConfirm,
  onClose,
}: FolderDeleteConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async (): Promise<void> => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await onTrash()
      onConfirm?.()
      onClose()
    } catch (error) {
      handleError(error, 'Failed to move folder to trash')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      isLoading={isSubmitting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Move to Trash"
      description={
        descendantCount > 0 ? (
          <>
            <strong className="text-primary">
              {`This folder contains ${descendantCount} ${descendantCount === 1 ? 'item' : 'items'}!`}
            </strong>
            <br />
            <span>Are you sure you want to move it and all its contents to the trash?</span>
          </>
        ) : (
          <>Are you sure you want to move this folder to the trash?</>
        )
      }
      confirmLabel="Move to Trash"
      confirmVariant="destructive"
    />
  )
}
