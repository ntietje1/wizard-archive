import type { Folder } from 'shared/folders/types'
import { handleError } from '~/shared/utils/logger'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useFilteredSidebarItems'
import { collectDescendantIds } from '~/features/sidebar/utils/sidebar-item-maps'

interface FolderDeleteConfirmDialogProps {
  folder: Folder
  isDeleting: boolean
  onTrash: () => Promise<void>
  onConfirm?: () => void
  onClose: () => void
}
export function FolderDeleteConfirmDialog({
  folder,
  isDeleting,
  onTrash,
  onConfirm,
  onClose,
}: FolderDeleteConfirmDialogProps) {
  const { data } = useFilteredSidebarItems()

  const descendantCount = collectDescendantIds(folder._id, data).size

  const handleConfirm = async (): Promise<void> => {
    try {
      await onTrash()
      onConfirm?.()
    } catch (error) {
      handleError(error, 'Failed to move folder to trash')
    }
    onClose()
  }

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
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
