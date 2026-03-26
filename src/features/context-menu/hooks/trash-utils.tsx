import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
} from '~/features/sidebar/utils/trash-utils'

export function EmptyTrashConfirmDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const { data: allTrashedItems, status } = useSidebarItems(
    SIDEBAR_ITEM_LOCATION.trash,
  )

  if (status === 'pending' || !allTrashedItems) {
    return null // Or a loading skeleton
  }

  return (
    <ConfirmationDialog
      isOpen={true}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Empty Trash"
      description={emptyTrashDescription(allTrashedItems.length)}
      confirmLabel="Empty Trash"
      confirmVariant="destructive"
    />
  )
}

export function PermanentDeleteConfirmDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: AnySidebarItem
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const { data: trashedItems, status } = useSidebarItems(
    SIDEBAR_ITEM_LOCATION.trash,
  )

  return (
    <ConfirmationDialog
      key={`permanent-delete-${item._id}`}
      isOpen={true}
      isLoading={status === 'pending'}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Permanently Delete"
      description={
        trashedItems ? permanentDeleteDescription(item, trashedItems) : ''
      }
      confirmLabel="Delete Forever"
      confirmVariant="destructive"
    />
  )
}
