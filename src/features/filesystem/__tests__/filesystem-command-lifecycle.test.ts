import { describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { SidebarItemName } from 'shared/sidebar-items/name'
import { assertSidebarItemSlug } from 'shared/sidebar-items/slug'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { createFileSystemCacheAdapter } from '../filesystem-cache-adapter'
import type { SidebarCacheSnapshot } from '../filesystem-cache-patches'
import { executeFileSystemCommandLifecycle } from '../filesystem-command-lifecycle'

const campaignId = 'campaign_1' as Id<'campaigns'>
const currentUserId = 'user_1' as Id<'userProfiles'>

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

function createReceipt(item: AnySidebarItem): FileSystemTransactionReceipt {
  return {
    transactionId: 'transaction_1' as Id<'filesystemTransactions'>,
    direction: 'forward',
    command: {
      type: 'create',
      itemType: SIDEBAR_ITEM_TYPES.notes,
      name: 'Scene' as SidebarItemName,
      parentTarget: { kind: 'direct', parentId: item.parentId },
    },
    events: [{ type: 'created', itemId: item._id, slug: item.slug }],
    patches: [{ type: 'upsertSidebarItem', item }],
    summary: {
      kind: 'created',
      affectedCount: 1,
      createdCount: 1,
      mergedCount: 0,
      skippedCount: 0,
    },
    undoable: true,
  }
}

describe('filesystem command lifecycle', () => {
  it('executes create lifecycle through injected provider adapters', async () => {
    const parent = createFolder({
      _id: 'parent_folder' as Id<'sidebarItems'>,
      name: 'Scenes',
    })
    const created = createNote({
      _id: 'created_item' as Id<'sidebarItems'>,
      name: 'Scene',
      slug: 'scene',
      parentId: parent._id,
      status: SIDEBAR_ITEM_STATUS.active,
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent], trash: [] }
    const cacheAdapter = createReadWriteCache(snapshot)
    const applyLifecycleIntents = vi.fn()
    const executeMutation = vi.fn(() => Promise.resolve(createReceipt(created)))
    const applyReceiptSideEffects = vi.fn()
    const recordUndoReceipt = vi.fn()
    const onSuccess = vi.fn()
    const reportError = vi.fn()
    const showProgress = vi.fn(() => 'progress-toast')
    const dismissProgress = vi.fn()
    const showReceiptToast = vi.fn()

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'create',
        itemType: SIDEBAR_ITEM_TYPES.notes,
        name: 'Scene' as SidebarItemName,
        parentTarget: { kind: 'direct', parentId: parent._id },
      },
      campaignId,
      currentUserId,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createClientOperationId: () => 'operation-1',
      getCurrentSlug: () => null,
      runMutation: (operation) => operation(),
      executeMutation,
      applyLifecycleIntents,
      applyReceiptSideEffects,
      recordUndoReceipt,
      onSuccess,
      reportError,
      showProgress,
      dismissProgress,
      showReceiptToast,
    })

    expect(result).toEqual({ status: 'completed', receipt: createReceipt(created) })
    expect(executeMutation).toHaveBeenCalledWith({
      command: {
        type: 'create',
        itemType: SIDEBAR_ITEM_TYPES.notes,
        name: 'Scene',
        parentTarget: { kind: 'direct', parentId: parent._id },
      },
      decisions: undefined,
      clientOperationId: 'operation-1',
    })
    expect(applyLifecycleIntents).toHaveBeenCalledWith(
      [{ type: 'openFolder', campaignId, folderId: parent._id }],
      null,
    )
    expect(snapshot.sidebar).toEqual([parent, created])
    expect(applyReceiptSideEffects).toHaveBeenCalledWith(createReceipt(created))
    expect(recordUndoReceipt).toHaveBeenCalledWith(createReceipt(created))
    expect(onSuccess).toHaveBeenCalled()
    expect(showProgress).toHaveBeenCalledWith('Creating item...')
    expect(dismissProgress).toHaveBeenCalledWith('progress-toast')
    expect(showReceiptToast).toHaveBeenCalledWith(createReceipt(created))
    expect(reportError).not.toHaveBeenCalled()
  })

  it('returns conflicts before starting provider mutation work', async () => {
    const sourceParent = createFolder({
      _id: 'source_parent' as Id<'sidebarItems'>,
      name: 'Source',
    })
    const targetParent = createFolder({
      _id: 'target_parent' as Id<'sidebarItems'>,
      name: 'Target',
    })
    const source = createNote({
      _id: 'source_item' as Id<'sidebarItems'>,
      name: 'Scene',
      parentId: sourceParent._id,
    })
    const existing = createNote({
      _id: 'existing_item' as Id<'sidebarItems'>,
      name: 'Scene',
      parentId: targetParent._id,
    })
    const snapshot: SidebarCacheSnapshot = {
      sidebar: [sourceParent, targetParent, source, existing],
      trash: [],
    }
    const cacheAdapter = createReadWriteCache(snapshot)
    const createClientOperationId = vi.fn(() => 'operation-1')
    const runMutation = vi.fn((operation: () => Promise<FileSystemTransactionReceipt | null>) =>
      operation(),
    )
    const executeMutation = vi.fn(() => Promise.resolve(createReceipt(source)))
    const applyLifecycleIntents = vi.fn()
    const showProgress = vi.fn(() => 'progress-toast')

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'copy',
        itemIds: [source._id],
        targetParentId: targetParent._id,
      },
      campaignId,
      currentUserId: null,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createClientOperationId,
      getCurrentSlug: () => null,
      runMutation,
      executeMutation,
      applyLifecycleIntents,
      applyReceiptSideEffects: vi.fn(),
      recordUndoReceipt: vi.fn(),
      reportError: vi.fn(),
      showProgress,
      dismissProgress: vi.fn(),
      showReceiptToast: vi.fn(),
    })

    expect(result).toEqual({
      status: 'needsDecision',
      conflicts: [
        {
          kind: 'name-conflict',
          sourceItemId: source._id,
          destinationItemId: existing._id,
          sourceName: 'Scene',
          destinationName: 'Scene',
          sourceType: source.type,
          destinationType: existing.type,
        },
      ],
    })
    expect(runMutation).not.toHaveBeenCalled()
    expect(executeMutation).not.toHaveBeenCalled()
    expect(createClientOperationId).not.toHaveBeenCalled()
    expect(applyLifecycleIntents).not.toHaveBeenCalled()
    expect(showProgress).not.toHaveBeenCalled()
    expect(snapshot.sidebar).toEqual([sourceParent, targetParent, source, existing])
  })

  it('rolls back optimistic patches and lifecycle intents when the mutation fails', async () => {
    const parent = createFolder({
      _id: 'parent_folder' as Id<'sidebarItems'>,
      name: 'Scenes',
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent], trash: [] }
    const cacheAdapter = createReadWriteCache(snapshot)
    const applyLifecycleIntents = vi.fn()
    const mutationError = new Error('mutation failed')
    const executeMutation = vi.fn(() => Promise.reject(mutationError))
    const recordUndoReceipt = vi.fn()
    const reportError = vi.fn()
    const showProgress = vi.fn(() => 'progress-toast')
    const dismissProgress = vi.fn()
    const showReceiptToast = vi.fn()

    const result = await executeFileSystemCommandLifecycle({
      command: {
        type: 'create',
        itemType: SIDEBAR_ITEM_TYPES.notes,
        name: 'Scene' as SidebarItemName,
        parentTarget: { kind: 'direct', parentId: parent._id },
      },
      campaignId,
      currentUserId,
      activeItemSurface: { parentId: null },
      cacheAdapter,
      createClientOperationId: () => 'operation-1',
      getCurrentSlug: () => assertSidebarItemSlug('previous-scene'),
      runMutation: (operation) => operation(),
      executeMutation,
      applyLifecycleIntents,
      applyReceiptSideEffects: vi.fn(),
      recordUndoReceipt,
      reportError,
      showProgress,
      dismissProgress,
      showReceiptToast,
    })

    expect(result).toEqual({ status: 'failed' })
    expect(snapshot.sidebar).toEqual([parent])
    expect(applyLifecycleIntents).toHaveBeenCalledTimes(2)
    expect(applyLifecycleIntents).toHaveBeenNthCalledWith(
      1,
      [{ type: 'openFolder', campaignId, folderId: parent._id }],
      'previous-scene',
    )
    expect(applyLifecycleIntents).toHaveBeenNthCalledWith(2, [], 'previous-scene')
    expect(showProgress).toHaveBeenCalledWith('Creating item...')
    expect(dismissProgress).toHaveBeenCalledWith('progress-toast')
    expect(reportError).toHaveBeenCalledWith(mutationError, 'Filesystem operation failed')
    expect(recordUndoReceipt).not.toHaveBeenCalled()
    expect(showReceiptToast).not.toHaveBeenCalled()
  })
})
