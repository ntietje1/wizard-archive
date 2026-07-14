import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { ResourceTransactionReceipt } from '../transaction-contract'
import { canonicalizeResourceItemTitle } from '../../workspace/items'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { createNote } from '../../test/sidebar-item-factory'
import type { SidebarCacheSnapshot } from '../cache-patches'
import { executeFileSystemHistoryLifecycle } from '../history-lifecycle'
import { createReadWriteTestCache } from './cache-test-utils'
import type { CampaignId } from '../../../../../shared/common/ids'
import { createFileSystemReceipt } from './receipt-factory'
import { testOperationId } from '../../test/operation-id'

function createUndoRenameReceipt(): ResourceTransactionReceipt {
  const itemId = 'renamed_item' as ResourceId
  return createFileSystemReceipt({
    transactionId: testOperationId('transaction_1'),
    direction: 'undo',
    command: {
      type: 'rename',
      itemId,
      name: canonicalizeResourceItemTitle('New Name'),
    },
    events: [
      {
        type: 'renamed',
        itemId,
        slug: 'new-name',
        previousSlug: 'old-name',
      },
    ],
    patches: [
      {
        type: 'updateResource',
        itemId,
        before: { name: canonicalizeResourceItemTitle('New Name') },
        fields: { name: canonicalizeResourceItemTitle('Old Name') },
      },
    ],
  })
}

describe('filesystem history lifecycle', () => {
  it('runs undo through the shared optimistic mutation lifecycle', async () => {
    const item = createNote({
      id: 'renamed_item' as ResourceId,
      name: 'New Name',
      status: RESOURCE_STATUS.active,
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [item], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const receipt = createUndoRenameReceipt()
    const executeMutation = vi.fn(() => Promise.resolve(receipt))
    const recordHistorySuccess = vi.fn()
    const applyReceiptSideEffects = vi.fn()
    const showProgress = vi.fn(() => 'progress-toast')
    const dismissProgress = vi.fn()
    const showReceiptToast = vi.fn()

    const result = await executeFileSystemHistoryLifecycle({
      direction: 'undo',
      entry: {
        workspaceId: 'campaign_1' as CampaignId,
        transactionId: testOperationId('transaction_1'),
      },
      cacheAdapter,
      runMutation: (operation) => operation(),
      executeMutation,
      recordHistorySuccess,
      applyReceiptSideEffects,
      reportError: vi.fn(),
      showProgress,
      dismissProgress,
      showReceiptToast,
    })

    expect(result).toEqual({ status: 'completed', receipt })
    expect(executeMutation).toHaveBeenCalledWith(testOperationId('transaction_1'))
    expect(snapshot.sidebar[0]?.name).toBe('Old Name')
    expect(recordHistorySuccess).toHaveBeenCalledWith({
      workspaceId: 'campaign_1',
      transactionId: testOperationId('transaction_1'),
    })
    expect(applyReceiptSideEffects).toHaveBeenCalledWith(receipt)
    expect(showProgress).toHaveBeenCalledWith('Undoing...')
    expect(dismissProgress).toHaveBeenCalledWith('progress-toast')
    expect(showReceiptToast).toHaveBeenCalledWith(receipt)
  })

  it('keeps completed history receipts successful when receipt feedback fails', async () => {
    const item = createNote({
      id: 'renamed_item' as ResourceId,
      name: 'New Name',
      status: RESOURCE_STATUS.active,
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [item], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const receipt = createUndoRenameReceipt()
    const executeMutation = vi.fn(() => Promise.resolve(receipt))
    const recordHistorySuccess = vi.fn()
    const applyReceiptSideEffects = vi.fn()
    const reportError = vi.fn()
    const toastError = new Error('toast failed')

    const result = await executeFileSystemHistoryLifecycle({
      direction: 'undo',
      entry: {
        workspaceId: 'campaign_1' as CampaignId,
        transactionId: testOperationId('transaction_1'),
      },
      cacheAdapter,
      runMutation: (operation) => operation(),
      executeMutation,
      recordHistorySuccess,
      applyReceiptSideEffects,
      reportError,
      showProgress: vi.fn(() => 'progress-toast'),
      dismissProgress: vi.fn(),
      showReceiptToast: vi.fn(() => {
        throw toastError
      }),
    })

    expect(result).toEqual({ status: 'completed', receipt })
    expect(snapshot.sidebar[0]?.name).toBe('Old Name')
    expect(recordHistorySuccess).toHaveBeenCalledWith({
      workspaceId: 'campaign_1',
      transactionId: testOperationId('transaction_1'),
    })
    expect(reportError).toHaveBeenCalledWith(toastError, 'Failed to show filesystem receipt')
  })

  it('rejects stale history entries before running the mutation', async () => {
    const item = createNote({
      id: 'renamed_item' as ResourceId,
      name: 'New Name',
      status: RESOURCE_STATUS.active,
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [item], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const executeMutation = vi.fn()
    const reportError = vi.fn()

    const result = await executeFileSystemHistoryLifecycle({
      direction: 'undo',
      entry: {
        workspaceId: 'campaign_1' as CampaignId,
        transactionId: testOperationId('transaction_1'),
      },
      cacheAdapter,
      runMutation: (operation) => operation(),
      executeMutation,
      isEntryStale: () => true,
      recordHistorySuccess: vi.fn(),
      applyReceiptSideEffects: vi.fn(),
      reportError,
      showProgress: vi.fn(() => 'progress-toast'),
      dismissProgress: vi.fn(),
      showReceiptToast: vi.fn(),
    })

    expect(result).toEqual({ status: 'rejected', reason: 'stale-history' })
    expect(executeMutation).not.toHaveBeenCalled()
    expect(snapshot.sidebar[0]?.name).toBe('New Name')
    expect(reportError).not.toHaveBeenCalled()
  })
})
