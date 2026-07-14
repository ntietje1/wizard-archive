import { describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_STATUS, RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { ResourceTitle } from '../../resources/resource-contract'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import type { SidebarCacheSnapshot } from '../cache-patches'
import { executeFileSystemCommandLifecycle } from '../command-lifecycle'
import { createCreatedItemReceipt } from './receipt-factory'
import { createReadWriteTestCache } from './cache-test-utils'
import type { CampaignId, SidebarItemId, UserProfileId } from '../../../../../shared/common/ids'
import { testOperationId } from '../../test/operation-id'

const campaignId = 'campaign_1' as CampaignId
const currentUserId = 'user_1' as UserProfileId

describe('filesystem command lifecycle', () => {
  it('executes create lifecycle through injected provider adapters', async () => {
    const parent = createFolder({
      id: 'parent_folder' as SidebarItemId,
      name: 'Scenes',
    })
    const created = createNote({
      id: 'created_item' as SidebarItemId,
      name: 'Scene',
      slug: 'scene',
      parentId: parent.id,
      status: RESOURCE_STATUS.active,
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const applyLifecycleIntents = vi.fn()
    const receipt = createCreatedItemReceipt(created)
    const executeMutation = vi.fn(() => Promise.resolve(receipt))
    const applyReceiptSideEffects = vi.fn()
    const recordUndoReceipt = vi.fn()
    const onSuccess = vi.fn()
    const showProgress = vi.fn(() => 'progress-toast')
    const dismissProgress = vi.fn()
    const showReceiptToast = vi.fn()

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: 'Scene' as ResourceTitle,
        parentTarget: { kind: 'direct', parentId: parent.id },
      },
      workspaceId: campaignId,
      currentUserId,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createOperationId: () => testOperationId('operation-1'),
      getCurrentResourceId: () => null,
      runMutation: (operation) => operation(),
      executeMutation,
      applyLifecycleIntents,
      applyReceiptSideEffects,
      recordUndoReceipt,
      onSuccess,
      reportError: vi.fn(),
      showProgress,
      dismissProgress,
      showReceiptToast,
    })

    expect(result).toEqual({ status: 'completed', receipt: createCreatedItemReceipt(created) })
    expect(executeMutation).toHaveBeenCalledWith({
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: 'Scene',
        parentTarget: { kind: 'direct', parentId: parent.id },
      },
      decisions: undefined,
      operationId: testOperationId('operation-1'),
    })
    expect(applyLifecycleIntents).toHaveBeenCalledWith(
      [{ type: 'openFolder', workspaceId: campaignId, folderId: parent.id }],
      null,
    )
    expect(snapshot.sidebar).toEqual([parent, created])
    expect(applyReceiptSideEffects).toHaveBeenCalledWith(createCreatedItemReceipt(created), null)
    expect(recordUndoReceipt).toHaveBeenCalledWith(createCreatedItemReceipt(created))
    expect(onSuccess).toHaveBeenCalled()
    expect(showProgress).toHaveBeenCalledWith('Creating item...')
    expect(dismissProgress).toHaveBeenCalledWith('progress-toast')
    expect(showReceiptToast).toHaveBeenCalledWith(createCreatedItemReceipt(created))
  })

  it('does not run success effects when cache reconciliation fails after provider commit', async () => {
    const parent = createFolder({
      id: 'parent_folder' as SidebarItemId,
      name: 'Scenes',
    })
    const created = createNote({
      id: 'created_item' as SidebarItemId,
      name: 'Scene',
      slug: 'scene',
      parentId: parent.id,
      status: RESOURCE_STATUS.active,
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const originalApplyPatches = cacheAdapter.applyPatches.bind(cacheAdapter)
    const reconciliationError = new Error('cache failed')
    let applyCallCount = 0
    vi.spyOn(cacheAdapter, 'applyPatches').mockImplementation((patches) => {
      applyCallCount += 1
      if (applyCallCount === 2) throw reconciliationError
      originalApplyPatches(patches)
    })
    const receipt = createCreatedItemReceipt(created)
    const executeMutation = vi.fn(() => Promise.resolve(receipt))
    const applyReceiptSideEffects = vi.fn()
    const recordUndoReceipt = vi.fn()
    const onSuccess = vi.fn()
    const reportError = vi.fn()
    const showReceiptToast = vi.fn()

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: 'Scene' as ResourceTitle,
        parentTarget: { kind: 'direct', parentId: parent.id },
      },
      workspaceId: campaignId,
      currentUserId,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createOperationId: () => testOperationId('operation-1'),
      getCurrentResourceId: () => null,
      runMutation: (operation) => operation(),
      executeMutation,
      applyLifecycleIntents: vi.fn(),
      applyReceiptSideEffects,
      recordUndoReceipt,
      onSuccess,
      reportError,
      showProgress: () => 'progress-toast',
      dismissProgress: vi.fn(),
      showReceiptToast,
    })

    expect(result).toEqual({ status: 'error' })
    expect(executeMutation).toHaveBeenCalledOnce()
    expect(applyReceiptSideEffects).not.toHaveBeenCalled()
    expect(recordUndoReceipt).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(showReceiptToast).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(reconciliationError, 'Filesystem operation failed')
  })

  it('reports planner failures without starting provider mutation work', async () => {
    const planningError = new Error('snapshot unavailable')
    const reportError = vi.fn()
    const executeMutation = vi.fn()
    const cacheAdapter = createReadWriteTestCache({ sidebar: [], trash: [] })
    vi.spyOn(cacheAdapter, 'getSnapshot').mockImplementation(() => {
      throw planningError
    })

    const result = await executeFileSystemCommandLifecycle({
      command: { type: 'emptyTrash' },
      workspaceId: campaignId,
      currentUserId,
      activeItemSurface: null,
      cacheAdapter,
      createOperationId: () => testOperationId('operation-1'),
      getCurrentResourceId: () => null,
      runMutation: (operation) => operation(),
      executeMutation,
      applyLifecycleIntents: vi.fn(),
      applyReceiptSideEffects: vi.fn(),
      recordUndoReceipt: vi.fn(),
      reportError,
      showProgress: vi.fn(),
      dismissProgress: vi.fn(),
      showReceiptToast: vi.fn(),
    })

    expect(result).toEqual({ status: 'error' })
    expect(executeMutation).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      planningError,
      'Filesystem operation failed',
    )
  })

  it('starts provider mutation work for duplicate destination titles', async () => {
    const sourceParent = createFolder({
      id: 'source_parent' as SidebarItemId,
      name: 'Source',
    })
    const targetParent = createFolder({
      id: 'target_parent' as SidebarItemId,
      name: 'Target',
    })
    const source = createNote({
      id: 'source_item' as SidebarItemId,
      name: 'Scene',
      parentId: sourceParent.id,
    })
    const existing = createNote({
      id: 'existing_item' as SidebarItemId,
      name: 'Scene',
      parentId: targetParent.id,
    })
    const snapshot: SidebarCacheSnapshot = {
      sidebar: [sourceParent, targetParent, source, existing],
      trash: [],
    }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const executeMutation = vi.fn(() => Promise.resolve(createCreatedItemReceipt(source)))

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'copy',
        itemIds: [source.id],
        targetParentId: targetParent.id,
      },
      workspaceId: campaignId,
      currentUserId: null,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createOperationId: () => testOperationId('operation-1'),
      getCurrentResourceId: () => null,
      runMutation: (operation) => operation(),
      executeMutation,
      applyLifecycleIntents: vi.fn(),
      applyReceiptSideEffects: vi.fn(),
      recordUndoReceipt: vi.fn(),
      reportError: vi.fn(),
      showProgress: () => 'progress-toast',
      dismissProgress: vi.fn(),
      showReceiptToast: vi.fn(),
    })

    expect(executeMutation).toHaveBeenCalledOnce()
    expect(result.status).toBe('completed')
  })

  it('returns unavailable instead of throwing when selected resources disappear before planning', async () => {
    const snapshot: SidebarCacheSnapshot = { sidebar: [], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const executeMutation = vi.fn()

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'trash',
        itemIds: ['removed-item' as SidebarItemId],
      },
      workspaceId: campaignId,
      currentUserId,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createOperationId: () => testOperationId('operation-1'),
      getCurrentResourceId: () => null,
      runMutation: (operation) => operation(),
      executeMutation,
      applyLifecycleIntents: vi.fn(),
      applyReceiptSideEffects: vi.fn(),
      recordUndoReceipt: vi.fn(),
      reportError: vi.fn(),
      showProgress: () => 'progress-toast',
      dismissProgress: vi.fn(),
      showReceiptToast: vi.fn(),
    })

    expect(result).toEqual({ status: 'unavailable', reason: 'resources_missing' })
    expect(executeMutation).not.toHaveBeenCalled()
  })

  it('plans commands inside the serialized mutation lane', async () => {
    const sourceParent = createFolder({
      id: 'source_parent' as SidebarItemId,
      name: 'Source',
    })
    const targetParent = createFolder({
      id: 'target_parent' as SidebarItemId,
      name: 'Target',
    })
    const source = createNote({
      id: 'source_item' as SidebarItemId,
      name: 'Scene',
      parentId: sourceParent.id,
    })
    const existing = createNote({
      id: 'existing_item' as SidebarItemId,
      name: 'Scene',
      parentId: targetParent.id,
    })
    const snapshot: SidebarCacheSnapshot = {
      sidebar: [sourceParent, targetParent, source],
      trash: [],
    }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const executeMutation = vi.fn(() => Promise.resolve(createCreatedItemReceipt(source)))

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'copy',
        itemIds: [source.id],
        targetParentId: targetParent.id,
      },
      workspaceId: campaignId,
      currentUserId: null,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createOperationId: () => testOperationId('operation-1'),
      getCurrentResourceId: () => null,
      runMutation: async (operation) => {
        snapshot.sidebar.push(existing)
        return await operation()
      },
      executeMutation,
      applyLifecycleIntents: vi.fn(),
      applyReceiptSideEffects: vi.fn(),
      recordUndoReceipt: vi.fn(),
      reportError: vi.fn(),
      showProgress: () => 'progress-toast',
      dismissProgress: vi.fn(),
      showReceiptToast: vi.fn(),
    })

    expect(executeMutation).toHaveBeenCalledOnce()
    expect(result.status).toBe('completed')
  })

  it('rolls back optimistic patches and lifecycle intents when the mutation fails', async () => {
    const parent = createFolder({
      id: 'parent_folder' as SidebarItemId,
      name: 'Scenes',
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const applyLifecycleIntents = vi.fn()
    const mutationError = new Error('mutation failed')
    const executeMutation = vi.fn(() => Promise.reject(mutationError))
    const reportError = vi.fn()
    const showProgress = vi.fn(() => 'progress-toast')
    const dismissProgress = vi.fn()

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: 'Scene' as ResourceTitle,
        parentTarget: { kind: 'direct', parentId: parent.id },
      },
      workspaceId: campaignId,
      currentUserId,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createOperationId: () => testOperationId('operation-1'),
      getCurrentResourceId: () => 'previous_item' as SidebarItemId,
      runMutation: (operation) => operation(),
      executeMutation,
      applyLifecycleIntents,
      applyReceiptSideEffects: vi.fn(),
      recordUndoReceipt: vi.fn(),
      reportError,
      showProgress,
      dismissProgress,
      showReceiptToast: vi.fn(),
    })

    expect(result).toMatchObject({ status: 'error' })
    expect(snapshot.sidebar).toEqual([parent])
    expect(applyLifecycleIntents).toHaveBeenCalledTimes(2)
    expect(applyLifecycleIntents).toHaveBeenNthCalledWith(
      1,
      [{ type: 'openFolder', workspaceId: campaignId, folderId: parent.id }],
      'previous_item',
    )
    expect(applyLifecycleIntents).toHaveBeenNthCalledWith(2, [], 'previous_item')
    expect(showProgress).toHaveBeenCalledWith('Creating item...')
    expect(dismissProgress).toHaveBeenCalledWith('progress-toast')
    expect(reportError).toHaveBeenCalledWith(mutationError, 'Filesystem operation failed')
  })
})
