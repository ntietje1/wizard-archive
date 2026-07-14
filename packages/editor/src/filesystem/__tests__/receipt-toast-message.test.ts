import { describe, expect, it } from 'vite-plus/test'

import type { SidebarItemId } from '../../../../../shared/common/ids'
import { testOperationId } from '../../test/operation-id'
import { RESOURCE_COMMAND_TYPE } from '../transaction-contract'
import type { ResourceTransactionReceipt } from '../transaction-contract'
import { getReceiptToastMessage } from '../receipt-toast-message'

const itemId = 'metadata_item' as SidebarItemId

function metadataUpdateReceipt(
  direction: ResourceTransactionReceipt['direction'],
): ResourceTransactionReceipt {
  return {
    transactionId: testOperationId('transaction_1'),
    direction,
    command: { type: 'rename', itemId, color: null },
    events: [{ type: 'updated', itemId }],
    patches: [],
    summary: {
      kind: 'updated',
      affectedCount: 1,
      createdCount: 0,
    },
    undoable: true,
  }
}

function copyReceipt(
  direction: ResourceTransactionReceipt['direction'],
  createdCount: number,
): ResourceTransactionReceipt {
  return {
    transactionId: testOperationId('transaction_1'),
    direction,
    command: {
      type: RESOURCE_COMMAND_TYPE.copy,
      itemIds: ['folder_1' as SidebarItemId],
      targetParentId: null,
    },
    events: Array.from({ length: createdCount }, (_, index) => ({
      type: 'copied' as const,
      itemId: `copy_${index}` as SidebarItemId,
      sourceItemId: itemId,
    })),
    patches: [],
    summary: {
      kind: 'copied',
      affectedCount: createdCount,
      createdCount,
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

  it('formats a single copy undo receipt', () => {
    expect(getReceiptToastMessage(copyReceipt('undo', 1))).toEqual({
      type: 'success',
      text: 'Removed copied item',
    })
  })

  it('formats multi-item copy undo receipts', () => {
    expect(getReceiptToastMessage(copyReceipt('undo', 2))).toEqual({
      type: 'success',
      text: 'Removed 2 copied items',
    })
  })
})
