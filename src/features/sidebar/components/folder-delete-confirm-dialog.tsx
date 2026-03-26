import { toast } from 'sonner'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { Folder } from 'convex/folders/types'
import { logger } from '~/shared/utils/logger'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { useMoveSidebarItem } from '~/features/sidebar/hooks/useMoveSidebarItem'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { collectDescendantIds } from '~/features/sidebar/utils/sidebar-item-maps'

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
  const { moveItem } = useMoveSidebarItem()
  const { data } = useActiveSidebarItems()

  const descendantCount = collectDescendantIds(folder._id, data).size

  const handleConfirm = async () => {
    try {
      await moveItem(folder, { location: SIDEBAR_ITEM_LOCATION.trash })
      onConfirm?.()
      toast.success('Moved to trash')
    } catch (error) {
      logger.error(error)
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
