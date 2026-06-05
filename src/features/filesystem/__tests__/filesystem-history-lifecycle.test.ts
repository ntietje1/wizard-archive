import { describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import { SIDEBAR_ITEM_STATUS } from 'shared/sidebar-items/types'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { createFileSystemCacheAdapter } from '../filesystem-cache-adapter'
import type { SidebarCacheSnapshot } from '../filesystem-cache-patches'
import { executeFileSystemHistoryLifecycle } from '../filesystem-history-lifecycle'

function createReadWriteCache(snapshot: SidebarCacheSnapshot) {
  return createFileSystemCacheAdapter({
    get: (view) => (view === 'trash' ? snapshot.trash : snapshot.sidebar),
    update: (view, updater) => {
      if (view === 'trash') {
        snapshot.trash = updater(snapshot.trash)
      } else {
        snapshot.sidebar = updater(snapshot.sidebar)
      }
    },
  })
}

function createUndoRenameReceipt(): FileSystemTransactionReceipt {
  const itemId = 'renamed_item' as Id<'sidebarItems'>
  return {
    transactionId: 'transaction_1' as Id<'filesystemTransactions'>,
    direction: 'undo',
    command: {
      type: 'rename',
      itemId,
      name: assertSidebarItemName('New Name'),
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
        type: 'updateSidebarItem',
        itemId,
        before: { name: assertSidebarItemName('New Name') },
        fields: { name: assertSidebarItemName('Old Name') },
      },
    ],
    summary: {
      kind: 'renamed',
      affectedCount: 1,
      createdCount: 0,
      mergedCount: 0,
      skippedCount: 0,
    },
    undoable: true,
  }
}

describe('filesystem history lifecycle', () => {
  it('runs undo through the shared optimistic mutation lifecycle', async () => {
    const item = createNote({
      _id: 'renamed_item' as Id<'sidebarItems'>,
      name: 'New Name',
      status: SIDEBAR_ITEM_STATUS.active,
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [item], trash: [] }
    const cacheAdapter = createReadWriteCache(snapshot)
    const receipt = createUndoRenameReceipt()
    const executeMutation = vi.fn(() => Promise.resolve(receipt))
    const recordHistorySuccess = vi.fn()
    const applyReceiptSideEffects = vi.fn()
    const reportError = vi.fn()
    const showProgress = vi.fn(() => 'progress-toast')
    const dismissProgress = vi.fn()
    const showReceiptToast = vi.fn()

    const result = await executeFileSystemHistoryLifecycle({
      direction: 'undo',
      entry: { transactionId: 'transaction_1' as Id<'filesystemTransactions'> },
      cacheAdapter,
      runMutation: (operation) => operation(),
      executeMutation,
      recordHistorySuccess,
      applyReceiptSideEffects,
      reportError,
      showProgress,
      dismissProgress,
      showReceiptToast,
    })

    expect(result).toBe(receipt)
    expect(executeMutation).toHaveBeenCalledWith('transaction_1')
    expect(snapshot.sidebar[0]?.name).toBe('Old Name')
    expect(recordHistorySuccess).toHaveBeenCalledWith({
      transactionId: 'transaction_1',
    })
    expect(applyReceiptSideEffects).toHaveBeenCalledWith(receipt)
    expect(showProgress).toHaveBeenCalledWith('Undoing...')
    expect(dismissProgress).toHaveBeenCalledWith('progress-toast')
    expect(showReceiptToast).toHaveBeenCalledWith(receipt)
    expect(reportError).not.toHaveBeenCalled()
  })
})
