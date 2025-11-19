import { ConfirmationDialog } from '../confirmation-dialog'
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { Folder } from 'convex/notes/types'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'

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
  const { deleteFolder } = useFolderActions()
  const sidebarItemsByParent = useSidebarItemsByParent(
    folder.categoryId,
    folder._id,
  )
  const hasDirectChildren =
    folder && (sidebarItemsByParent.data?.length || 0) > 0
  const handleConfirm = useCallback(async () => {
    await deleteFolder
      .mutateAsync({ folderId: folder._id })
      .then(() => {
        toast.success('Folder deleted')
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to delete folder')
      })
      .finally(() => {
        onConfirm?.()
        onClose()
      })
  }, [deleteFolder, folder._id, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Folder"
      description={
        hasDirectChildren ? (
          <p>
            <strong className="text-red-600">This folder isn't empty!</strong>
            <br />
            <span>
              Are you sure you want to delete it and all its contents?
            </span>
          </p>
        ) : (
          <p>Are you sure you want to delete this folder?</p>
        )
      }
      confirmLabel="Delete Folder"
      confirmVariant="destructive"
    />
  )
}
