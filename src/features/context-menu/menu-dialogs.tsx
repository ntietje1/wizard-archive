import { EmptyTrashConfirmDialog } from './components/dialogs/trash-confirm-dialogs'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { handleError } from '~/shared/utils/logger'
import { MapDialog } from '~/features/editor/components/forms/map-form/map-dialog'
import { FileDialog } from '~/features/editor/components/forms/file-form/file-dialog'
import { SidebarItemEditDialog } from '~/features/sidebar/components/forms/sidebar-item-edit-dialog'

export interface MenuDialogState {
  editMapDialog: Id<'sidebarItems'> | null
  editFileDialog: Id<'sidebarItems'> | null
  editSidebarItemDialog: AnySidebarItem | null
  confirmEmptyTrash: boolean
  campaignId: Id<'campaigns'> | undefined
  closeMapDialog: () => void
  closeFileDialog: () => void
  closeSidebarItemDialog: () => void
  closeEmptyTrashDialog: () => void
  emptyTrash: () => Promise<void>
}

export function MenuDialogs({
  editMapDialog,
  editFileDialog,
  editSidebarItemDialog,
  confirmEmptyTrash,
  campaignId,
  closeMapDialog,
  closeFileDialog,
  closeSidebarItemDialog,
  closeEmptyTrashDialog,
  emptyTrash,
}: MenuDialogState) {
  return (
    <>
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
              await emptyTrash()
            } catch (error) {
              handleError(error, 'Failed to empty trash')
            }
            closeEmptyTrashDialog()
          }}
        />
      )}
    </>
  )
}
