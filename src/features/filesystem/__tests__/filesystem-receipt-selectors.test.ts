import { describe, expect, it } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import {
  getReceiptRemovedRootIds,
  getReceiptSelectedRootIds,
} from '../filesystem-receipt-selectors'

function receipt(
  direction: FileSystemTransactionReceipt['direction'],
  events: FileSystemTransactionReceipt['events'],
  patches: FileSystemTransactionReceipt['patches'] = [],
): FileSystemTransactionReceipt {
  return {
    transactionId: 'transaction_1' as Id<'filesystemTransactions'>,
    direction,
    command: { type: 'move', itemIds: [], targetParentId: null },
    events,
    patches,
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

    expect(
      getReceiptRemovedRootIds(
        receipt(
          'undo',
          [{ type: 'restored', itemId }],
          [
            {
              type: 'updateSidebarItem',
              itemId,
              before: { status: 'active' },
              fields: { status: 'trashed' },
            },
          ],
        ),
      ),
    ).toEqual([itemId])
    expect(getReceiptSelectedRootIds(receipt('undo', [{ type: 'restored', itemId }]))).toEqual([])
  })

  it('derives removed visible items from patches even when events only name the merge root', () => {
    const mergedFolderId = 'folder_1' as Id<'sidebarItems'>
    const copiedChildId = 'child_1' as Id<'sidebarItems'>

    expect(
      getReceiptRemovedRootIds(
        receipt(
          'undo',
          [{ type: 'mergedFolder', itemId: mergedFolderId, sourceItemId: mergedFolderId }],
          [
            {
              type: 'updateSidebarItem',
              itemId: copiedChildId,
              before: { status: 'active' },
              fields: { status: 'undoHidden' },
            },
          ],
        ),
      ),
    ).toEqual([copiedChildId])
  })

  it('selects the created copy, not the replaced source bookkeeping event', () => {
    const copiedItemId = 'copied_item' as Id<'sidebarItems'>
    const sourceItemId = 'source_item' as Id<'sidebarItems'>
    const replacedItemId = 'replaced_item' as Id<'sidebarItems'>

    expect(
      getReceiptSelectedRootIds(
        receipt('forward', [
          { type: 'copied', itemId: copiedItemId, sourceItemId },
          { type: 'replaced', itemId: replacedItemId, sourceItemId },
        ]),
      ),
    ).toEqual([copiedItemId])
  })
})
