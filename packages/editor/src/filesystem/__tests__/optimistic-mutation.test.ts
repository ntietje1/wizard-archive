import { describe, expect, it, vi } from 'vite-plus/test'
import type { ResourceTransactionReceipt } from '../transaction-contract'
import type { ResourcePatch } from '../patch-contract'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { ResourceName } from '../../workspace/resource-contract'
import type { FileSystemCacheAdapter } from '../cache'
import { runFileSystemOptimisticMutation } from '../optimistic-mutation'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { testOperationId } from '../../test/operation-id'

const receipt: ResourceTransactionReceipt = {
  transactionId: testOperationId('transaction_1'),
  direction: 'forward',
  command: {
    type: 'create',
    itemType: RESOURCE_TYPES.notes,
    name: 'Scene' as ResourceName,
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

const optimisticPatch = {
  type: 'updateResource',
  itemId: 'item_1' as SidebarItemId,
  before: { name: 'Before' as ResourceName },
  fields: { name: 'Optimistic' as ResourceName },
} satisfies ResourcePatch

const rollbackPatch = {
  type: 'updateResource',
  itemId: 'item_1' as SidebarItemId,
  before: { name: 'Optimistic' as ResourceName },
  fields: { name: 'Before' as ResourceName },
} satisfies ResourcePatch

function isRollbackPatchSet(patches: Array<ResourcePatch>) {
  return patches.length === 1 && patches[0] === rollbackPatch
}

describe('runFileSystemOptimisticMutation', () => {
  it('rolls back and reports a missing mutation receipt', async () => {
    const cacheAdapter = createCacheAdapter()
    const reportError = vi.fn()
    const onMutationFailure = vi.fn()

    const result = await runFileSystemOptimisticMutation({
      cacheAdapter,
      apply: [optimisticPatch],
      rollback: [rollbackPatch],
      mutate: vi
        .fn()
        .mockResolvedValue(null) as unknown as () => Promise<ResourceTransactionReceipt>,
      onMutationFailure,
      onSuccess: vi.fn(),
      errorMessage: 'Filesystem operation failed',
      reportError,
      showProgress: vi.fn(),
      dismissProgress: vi.fn(),
    })

    expect(result).toBeNull()
    expect(cacheAdapter.applyPatches).toHaveBeenNthCalledWith(2, [rollbackPatch])
    expect(onMutationFailure).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Filesystem mutation returned no receipt' }),
      'Filesystem operation failed',
    )
  })

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

  it('does not report success when local cache reconciliation fails after commit', async () => {
    const error = new Error('cache failed')
    const reportError = vi.fn()
    const onSuccess = vi.fn()
    const cacheAdapter = createCacheAdapter()
    vi.mocked(cacheAdapter.applyPatches).mockImplementation((patches) => {
      if (isRollbackPatchSet(patches)) {
        throw error
      }
    })

    const result = await runFileSystemOptimisticMutation({
      cacheAdapter,
      apply: [optimisticPatch],
      rollback: [rollbackPatch],
      mutate: vi.fn().mockResolvedValue(receipt),
      onSuccess,
      errorMessage: 'Filesystem operation failed',
      reportError,
      showProgress: vi.fn(),
      dismissProgress: vi.fn(),
    })

    expect(result).toBeNull()
    expect(cacheAdapter.applyPatches).toHaveBeenNthCalledWith(1, [optimisticPatch])
    expect(cacheAdapter.applyPatches).toHaveBeenNthCalledWith(2, [
      rollbackPatch,
      ...receipt.patches,
    ])
    expect(cacheAdapter.applyPatches).toHaveBeenNthCalledWith(3, [rollbackPatch])
    expect(onSuccess).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(error, 'Filesystem operation failed')
  })

  it('continues the mutation when optimistic side effects fail', async () => {
    const sideEffectError = new Error('side effect failed')
    const reportError = vi.fn()
    const onMutationFailure = vi.fn()
    const mutate = vi.fn().mockResolvedValue(receipt)
    const cacheAdapter = createCacheAdapter()

    const result = await runFileSystemOptimisticMutation({
      cacheAdapter,
      apply: [optimisticPatch],
      rollback: [rollbackPatch],
      mutate,
      onOptimisticApplied: vi.fn().mockRejectedValue(sideEffectError),
      onMutationFailure,
      onSuccess: vi.fn(),
      errorMessage: 'Filesystem operation failed',
      reportError,
      showProgress: vi.fn(),
      dismissProgress: vi.fn(),
    })

    expect(result).toBe(receipt)
    expect(cacheAdapter.applyPatches).toHaveBeenNthCalledWith(1, [optimisticPatch])
    expect(cacheAdapter.applyPatches).toHaveBeenNthCalledWith(2, [
      rollbackPatch,
      ...receipt.patches,
    ])
    expect(mutate).toHaveBeenCalledOnce()
    expect(onMutationFailure).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(sideEffectError, 'Filesystem operation failed')
  })

  it('runs mutation failure handling when provider mutation and rollback patching fail', async () => {
    const mutationError = new Error('mutation failed')
    const rollbackError = new Error('rollback failed')
    const reportError = vi.fn()
    const onMutationFailure = vi.fn()
    const cacheAdapter = createCacheAdapter()
    vi.mocked(cacheAdapter.applyPatches).mockImplementation((patches) => {
      if (isRollbackPatchSet(patches)) {
        throw rollbackError
      }
    })

    const result = await runFileSystemOptimisticMutation({
      cacheAdapter,
      apply: [optimisticPatch],
      rollback: [rollbackPatch],
      mutate: vi.fn().mockRejectedValue(mutationError),
      onMutationFailure,
      onSuccess: vi.fn(),
      errorMessage: 'Filesystem operation failed',
      reportError,
      showProgress: vi.fn(),
      dismissProgress: vi.fn(),
    })

    expect(result).toBeNull()
    expect(cacheAdapter.applyPatches).toHaveBeenNthCalledWith(1, [optimisticPatch])
    expect(cacheAdapter.applyPatches).toHaveBeenNthCalledWith(2, [rollbackPatch])
    expect(onMutationFailure).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(rollbackError, 'Filesystem operation failed')
    expect(reportError).toHaveBeenCalledWith(mutationError, 'Filesystem operation failed')
  })

  it('runs mutation failure handling when provider mutation rejects with a falsy value', async () => {
    const reportError = vi.fn()
    const onMutationFailure = vi.fn()

    const result = await runFileSystemOptimisticMutation({
      cacheAdapter: createCacheAdapter(),
      apply: [optimisticPatch],
      rollback: [rollbackPatch],
      mutate: vi.fn().mockRejectedValue(null),
      onMutationFailure,
      onSuccess: vi.fn(),
      errorMessage: 'Filesystem operation failed',
      reportError,
      showProgress: vi.fn(),
      dismissProgress: vi.fn(),
    })

    expect(result).toBeNull()
    expect(onMutationFailure).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(null, 'Filesystem operation failed')
  })
})
