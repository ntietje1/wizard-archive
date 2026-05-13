import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { useTrashSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
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
      onConfirm={onConfirm}
      title="Permanently Delete"
      description={description}
      confirmLabel="Delete Forever"
      confirmVariant="destructive"
    />
  )
}
