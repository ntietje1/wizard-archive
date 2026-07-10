import { ConfirmationDialog } from '@wizard-archive/ui/components/confirmation-dialog'
import type { AnyItem } from '../../workspace/items'
import { isFolderItem } from '../../workspace/sidebar/utils/sidebar-item-types'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
  permanentDeleteItemsDescription,
} from './descriptions'
import type { TrashStatus } from './source'

export type FileSystemTrashDialogState = {
  items: Array<AnyItem>
  status: TrashStatus
}

function needsTrashContents(items: Array<AnyItem>): boolean {
  return items.some(isFolderItem)
}

function missingRequiredTrashContents(status: TrashStatus, items: Array<AnyItem>): boolean {
  return needsTrashContents(items) && status !== 'success'
}

export function FileSystemEmptyTrashDialog({
  trashState,
  onClose,
  onConfirm,
}: {
  trashState: FileSystemTrashDialogState
  onClose: () => void
  onConfirm: () => void
}) {
  const { items: allTrashedItems, status } = trashState
  const description =
    status === 'pending'
      ? 'Loading trashed items...'
      : status === 'error'
        ? 'Trash contents could not be loaded.'
        : emptyTrashDescription(allTrashedItems.length)

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
  trashState,
  onClose,
  onConfirm,
}: {
  item: AnyItem
  trashState: FileSystemTrashDialogState
  onClose: () => void
  onConfirm: () => void
}) {
  const { items: trashedItems, status } = trashState
  const cannotConfirm = missingRequiredTrashContents(status, [item])
  const description =
    cannotConfirm && status === 'pending'
      ? 'Loading trashed items...'
      : cannotConfirm && status === 'error'
        ? 'Trash contents could not be loaded.'
        : permanentDeleteDescription(item, trashedItems)

  return (
    <ConfirmationDialog
      isOpen={true}
      isLoading={cannotConfirm && status === 'pending'}
      onClose={onClose}
      onConfirm={cannotConfirm ? () => {} : onConfirm}
      title="Permanently Delete"
      description={description}
      confirmLabel="Delete Forever"
      confirmVariant="destructive"
      disabled={cannotConfirm}
    />
  )
}

export function FileSystemPermanentDeleteDialog({
  items,
  trashState,
  onClose,
  onConfirm,
}: {
  items: Array<AnyItem>
  trashState: FileSystemTrashDialogState
  onClose: () => void
  onConfirm: () => void
}) {
  if (items.length === 0) return null
  const { items: trashedItems, status } = trashState

  if (items.length === 1) {
    return (
      <FileSystemSinglePermanentDeleteDialog
        item={items[0]}
        trashState={trashState}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    )
  }

  const cannotConfirm = missingRequiredTrashContents(status, items)
  const description =
    cannotConfirm && status === 'pending'
      ? 'Loading trashed items...'
      : cannotConfirm && status === 'error'
        ? 'Trash contents could not be loaded.'
        : permanentDeleteItemsDescription(items, trashedItems)

  return (
    <ConfirmationDialog
      isOpen={true}
      isLoading={cannotConfirm && status === 'pending'}
      onClose={onClose}
      onConfirm={cannotConfirm ? () => {} : onConfirm}
      title="Permanently Delete Items"
      description={description}
      confirmLabel="Delete Forever"
      confirmVariant="destructive"
      disabled={cannotConfirm}
    />
  )
}
