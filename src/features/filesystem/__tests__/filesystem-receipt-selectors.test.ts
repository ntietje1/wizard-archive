import { describe, expect, it } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'convex/sidebarItems/filesystem/receipts'
import {
  getReceiptRemovedRootIds,
  getReceiptSelectedRootIds,
} from '../filesystem-receipt-selectors'

function receipt(
  direction: FileSystemTransactionReceipt['direction'],
  events: FileSystemTransactionReceipt['events'],
): FileSystemTransactionReceipt {
  return {
    transactionId: 'transaction_1' as Id<'filesystemTransactions'>,
    direction,
    command: { type: 'move', itemIds: [], targetParentId: null },
    events,
    patches: [],
    summary: {
      kind: 'moved',
      affectedCount: events.length,
      createdCount: 0,
      mergedCount: 0,
      skippedCount: 0,
    },
    undoable: true,
  }
}

describe('filesystem receipt selectors', () => {
  it('selects moved roots after forward, undo, and redo receipts', () => {
    const itemId = 'item_1' as Id<'sidebarItems'>

    expect(getReceiptSelectedRootIds(receipt('forward', [{ type: 'moved', itemId }]))).toEqual([
      itemId,
    ])
    expect(getReceiptSelectedRootIds(receipt('undo', [{ type: 'moved', itemId }]))).toEqual([
      itemId,
    ])
    expect(getReceiptSelectedRootIds(receipt('redo', [{ type: 'moved', itemId }]))).toEqual([
      itemId,
    ])
  })

  it('treats undoing restore as removing the restored item from active selection', () => {
    const itemId = 'item_1' as Id<'sidebarItems'>

    expect(getReceiptRemovedRootIds(receipt('undo', [{ type: 'restored', itemId }]))).toEqual([
      itemId,
    ])
    expect(getReceiptSelectedRootIds(receipt('undo', [{ type: 'restored', itemId }]))).toEqual([])
  })
})
