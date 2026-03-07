import { useCallback } from 'react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { Folder } from 'convex/folders/types'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { getDescendantCount, useAllSidebarItems } from '~/hooks/useSidebarItems'

interface FolderDeleteConfirmDialogProps {
  folder: Folder
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}
export function FolderDeleteConfirmDialog({
  folder,
  isDeleting,
  onConfirm,
  onClose,
}: FolderDeleteConfirmDialogProps) {
  const { moveItem } = useSidebarItemMutations()
  const { parentItemsMap } = useAllSidebarItems()

  const descendantCount = getDescendantCount(folder._id, parentItemsMap)

  const handleConfirm = useCallback(async () => {
    try {
      await moveItem(folder, { deleted: true })
      onConfirm?.()
      toast.success('Moved to trash')
    } catch (error) {
      console.error(error)
      toast.error('Failed to move folder to trash')
    } finally {
      onClose()
    }
  }, [moveItem, folder, onConfirm, onClose])

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
            <span>
              Are you sure you want to move it and all its contents to the
              trash?
            </span>
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
