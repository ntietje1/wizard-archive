import { describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import { createFileSystemCacheAdapter } from '../cache'
import type { SidebarCacheSnapshot } from '../cache-patches'
import {
  createFileSystemItemCommandOperations,
  createFileSystemTrashDialogOperations,
} from '../item-command-operations'
import { completedResourceCommand } from '../transaction-contract'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { createCreatedItemReceipt } from './receipt-factory'
import { isUuidV7 } from '../../resources/domain-id'

function createTestCache(snapshot: SidebarCacheSnapshot) {
  return createFileSystemCacheAdapter({
    getSnapshot: () => snapshot,
    replaceSnapshot: () => {},
  })
}

describe('filesystem item command operations', () => {
  it('forwards the package-owned parent plan through command execution', async () => {
    const created = createNote({ name: 'Scene', slug: 'scene' })
    const parentPlan = {
      kind: 'path' as const,
      folders: [{ kind: 'virtual' as const, name: 'Scenes' }],
    }
    const executeCommand = vi.fn().mockResolvedValue({
      status: 'completed',
      receipt: createCreatedItemReceipt(created),
    })
    const operations = createFileSystemItemCommandOperations({
      discardCreatedItem: vi.fn(),
      executeCommand,
    })

    await operations.createItem({
      itemType: RESOURCE_TYPES.notes,
      name: created.name,
      parentTarget: { kind: 'path', baseParentId: null, pathSegments: ['Scenes'] },
      parentPlan,
    })

    expect(executeCommand).toHaveBeenCalledWith(
      {
        type: 'create',
        resourceId: expect.any(String),
        itemType: RESOURCE_TYPES.notes,
        name: created.name,
        parentTarget: { kind: 'path', baseParentId: null, pathSegments: ['Scenes'] },
      },
      { createParentPlan: parentPlan },
    )
    expect(isUuidV7(executeCommand.mock.calls[0]![0].resourceId)).toBe(true)
  })

  it('rejects create receipts that omit the created item event', async () => {
    const created = createNote({ name: 'Scene', slug: 'scene' })
    const receipt = { ...createCreatedItemReceipt(created), events: [] }
    const executeCommand = vi.fn().mockResolvedValue({ status: 'completed', receipt })
    const operations = createFileSystemItemCommandOperations({
      discardCreatedItem: vi.fn(),
      executeCommand,
    })

    await expect(
      operations.createItem({
        itemType: RESOURCE_TYPES.notes,
        name: created.name,
        parentTarget: { kind: 'direct', parentId: null },
      }),
    ).rejects.toThrow('Create item receipt did not include created item')
  })

  it('rolls back created items when initialization fails', async () => {
    const created = createNote({ name: 'Scene', slug: 'scene' })
    const receipt = createCreatedItemReceipt(created)
    const executeCommand = vi.fn().mockResolvedValue({ status: 'completed', receipt })
    const discardCreatedItem = vi.fn()
    const initializeError = new Error('init failed')
    const operations = createFileSystemItemCommandOperations({
      discardCreatedItem,
      executeCommand,
    })

    await expect(
      operations.createItem(
        {
          itemType: RESOURCE_TYPES.notes,
          name: created.name,
          parentTarget: { kind: 'direct', parentId: null },
        },
        () => {
          throw initializeError
        },
      ),
    ).rejects.toBe(initializeError)

    expect(discardCreatedItem).toHaveBeenCalledWith(receipt.transactionId)
  })

  it('discards a created item only once when synchronous finalization fails', async () => {
    const created = createNote({ name: 'Scene', slug: 'scene' })
    const receipt = createCreatedItemReceipt(created)
    const finalizeError = new Error('finalize failed')
    const discardCreatedItem = vi.fn()
    const operations = createFileSystemItemCommandOperations({
      discardCreatedItem,
      executeCommand: vi.fn().mockResolvedValue({ status: 'completed', receipt }),
      finalizeCreatedItem: vi.fn(() => {
        throw finalizeError
      }),
    })

    await expect(
      operations.createItem({
        itemType: RESOURCE_TYPES.notes,
        name: created.name,
        parentTarget: { kind: 'direct', parentId: null },
      }),
    ).rejects.toBe(finalizeError)

    expect(discardCreatedItem).toHaveBeenCalledExactlyOnceWith(receipt.transactionId)
  })

  it('requests folder trash confirmation for non-empty folders', async () => {
    const folder = createFolder({ name: 'Scenes' })
    const child = createNote({ parentId: folder.id })
    const snapshot: SidebarCacheSnapshot = { sidebar: [folder, child], trash: [] }
    const dialogs = {
      requestDeleteForever: vi.fn(),
      requestEmptyTrash: vi.fn(),
      requestTrashFolder: vi.fn(),
    }
    const trashItems = vi.fn((itemIds: Array<typeof folder.id>) => {
      snapshot.sidebar = snapshot.sidebar.filter((item) => !itemIds.includes(item.id))
      return Promise.resolve(completedResourceCommand({ type: 'trash', itemIds }, []))
    })
    const operations = createFileSystemTrashDialogOperations({
      cacheAdapter: createTestCache(snapshot),
      dialogs,
      trashItems,
    })

    await expect(operations.requestTrashItems([folder.id])).resolves.toEqual({
      status: 'pending',
      reason: 'folder_confirmation_required',
    })

    expect(dialogs.requestTrashFolder).toHaveBeenCalledWith(folder)
    expect(snapshot.sidebar).toEqual([folder, child])
  })

  it('requests folder confirmation when a mixed selection contains a non-empty folder', async () => {
    const folder = createFolder({ name: 'Scenes' })
    const child = createNote({ parentId: folder.id })
    const unrelated = createNote({ name: 'Unrelated' })
    const dialogs = {
      requestDeleteForever: vi.fn(),
      requestEmptyTrash: vi.fn(),
      requestTrashFolder: vi.fn(),
    }
    const trashItems = vi.fn()
    const operations = createFileSystemTrashDialogOperations({
      cacheAdapter: createTestCache({ sidebar: [folder, child, unrelated], trash: [] }),
      dialogs,
      trashItems,
    })

    await expect(operations.requestTrashItems([folder.id, unrelated.id])).resolves.toEqual({
      status: 'pending',
      reason: 'folder_confirmation_required',
    })
    expect(dialogs.requestTrashFolder).toHaveBeenCalledWith(folder)
    expect(trashItems).not.toHaveBeenCalled()
  })

  it('returns an explicit no-op trash result when no operation items resolve', async () => {
    const dialogs = {
      requestDeleteForever: vi.fn(),
      requestEmptyTrash: vi.fn(),
      requestTrashFolder: vi.fn(),
    }
    const trashItems = vi.fn()
    const operations = createFileSystemTrashDialogOperations({
      cacheAdapter: createTestCache({ sidebar: [], trash: [] }),
      dialogs,
      trashItems,
    })

    await expect(operations.requestTrashItems(['missing-item' as never])).resolves.toEqual({
      status: 'noop',
      reason: 'no_items',
    })

    expect(dialogs.requestTrashFolder).not.toHaveBeenCalled()
    expect(trashItems).not.toHaveBeenCalled()
  })
})
