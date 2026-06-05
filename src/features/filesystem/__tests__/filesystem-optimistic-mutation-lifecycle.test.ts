import { describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { SidebarItemName } from 'shared/sidebar-items/name'
import type { FileSystemCacheAdapter } from '../filesystem-cache-adapter'
import { runFileSystemOptimisticMutation } from '../filesystem-optimistic-mutation-lifecycle'

const receipt: FileSystemTransactionReceipt = {
  transactionId: 'transaction_1' as Id<'filesystemTransactions'>,
  direction: 'forward',
  command: {
    type: 'create',
    itemType: SIDEBAR_ITEM_TYPES.notes,
    name: 'Scene' as SidebarItemName,
    parentTarget: { kind: 'direct', parentId: null },
  },
  events: [],
  patches: [],
  summary: {
    kind: 'created',
    affectedCount: 1,
    createdCount: 1,
    mergedCount: 0,
    skippedCount: 0,
  },
  undoable: true,
}

function createCacheAdapter(): FileSystemCacheAdapter {
  return {
    getSnapshot: vi.fn(),
    getReadModel: vi.fn(),
    applyPatches: vi.fn(),
  } as unknown as FileSystemCacheAdapter
}

describe('runFileSystemOptimisticMutation', () => {
  it('returns the committed receipt when success side effects fail', async () => {
    const error = new Error('side effect failed')
    const reportError = vi.fn()

    const result = await runFileSystemOptimisticMutation({
      cacheAdapter: createCacheAdapter(),
      apply: [],
      rollback: [],
      mutate: vi.fn().mockResolvedValue(receipt),
      onSuccess: vi.fn().mockRejectedValue(error),
      errorMessage: 'Filesystem operation failed',
      reportError,
      showProgress: vi.fn(),
      dismissProgress: vi.fn(),
    })

    expect(result).toBe(receipt)
    expect(reportError).toHaveBeenCalledWith(error, 'Filesystem operation failed')
  })

  it('continues the mutation when progress feedback fails', async () => {
    const error = new Error('toast failed')
    const reportError = vi.fn()
    const mutate = vi.fn().mockResolvedValue(receipt)

    const result = await runFileSystemOptimisticMutation({
      cacheAdapter: createCacheAdapter(),
      apply: [],
      rollback: [],
      mutate,
      onSuccess: vi.fn(),
      errorMessage: 'Filesystem operation failed',
      progressMessage: 'Creating item...',
      reportError,
      showProgress: vi.fn(() => {
        throw error
      }),
      dismissProgress: vi.fn(),
    })

    expect(result).toBe(receipt)
    expect(mutate).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(error, 'Failed to show filesystem progress')
  })
})
