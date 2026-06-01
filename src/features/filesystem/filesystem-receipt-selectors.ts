import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_STATUS } from 'shared/sidebar-items/types'
import type {
  FileSystemEvent,
  FileSystemMessageKind,
  FileSystemReceiptMessage,
  FileSystemTransactionReceipt,
} from 'shared/sidebar-items/filesystem/receipts'
import { assertSidebarItemSlug } from 'shared/sidebar-items/slug'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}

function createReceiptEventGroups(receipt: FileSystemTransactionReceipt) {
  return {
    created: receipt.events.filter((event) => event.type === 'created'),
    renamed: receipt.events.filter((event) => event.type === 'renamed'),
    copied: receipt.events.filter((event) => event.type === 'copied'),
    moved: receipt.events.filter((event) => event.type === 'moved'),
    trashed: receipt.events.filter((event) => event.type === 'trashed'),
    restored: receipt.events.filter((event) => event.type === 'restored'),
    mergedFolder: receipt.events.filter((event) => event.type === 'mergedFolder'),
    deletedForever: receipt.events.filter((event) => event.type === 'deletedForever'),
  }
}

function isNavigationEvent(
  event: FileSystemEvent,
  direction: FileSystemTransactionReceipt['direction'],
  currentSlug: string | null,
): event is Extract<FileSystemEvent, { type: 'created' | 'renamed' }> {
  return (
    (event.type === 'created' && direction === 'forward') ||
    (event.type === 'renamed' && event.previousSlug === currentSlug)
  )
}

export function getReceiptRemovedRootIds(
  receipt: FileSystemTransactionReceipt,
): Array<Id<'sidebarItems'>> {
  return receipt.patches.flatMap((patch) => {
    if (patch.type === 'removeSidebarItem') return [patch.itemId]
    if (patch.type !== 'updateSidebarItem') return []
    return patch.fields.status === SIDEBAR_ITEM_STATUS.undoHidden ||
      patch.fields.status === SIDEBAR_ITEM_STATUS.trashed
      ? [patch.itemId]
      : []
  })
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
    if (patch.type === 'removeSidebarItem') {
      return [
        {
          _id: patch.snapshot._id,
          parentId: patch.snapshot.parentId,
          slug: assertSidebarItemSlug(patch.snapshot.slug),
        },
      ]
    }
    if (patch.type !== 'updateSidebarItem') return []
    if (
      patch.fields.status !== SIDEBAR_ITEM_STATUS.undoHidden &&
      patch.fields.status !== SIDEBAR_ITEM_STATUS.trashed
    ) {
      return []
    }
    if (typeof patch.before.slug !== 'string' || !('parentId' in patch.before)) return []
    return [
      {
        _id: patch.itemId,
        parentId: patch.before.parentId ?? null,
        slug: assertSidebarItemSlug(patch.before.slug),
      },
    ]
  })
}

export function getReceiptSelectedRootIds(
  receipt: FileSystemTransactionReceipt,
): Array<Id<'sidebarItems'>> {
  const events = createReceiptEventGroups(receipt)
  const selectedEvents =
    receipt.direction === 'undo'
      ? [...events.moved, ...events.trashed]
      : [
          ...events.created,
          ...events.copied,
          ...events.moved,
          ...events.restored,
          ...events.mergedFolder,
        ]
  return selectedEvents.map((event) => event.itemId)
}

export function getReceiptNavigationSlug(
  receipt: FileSystemTransactionReceipt,
  currentSlug: string | null,
): string | null {
  if (receipt.direction === 'undo') return null

  const events = createReceiptEventGroups(receipt)
  const event = [...events.created, ...events.renamed].find((candidate) =>
    isNavigationEvent(candidate, receipt.direction, currentSlug),
  )
  return event?.slug ?? null
}

export function getCreatedItemResult(receipt: FileSystemTransactionReceipt | null): {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
  transactionId: Id<'filesystemTransactions'>
} | null {
  const created = receipt ? createReceiptEventGroups(receipt).created[0] : null
  if (!created?.slug || !receipt?.transactionId) return null
  return {
    id: created.itemId,
    slug: assertSidebarItemSlug(created.slug),
    transactionId: receipt.transactionId,
  }
}

export function getReceiptRenamedSlug(
  receipt: FileSystemTransactionReceipt | null,
): SidebarItemSlug | null {
  const renamed = receipt ? createReceiptEventGroups(receipt).renamed[0] : null
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
  created: (message) =>
    message.affectedCount === 1 ? 'Item created' : `${message.affectedCount} items created`,
  renamed: () => 'Item renamed',
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

const undoMessageFormatters: Partial<
  Record<FileSystemMessageKind, (message: FileSystemReceiptMessage) => string | null>
> = {
  created: (message) =>
    message.affectedCount === 1 ? 'Removed created item' : `Removed ${message.affectedCount} items`,
  renamed: () => 'Reverted rename',
  copied: (message) =>
    message.createdCount === 1
      ? 'Removed copied item'
      : `Removed ${message.createdCount} copied items`,
  moved: (message) =>
    message.affectedCount === 1 ? 'Moved item back' : `Moved ${message.affectedCount} items back`,
  restored: (message) =>
    message.affectedCount === 1
      ? 'Moved item to trash'
      : `Moved ${message.affectedCount} items to trash`,
  trashed: (message) =>
    message.affectedCount === 1 ? 'Item restored' : `${message.affectedCount} items restored`,
}

function formatReceiptMessage(receipt: FileSystemTransactionReceipt) {
  if (receipt.direction === 'undo') {
    return undoMessageFormatters[receipt.summary.kind]?.(receipt.summary) ?? null
  }
  const text = successMessageFormatters[receipt.summary.kind]?.(receipt.summary) ?? null
  if (!text || receipt.direction !== 'redo') return text
  return `Redo: ${text}`
}

export function getReceiptToastMessage(receipt: FileSystemTransactionReceipt) {
  const { summary } = receipt
  if (summary.kind === 'noop' || summary.affectedCount === 0) {
    return summary.skippedCount > 0 ? { type: 'info' as const, text: 'No items changed' } : null
  }

  const text = formatReceiptMessage(receipt)
  if (!text) return null

  return { type: 'success' as const, text }
}
