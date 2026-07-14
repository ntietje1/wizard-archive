import type { ResourceTransactionReceipt } from './transaction-contract'

type FileSystemReceiptMessage = ResourceTransactionReceipt['summary']
type FileSystemMessageKind = FileSystemReceiptMessage['kind']

function copiedMessage(message: FileSystemReceiptMessage) {
  if (message.kind !== 'copied') return null
  return message.createdCount === 1 ? 'Item copied' : `${message.createdCount} items copied`
}

function copiedUndoMessage(message: FileSystemReceiptMessage) {
  if (message.kind !== 'copied') return null
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
    return null
  }

  const text = formatReceiptMessage(receipt)
  if (!text) return null

  return { type: 'success' as const, text }
}
