import type { ResourceTransactionReceipt } from './transaction-contract'

type FileSystemReceiptMessage = ResourceTransactionReceipt['summary']
type FileSystemMessageKind = FileSystemReceiptMessage['kind']

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural
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

function copiedUndoMessage(message: FileSystemReceiptMessage) {
  if (message.kind !== 'copied') return null
  if (message.createdCount > 0 && message.mergedCount > 0) {
    const copiedItems = pluralize(message.createdCount, 'item')
    const folderMerges = pluralize(message.mergedCount, 'folder merge', 'folder merges')
    return `Removed ${message.createdCount} copied ${copiedItems}, reverted ${message.mergedCount} ${folderMerges}`
  }
  if (message.mergedCount > 0) {
    return message.mergedCount === 1
      ? 'Reverted folder merge'
      : `Reverted ${message.mergedCount} folder merges`
  }
  return message.createdCount === 1
    ? 'Removed copied item'
    : `Removed ${message.createdCount} copied items`
}

const successMessageFormatters: Partial<
  Record<FileSystemMessageKind, (message: FileSystemReceiptMessage) => string | null>
> = {
  created: (message) =>
    message.affectedCount === 1 ? 'Item created' : `${message.affectedCount} items created`,
  updated: () => 'Item updated',
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
  shared: () => 'Sharing updated',
  bookmarksUpdated: () => 'Bookmarks updated',
}

const undoMessageFormatters: Partial<
  Record<FileSystemMessageKind, (message: FileSystemReceiptMessage) => string | null>
> = {
  created: (message) =>
    message.affectedCount === 1 ? 'Removed created item' : `Removed ${message.affectedCount} items`,
  updated: () => 'Reverted item update',
  renamed: () => 'Reverted rename',
  copied: copiedUndoMessage,
  moved: (message) =>
    message.affectedCount === 1 ? 'Moved item back' : `Moved ${message.affectedCount} items back`,
  restored: (message) =>
    message.affectedCount === 1
      ? 'Moved item to trash'
      : `Moved ${message.affectedCount} items to trash`,
  trashed: (message) =>
    message.affectedCount === 1 ? 'Item restored' : `${message.affectedCount} items restored`,
  shared: () => 'Reverted sharing update',
  bookmarksUpdated: () => 'Reverted bookmark update',
}

function formatReceiptMessage(receipt: ResourceTransactionReceipt) {
  if (receipt.direction === 'undo') {
    return undoMessageFormatters[receipt.summary.kind]?.(receipt.summary) ?? null
  }
  const text = successMessageFormatters[receipt.summary.kind]?.(receipt.summary) ?? null
  if (!text || receipt.direction !== 'redo') return text
  return `Redo: ${text}`
}

export function getReceiptToastMessage(receipt: ResourceTransactionReceipt) {
  const { summary } = receipt
  if (summary.kind === 'noop' || summary.affectedCount === 0) {
    return summary.skippedCount > 0 ? { type: 'info' as const, text: 'No items changed' } : null
  }

  const text = formatReceiptMessage(receipt)
  if (!text) return null

  return { type: 'success' as const, text }
}
