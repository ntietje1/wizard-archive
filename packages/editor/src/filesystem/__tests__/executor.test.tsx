import type { ResourceId } from '../../resources/domain-id'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import type { CampaignId } from '../../../../../shared/common/ids'
import { testOperationId } from '../../test/operation-id'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import type { ResourceTitle } from '../../resources/resource-contract'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { SidebarCacheSnapshot } from '../cache-patches'
import { useFileSystemExecutor } from '../executor'
import type { FileSystemExecutorEffects } from '../executor-effects'
import type { ResourceCommandResult, ResourceTransactionReceipt } from '../transaction-contract'
import { createFileSystemUndoStore } from '../undo-store'
import { createReadWriteTestCache } from './cache-test-utils'
import { createCreatedItemReceipt, createFileSystemReceipt } from './receipt-factory'

const campaignId = 'campaign_1' as CampaignId
const executorEffects = {
  reportError: vi.fn(),
  reportReceiptEffectError: vi.fn(),
  showProgress: vi.fn(() => 'filesystem-test-progress'),
  dismissProgress: vi.fn(),
  showReceiptToast: vi.fn(),
} satisfies FileSystemExecutorEffects

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('useFileSystemExecutor', () => {
  it('serializes discarding incomplete creates behind in-flight filesystem mutations', async () => {
    const parent = createFolder({ name: 'Scenes' })
    const created = createNote({
      name: 'Scene',
      parentId: parent.id,
    })
    const discarded = createNote({
      name: 'Draft',
      parentId: parent.id,
    })
    const createReceipt = createCreatedItemReceipt(created)
    const discardReceipt: ResourceTransactionReceipt = {
      ...createCreatedItemReceipt(discarded),
      transactionId: testOperationId('discard_transaction'),
      direction: 'undo',
      patches: [],
      undoable: false,
    }
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)
    const commandMutation = createDeferred<ResourceTransactionReceipt>()
    const executeMutation = vi.fn(() => commandMutation.promise)
    const undoMutation = vi.fn(() => Promise.resolve(discardReceipt))
    const undoStore = createFileSystemUndoStore()
    undoStore.getState().setWorkspace(campaignId)

    const { result } = renderHook(() =>
      useFileSystemExecutor({
        workspaceId: campaignId,
        currentUserId: null,
        activeItemSurface: { parentId: null },
        cacheAdapter,
        navigation: {
          getCurrentResourceId: () => null,
          clearWorkspaceContent: vi.fn(),
          openResource: vi.fn(),
        },
        selectionCommands: {
          clearItemSelection: vi.fn(),
          getSelectionSnapshot: () => ({ selectedItemIds: [] }),
          setSelectedItemIds: vi.fn(),
        },
        uiCommands: {
          setFolderState: vi.fn(),
        },
        executeMutation,
        undoMutation,
        redoMutation: vi.fn(),
        undoStore,
        effects: executorEffects,
      }),
    )

    let createPromise!: Promise<ResourceCommandResult>
    await act(async () => {
      createPromise = result.current.executeCommand({
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: 'Scene' as ResourceTitle,
        parentTarget: { kind: 'direct', parentId: parent.id },
      })
      await Promise.resolve()
    })

    let discardPromise!: Promise<void>
    await act(async () => {
      discardPromise = result.current.discardCreatedItem(testOperationId('discard_transaction'))
      await Promise.resolve()
    })

    expect(undoMutation).not.toHaveBeenCalled()

    await act(async () => {
      commandMutation.resolve(createReceipt)
      await createPromise
      await discardPromise
    })

    expect(undoMutation).toHaveBeenCalledWith(testOperationId('discard_transaction'))
  })

  it('rejects undo replay when the recorded graph fingerprint is stale', async () => {
    const item = createNote({
      id: 'renamed_item' as ResourceId,
      name: 'Old Name',
      slug: 'old-name',
    })
    const nextName = 'New Name' as ResourceTitle
    const snapshot: SidebarCacheSnapshot = { sidebar: [item], trash: [] }
    const renameReceipt = createFileSystemReceipt({
      transactionId: testOperationId('rename_transaction'),
      direction: 'forward',
      command: {
        type: 'rename',
        itemId: item.id,
        name: nextName,
      },
      events: [
        {
          type: 'renamed',
          itemId: item.id,
          slug: 'new-name',
          previousSlug: item.slug,
        },
      ],
      patches: [
        {
          type: 'updateResource',
          itemId: item.id,
          before: { name: item.name },
          fields: { name: nextName },
        },
      ],
    })
    const executeMutation = vi.fn(() => Promise.resolve(renameReceipt))
    const undoMutation = vi.fn()
    const undoStore = createFileSystemUndoStore()
    undoStore.getState().setWorkspace(campaignId)

    const { result } = renderHook(() =>
      useFileSystemExecutor({
        workspaceId: campaignId,
        currentUserId: null,
        activeItemSurface: { parentId: null },
        cacheAdapter: createReadWriteTestCache(snapshot),
        navigation: {
          getCurrentResourceId: () => null,
          clearWorkspaceContent: vi.fn(),
          openResource: vi.fn(),
        },
        selectionCommands: {
          clearItemSelection: vi.fn(),
          getSelectionSnapshot: () => ({ selectedItemIds: [] }),
          setSelectedItemIds: vi.fn(),
        },
        uiCommands: {
          setFolderState: vi.fn(),
        },
        executeMutation,
        undoMutation,
        redoMutation: vi.fn(),
        undoStore,
        effects: executorEffects,
      }),
    )

    await act(async () => {
      const commandResult = await result.current.executeCommand({
        type: 'rename',
        itemId: item.id,
        name: nextName,
      })
      expect(commandResult.status).toBe('completed')
    })

    snapshot.sidebar = snapshot.sidebar.map((currentItem) =>
      currentItem.id === item.id
        ? { ...currentItem, name: 'Externally Changed' as ResourceTitle }
        : currentItem,
    )

    let rejected!: Awaited<ReturnType<typeof result.current.runHistoryCommand>>
    await act(async () => {
      rejected = await result.current.runHistoryCommand('undo')
    })

    expect(rejected).toEqual({ status: 'rejected', reason: 'stale-history' })
    expect(undoMutation).not.toHaveBeenCalled()
  })
})
