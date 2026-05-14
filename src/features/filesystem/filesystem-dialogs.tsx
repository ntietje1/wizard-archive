import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useTrashSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
} from '~/features/sidebar/utils/trash-utils'

export function FileSystemEmptyTrashDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => void
}) {
  const { data: allTrashedItems, status } = useTrashSidebarItems()
  const description =
    status === 'pending'
      ? 'Loading trashed items...'
      : status === 'error'
        ? 'Trash contents could not be loaded.'
        : emptyTrashDescription(allTrashedItems?.length ?? 0)

  return (
    <ConfirmationDialog
      isOpen={true}
      isLoading={status === 'pending'}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Empty Trash"
      description={description}
      confirmLabel="Empty Trash"
      confirmVariant="destructive"
      disabled={status === 'error'}
    />
  )
}

function FileSystemSinglePermanentDeleteDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: AnySidebarItem
  onClose: () => void
  onConfirm: () => void
}) {
  const { data: trashedItems, status } = useTrashSidebarItems()
  const description =
    status === 'pending'
      ? 'Loading trashed items...'
      : status === 'error'
        ? 'Trash contents could not be loaded.'
        : permanentDeleteDescription(item, trashedItems ?? [])

  return (
    <ConfirmationDialog
      isOpen={true}
      isLoading={status === 'pending'}
      onClose={onClose}
      onConfirm={status === 'error' ? () => {} : onConfirm}
      title="Permanently Delete"
      description={description}
      confirmLabel="Delete Forever"
      confirmVariant="destructive"
      disabled={status === 'error'}
    />
  )
}

export function FileSystemPermanentDeleteDialog({
  items,
  onClose,
  onConfirm,
}: {
  items: Array<AnySidebarItem>
  onClose: () => void
  onConfirm: () => void
}) {
  if (items.length === 0) return null

  if (items.length === 1) {
    return (
      <FileSystemSinglePermanentDeleteDialog
        item={items[0]}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    )
  }

  return (
    <ConfirmationDialog
      isOpen={true}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Permanently Delete Items"
      description={`This will permanently delete ${items.length} selected items and cannot be undone.`}
      confirmLabel="Delete Forever"
      confirmVariant="destructive"
    />
  )
}
