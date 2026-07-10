import { describe, expect, it } from 'vite-plus/test'

import type { FileSystemTransactionId, SidebarItemId } from '../../../../../shared/common/ids'
import { RESOURCE_COMMAND_TYPE } from '../transaction-contract'
import type { ResourceTransactionReceipt } from '../transaction-contract'
import { getReceiptToastMessage } from '../receipt-toast-message'

const itemId = 'metadata_item' as SidebarItemId

function metadataUpdateReceipt(
  direction: ResourceTransactionReceipt['direction'],
): ResourceTransactionReceipt {
  return {
    transactionId: 'transaction_1' as FileSystemTransactionId,
    direction,
    command: { type: 'rename', itemId, color: null },
    events: [{ type: 'updated', itemId }],
    patches: [],
    summary: {
      kind: 'updated',
      affectedCount: 1,
      createdCount: 0,
      mergedCount: 0,
      skippedCount: 0,
    },
    undoable: true,
  }
}

function copyFolderMergeReceipt(
  direction: ResourceTransactionReceipt['direction'],
  options: { createdCount?: number; mergedCount?: number } = {},
): ResourceTransactionReceipt {
  const createdCount = options.createdCount ?? 0
  const mergedCount = options.mergedCount ?? 1
  return {
    transactionId: 'transaction_1' as FileSystemTransactionId,
    direction,
    command: {
      type: RESOURCE_COMMAND_TYPE.copy,
      itemIds: ['folder_1' as SidebarItemId],
      targetParentId: null,
    },
    events: [{ type: 'mergedFolder', itemId: 'folder_1' as SidebarItemId, sourceItemId: itemId }],
    patches: [],
    summary: {
      kind: 'copied',
      affectedCount: createdCount + mergedCount,
      createdCount,
      mergedCount,
      skippedCount: 0,
    },
    undoable: true,
  }
}

describe('getReceiptToastMessage', () => {
  it('formats metadata update receipts distinctly from renames', () => {
    expect(getReceiptToastMessage(metadataUpdateReceipt('forward'))).toEqual({
      type: 'success',
      text: 'Item updated',
    })
    expect(getReceiptToastMessage(metadataUpdateReceipt('undo'))).toEqual({
      type: 'success',
      text: 'Reverted item update',
    })
  })

  it('formats merge-only copy undo receipts as folder merge reversions', () => {
    expect(getReceiptToastMessage(copyFolderMergeReceipt('undo'))).toEqual({
      type: 'success',
      text: 'Reverted folder merge',
    })
  })

  it('formats mixed copy undo receipts with copied item and folder merge counts', () => {
    expect(
      getReceiptToastMessage(copyFolderMergeReceipt('undo', { createdCount: 2, mergedCount: 2 })),
    ).toEqual({
      type: 'success',
      text: 'Removed 2 copied items, reverted 2 folder merges',
    })
  })
})
