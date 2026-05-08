import { toast } from 'sonner'
import type { ReactNode } from 'react'
import { EmptyTrashConfirmDialog, PermanentDeleteConfirmDialog } from './hooks/trash-utils'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { handleError } from '~/shared/utils/logger'
import { MapDialog } from '~/features/editor/components/forms/map-form/map-dialog'
import { FileDialog } from '~/features/editor/components/forms/file-form/file-dialog'
import { SidebarItemEditDialog } from '~/features/sidebar/components/forms/sidebar-item-edit-dialog'
import { FolderDeleteConfirmDialog } from '~/features/sidebar/components/folder-delete-confirm-dialog'
import { getSelectedSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'

export interface MenuDialogState {
  deleteFolderDialog: Folder | null
  editMapDialog: Id<'sidebarItems'> | null
  editFileDialog: Id<'sidebarItems'> | null
  editSidebarItemDialog: AnySidebarItem | null
  confirmPermanentDeleteItems: Array<AnySidebarItem> | null
  confirmEmptyTrash: boolean
  campaignId: Id<'campaigns'> | undefined
  closeFolderDialog: () => void
  closeMapDialog: () => void
  closeFileDialog: () => void
  closeSidebarItemDialog: () => void
  closePermanentDeleteDialog: () => void
  closeEmptyTrashDialog: () => void
  clearEditorContent: () => void
  permanentlyDeleteItem: (item: AnySidebarItem) => Promise<void>
  emptyTrashBin: () => Promise<void>
  operationDialog?: ReactNode
}

export function MenuDialogs({
  deleteFolderDialog,
  editMapDialog,
  editFileDialog,
  editSidebarItemDialog,
  confirmPermanentDeleteItems,
  confirmEmptyTrash,
  campaignId,
  closeFolderDialog,
  closeMapDialog,
  closeFileDialog,
  closeSidebarItemDialog,
  closePermanentDeleteDialog,
  closeEmptyTrashDialog,
  clearEditorContent,
  permanentlyDeleteItem,
  emptyTrashBin,
  operationDialog,
}: MenuDialogState) {
  return (
    <>
      {operationDialog}

      {deleteFolderDialog && (
        <FolderDeleteConfirmDialog
          key={`delete-folder-${deleteFolderDialog._id}`}
          folder={deleteFolderDialog}
          isDeleting={true}
          onConfirm={() => {
            const currentSlug = getSelectedSlug()
            if (deleteFolderDialog.slug === currentSlug) {
              clearEditorContent()
            }
          }}
          onClose={closeFolderDialog}
        />
      )}

      {editMapDialog && campaignId && (
        <MapDialog
          key={`edit-map-${editMapDialog}`}
          mapId={editMapDialog}
          isOpen={true}
          onClose={closeMapDialog}
          campaignId={campaignId}
        />
      )}

      {editFileDialog && campaignId && (
        <FileDialog
          key={`edit-file-${editFileDialog}`}
          fileId={editFileDialog}
          isOpen={true}
          onClose={closeFileDialog}
          campaignId={campaignId}
          onSuccess={closeFileDialog}
        />
      )}

      {editSidebarItemDialog && (
        <SidebarItemEditDialog
          key={`edit-sidebar-item-${editSidebarItemDialog._id}`}
          item={editSidebarItemDialog}
          isOpen={true}
          onClose={closeSidebarItemDialog}
        />
      )}

      {confirmEmptyTrash && (
        <EmptyTrashConfirmDialog
          onClose={closeEmptyTrashDialog}
          onConfirm={async () => {
            if (!campaignId) return
            try {
              await emptyTrashBin()
              toast.success('Trash emptied')
            } catch (error) {
              handleError(error, 'Failed to empty trash')
            }
            closeEmptyTrashDialog()
          }}
        />
      )}

      {confirmPermanentDeleteItems && confirmPermanentDeleteItems.length === 1 && (
        <PermanentDeleteConfirmDialog
          item={confirmPermanentDeleteItems[0]}
          onClose={closePermanentDeleteDialog}
          onConfirm={async () => {
            try {
              await permanentlyDeleteItem(confirmPermanentDeleteItems[0])
              toast.success('Item permanently deleted')
              const currentSlug = getSelectedSlug()
              if (confirmPermanentDeleteItems[0].slug === currentSlug) {
                clearEditorContent()
              }
            } catch (error) {
              handleError(error, 'Failed to delete item')
            }
            closePermanentDeleteDialog()
          }}
        />
      )}

      {confirmPermanentDeleteItems && confirmPermanentDeleteItems.length > 1 && (
        <ConfirmationDialog
          isOpen={true}
          onClose={closePermanentDeleteDialog}
          onConfirm={async () => {
            const results = await Promise.allSettled(
              confirmPermanentDeleteItems.map((item) => permanentlyDeleteItem(item)),
            )
            const deletedItems = confirmPermanentDeleteItems.filter(
              (_, index) => results[index]?.status === 'fulfilled',
            )
            const failures = results.filter((result) => result.status === 'rejected')
            if (deletedItems.length > 0) {
              toast.success(
                deletedItems.length === 1
                  ? 'Item permanently deleted'
                  : `${deletedItems.length} items permanently deleted`,
              )
              const currentSlug = getSelectedSlug()
              if (deletedItems.some((item) => item.slug === currentSlug)) {
                clearEditorContent()
              }
            }
            if (failures.length > 0) {
              handleError(new Error(`${failures.length} deletes failed`), 'Failed to delete items')
            }
            closePermanentDeleteDialog()
          }}
          title="Permanently Delete Items"
          description={`This will permanently delete ${confirmPermanentDeleteItems.length} selected items and cannot be undone.`}
          confirmLabel="Delete Forever"
          confirmVariant="destructive"
        />
      )}
    </>
  )
}
