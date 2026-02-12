import { useCallback } from 'react'
import { toast } from 'sonner'
import { useLiveQuery } from '@tanstack/react-db'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { Folder } from 'convex/folders/types'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useSidebarItemsCollection } from '~/hooks/useSidebarItemsCollection'

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
  const { deleteItem } = useSidebarItemMutations()
  const collection = useSidebarItemsCollection()

  const children = useLiveQuery(
    (q) => {
      if (!collection) return undefined
      return q
        .from({ item: collection })
        .fn.where((row) => row.item.parentId === folder._id)
    },
    [collection, folder._id],
  )

  const hasDirectChildren = (children?.data?.length ?? 0) > 0

  const handleConfirm = useCallback(async () => {
    try {
      const tx = deleteItem(folder)
      if (tx) {
        await tx.isPersisted.promise
        toast.success('Folder deleted')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete folder')
    } finally {
      onConfirm?.()
      onClose()
    }
  }, [deleteItem, folder, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Folder"
      description={
        hasDirectChildren ? (
          <>
            <strong className="text-red-600">
              {"This folder isn't empty!"}
            </strong>
            <br />
            <span>
              Are you sure you want to delete it and all its contents?
            </span>
          </>
        ) : (
          <>Are you sure you want to delete this folder?</>
        )
      }
      confirmLabel="Delete Folder"
      confirmVariant="destructive"
    />
  )
}
