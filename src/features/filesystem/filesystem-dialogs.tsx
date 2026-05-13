import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { PermanentDeleteConfirmDialog } from '~/features/context-menu/components/dialogs/trash-confirm-dialogs'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

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
      <PermanentDeleteConfirmDialog
        item={items[0]}
        onClose={onClose}
        onConfirm={() => Promise.resolve(onConfirm())}
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
