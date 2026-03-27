import { toast } from 'sonner'
import {
  EmptyTrashConfirmDialog,
  PermanentDeleteConfirmDialog,
} from './hooks/trash-utils'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { handleError } from '~/shared/utils/logger'
import { MapDialog } from '~/features/editor/components/forms/map-form/map-dialog'
import { FileDialog } from '~/features/editor/components/forms/file-form/file-dialog'
import { SidebarItemEditDialog } from '~/features/sidebar/components/forms/sidebar-item-edit-dialog'
import { FolderDeleteConfirmDialog } from '~/features/sidebar/components/folder-delete-confirm-dialog'
import { getSelectedSlug } from '~/features/sidebar/hooks/useSelectedItem'

export interface MenuDialogState {
  deleteFolderDialog: Folder | null
  editMapDialog: Id<'gameMaps'> | null
  editFileDialog: Id<'files'> | null
  editSidebarItemDialog: AnySidebarItem | null
  confirmPermanentDeleteItem: AnySidebarItem | null
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
}

export function MenuDialogs({
  deleteFolderDialog,
  editMapDialog,
  editFileDialog,
  editSidebarItemDialog,
  confirmPermanentDeleteItem,
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
}: MenuDialogState) {
  return (
    <>
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

      {confirmPermanentDeleteItem && (
        <PermanentDeleteConfirmDialog
          item={confirmPermanentDeleteItem}
          onClose={closePermanentDeleteDialog}
          onConfirm={async () => {
            try {
              await permanentlyDeleteItem(confirmPermanentDeleteItem)
              toast.success('Item permanently deleted')
              const currentSlug = getSelectedSlug()
              if (confirmPermanentDeleteItem.slug === currentSlug) {
                clearEditorContent()
              }
            } catch (error) {
              handleError(error, 'Failed to delete item')
            }
            closePermanentDeleteDialog()
          }}
        />
      )}
    </>
  )
}
