import type { Id } from 'convex/_generated/dataModel'
import type {
  FileSystemEvent,
  FileSystemMessageKind,
  FileSystemReceiptMessage,
  FileSystemTransactionReceipt,
} from 'convex/sidebarItems/filesystem/receipts'
import { assertSidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}

function isCreatedRootEvent(event: FileSystemEvent) {
  return event.type === 'created' || event.type === 'copied'
}

function isNavigationEvent(
  event: FileSystemEvent,
  currentSlug: string | null,
): event is Extract<FileSystemEvent, { type: 'created' | 'renamed' }> {
  return (
    event.type === 'created' || (event.type === 'renamed' && event.previousSlug === currentSlug)
  )
}

export function getReceiptRemovedRootIds(
  receipt: FileSystemTransactionReceipt,
): Array<Id<'sidebarItems'>> {
  if (receipt.direction === 'undo') {
    return receipt.events
      .filter((event) => isCreatedRootEvent(event) || event.type === 'restored')
      .map((event) => event.itemId)
  }
  return receipt.events
    .filter((event) => event.type === 'trashed' || event.type === 'deletedForever')
    .map((event) => event.itemId)
}

export type ReceiptRemovedItemSnapshot = {
  _id: Id<'sidebarItems'>
  parentId: Id<'sidebarItems'> | null
  slug: SidebarItemSlug
}

export function getReceiptRemovedItemSnapshots(
  receipt: FileSystemTransactionReceipt,
): Array<ReceiptRemovedItemSnapshot> {
  return receipt.patches.flatMap((patch) => {
    if (patch.type !== 'removeSidebarItem') return []
    return [
      {
        _id: patch.snapshot._id,
        parentId: patch.snapshot.parentId,
        slug: assertSidebarItemSlug(patch.snapshot.slug),
      },
    ]
  })
}

export function getReceiptSelectedRootIds(
  receipt: FileSystemTransactionReceipt,
): Array<Id<'sidebarItems'>> {
  const selectedEventTypes =
    receipt.direction === 'undo'
      ? new Set<FileSystemEvent['type']>(['moved', 'trashed'])
      : new Set<FileSystemEvent['type']>([
          'created',
          'copied',
          'moved',
          'restored',
          'replaced',
          'mergedFolder',
        ])
  return receipt.events
    .filter((event) => selectedEventTypes.has(event.type))
    .map((event) => event.itemId)
}

export function getReceiptNavigationSlug(
  receipt: FileSystemTransactionReceipt,
  currentSlug: string | null,
): string | null {
  if (receipt.direction === 'undo') return null

  const event = receipt.events.find((candidate) => isNavigationEvent(candidate, currentSlug))
  return event?.slug ?? null
}

export function getCreatedItemResult(receipt: FileSystemTransactionReceipt | null): {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
} | null {
  const created = receipt?.events.find((event) => event.type === 'created')
  if (!created?.slug) return null
  return { id: created.itemId, slug: assertSidebarItemSlug(created.slug) }
}

export function getReceiptRenamedSlug(
  receipt: FileSystemTransactionReceipt | null,
): SidebarItemSlug | null {
  const renamed = receipt?.events.find((event) => event.type === 'renamed')
  return renamed?.slug ? assertSidebarItemSlug(renamed.slug) : null
}

function copiedMessage(message: FileSystemReceiptMessage) {
  if (message.kind !== 'copied') return null
  if (message.createdCount > 0 && message.mergedCount > 0) {
    return `Copied ${message.createdCount} ${pluralize(message.createdCount, 'item')}, merged ${message.mergedCount} ${pluralize(message.mergedCount, 'folder')}`
  }
  if (message.mergedCount > 0) {
    return message.mergedCount === 1 ? 'Folder merged' : `${message.mergedCount} folders merged`
  }
  return message.createdCount === 1 ? 'Item copied' : `${message.createdCount} items copied`
}

const successMessageFormatters: Partial<
  Record<FileSystemMessageKind, (message: FileSystemReceiptMessage) => string | null>
> = {
  copied: copiedMessage,
  moved: (message) =>
    message.affectedCount === 1 ? 'Item moved' : `${message.affectedCount} items moved`,
  restored: (message) =>
    message.affectedCount === 1 ? 'Item restored' : `${message.affectedCount} items restored`,
  trashed: (message) =>
    message.affectedCount === 1
      ? 'Moved to trash'
      : `Moved ${message.affectedCount} items to trash`,
  deletedForever: (message) =>
    message.affectedCount === 1
      ? 'Item permanently deleted'
      : `${message.affectedCount} items permanently deleted`,
}

function directionPrefix(receipt: FileSystemTransactionReceipt): string | null {
  if (receipt.direction === 'undo') return 'Undo'
  if (receipt.direction === 'redo') return 'Redo'
  return null
}

export function getReceiptToastMessage(receipt: FileSystemTransactionReceipt) {
  const { summary } = receipt
  if (summary.kind === 'noop' || summary.affectedCount === 0) {
    return summary.skippedCount > 0 ? { type: 'info' as const, text: 'No items changed' } : null
  }

  const formatter = successMessageFormatters[summary.kind]
  const text = formatter?.(summary)
  if (!text) return null

  const prefix = directionPrefix(receipt)
  return { type: 'success' as const, text: prefix ? `${prefix}: ${text}` : text }
}
