import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
} from '~/lib/trash-utils'

export function EmptyTrashConfirmDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const { data: allTrashedItems, status } = useTrashedSidebarItems()

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
  const { parentItemsMap: trashedParentItemsMap, status } =
    useTrashedSidebarItems()

  return (
    <ConfirmationDialog
      key={`permanent-delete-${item._id}`}
      isOpen={true}
      isLoading={status === 'pending'}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Permanently Delete"
      description={permanentDeleteDescription(item, trashedParentItemsMap)}
      confirmLabel="Delete Forever"
      confirmVariant="destructive"
    />
  )
}
