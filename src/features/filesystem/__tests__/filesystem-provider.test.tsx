import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'convex/sidebarItems/filesystem/receipts'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemName } from 'convex/sidebarItems/validation/name'
import { FileSystemProvider } from '../filesystem-provider'
import { useFileSystem } from '../useFileSystem'
import { useFileSystemUndoStore } from '../filesystem-undo-store'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'

let sidebarItems: Array<AnySidebarItem> = []
let trashItems: Array<AnySidebarItem> = []
const executeMutateAsync = vi.fn()
const undoMutateAsync = vi.fn()
const redoMutateAsync = vi.fn()
const clearEditorContentMock = vi.fn()
const navigateToItemMock = vi.fn()

vi.mock('convex/_generated/api', () => ({
  api: {
    sidebarItems: {
      filesystem: {
        mutations: {
          executeFileSystemCommand: 'executeFileSystemCommand',
          undoFileSystemTransaction: 'undoFileSystemTransaction',
          redoFileSystemTransaction: 'redoFileSystemTransaction',
        },
      },
    },
  },
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: 'campaign_1' as Id<'campaigns'>,
    campaign: {
      data: {
        myMembership: {
          userId: 'user_1' as Id<'userProfiles'>,
        },
      },
    },
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  SIDEBAR_ITEMS_VIEW: { active: 'active', trash: 'trash' },
  useActiveSidebarItems: () => ({
    data: sidebarItems,
    itemsMap: new Map(sidebarItems.map((item) => [item._id, item] as const)),
    parentItemsMap: new Map([[null, sidebarItems]]),
  }),
  useTrashSidebarItems: () => ({
    data: trashItems,
    itemsMap: new Map(trashItems.map((item) => [item._id, item] as const)),
    parentItemsMap: new Map([[null, trashItems]]),
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemsCache', () => ({
  useSidebarItemsCache: () => ({
    get: (view: string) => (view === 'trash' ? trashItems : sidebarItems),
    update: (view: string, updater: (items: Array<AnySidebarItem>) => Array<AnySidebarItem>) => {
      if (view === 'trash') {
        trashItems = updater(trashItems)
      } else {
        sidebarItems = updater(sidebarItems)
      }
    },
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({
    clearEditorContent: clearEditorContentMock,
    navigateToItem: navigateToItemMock,
  }),
}))

vi.mock('~/features/sidebar/hooks/useItemSurfaceHotkeys', () => ({
  useItemSurfaceHotkeys: vi.fn(),
}))

vi.mock('../filesystem-hotkeys', () => ({
  useFileSystemUndoHotkeys: vi.fn(),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: (mutationName: string) => {
    const mutations = {
      executeFileSystemCommand: { mutateAsync: executeMutateAsync },
      undoFileSystemTransaction: { mutateAsync: undoMutateAsync },
      redoFileSystemTransaction: { mutateAsync: redoMutateAsync },
    }
    return mutations[mutationName as keyof typeof mutations]
  },
}))

function createReceipt(
  transactionId: Id<'filesystemTransactions'> = 'transaction_1' as Id<'filesystemTransactions'>,
): FileSystemTransactionReceipt {
  const item = createNote({
    _id: 'item_1' as Id<'sidebarItems'>,
    name: 'Scene',
    slug: 'scene',
    status: SIDEBAR_ITEM_STATUS.active,
  })
  const patches = [{ type: 'upsertSidebarItem' as const, item }]
  return {
    transactionId,
    direction: 'forward',
    command: {
      type: 'create',
      itemType: SIDEBAR_ITEM_TYPES.notes,
      name: 'Scene' as SidebarItemName,
      parentTarget: { kind: 'direct', parentId: null },
    },
    events: [
      {
        type: 'created',
        itemId: item._id,
        slug: 'scene',
      },
    ],
    patches,
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

function createDeleteForeverReceipt(item: AnySidebarItem): FileSystemTransactionReceipt {
  return {
    transactionId: 'transaction_delete_forever' as Id<'filesystemTransactions'>,
    direction: 'forward',
    command: { type: 'deleteForever', itemIds: [item._id] },
    events: [{ type: 'deletedForever', itemId: item._id }],
    patches: [{ type: 'removeSidebarItem', itemId: item._id, snapshot: item }],
    summary: {
      kind: 'deletedForever',
      affectedCount: 1,
      createdCount: 0,
      mergedCount: 0,
      skippedCount: 0,
    },
    undoable: false,
  }
}

function CreateButton() {
  const filesystem = useFileSystem()
  return (
    <button
      type="button"
      onClick={() => {
        void filesystem.createItem({
          itemType: SIDEBAR_ITEM_TYPES.notes,
          name: 'Scene' as SidebarItemName,
          parentTarget: { kind: 'direct', parentId: null },
        })
      }}
    >
      Create
    </button>
  )
}

function FileSystemButtons() {
  const filesystem = useFileSystem()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void filesystem.createItem({
            itemType: SIDEBAR_ITEM_TYPES.notes,
            name: 'Scene' as SidebarItemName,
            parentTarget: { kind: 'direct', parentId: null },
          })
        }}
      >
        Create
      </button>
      <button
        type="button"
        onClick={() => {
          void filesystem.undo()
        }}
      >
        Undo
      </button>
      <button
        type="button"
        onClick={() => {
          void filesystem.redo()
        }}
      >
        Redo
      </button>
    </>
  )
}

function EmptyTrashButton() {
  const filesystem = useFileSystem()
  return (
    <button
      type="button"
      onClick={() => {
        void filesystem.emptyTrash()
      }}
    >
      Empty Trash
    </button>
  )
}

describe('FileSystemProvider', () => {
  beforeEach(() => {
    sidebarItems = []
    trashItems = []
    useFileSystemUndoStore.getState().reset()
    useSidebarUIStore.getState().clearSelectionForCampaignChange()
    executeMutateAsync.mockReset()
    undoMutateAsync.mockReset()
    redoMutateAsync.mockReset()
    clearEditorContentMock.mockReset()
    navigateToItemMock.mockReset()
    executeMutateAsync.mockResolvedValue(createReceipt())
    vi.stubGlobal('crypto', { randomUUID: () => 'operation-1' })
  })

  it('sends a client operation id for forward commands', async () => {
    render(
      <FileSystemProvider>
        <CreateButton />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalled())
    expect(executeMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ clientOperationId: 'operation-1' }),
    )
  })

  it('runs undo and redo through transaction mutations', async () => {
    undoMutateAsync.mockResolvedValue({
      ...createReceipt(),
      direction: 'undo',
    })
    redoMutateAsync.mockResolvedValue({
      ...createReceipt(),
      direction: 'redo',
    })
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useFileSystemUndoStore.getState().undoStack).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(undoMutateAsync).toHaveBeenCalledWith({ transactionId: 'transaction_1' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() =>
      expect(redoMutateAsync).toHaveBeenCalledWith({ transactionId: 'transaction_1' }),
    )
  })

  it('keeps original transaction ids through multiple undo and redo operations', async () => {
    executeMutateAsync
      .mockResolvedValueOnce(createReceipt('transaction_1' as Id<'filesystemTransactions'>))
      .mockResolvedValueOnce(createReceipt('transaction_2' as Id<'filesystemTransactions'>))
    undoMutateAsync
      .mockResolvedValueOnce({
        ...createReceipt('transaction_2' as Id<'filesystemTransactions'>),
        direction: 'undo',
      })
      .mockResolvedValueOnce({
        ...createReceipt('transaction_1' as Id<'filesystemTransactions'>),
        direction: 'undo',
      })
    redoMutateAsync
      .mockResolvedValueOnce({
        ...createReceipt('transaction_1' as Id<'filesystemTransactions'>),
        direction: 'redo',
      })
      .mockResolvedValueOnce({
        ...createReceipt('transaction_2' as Id<'filesystemTransactions'>),
        direction: 'redo',
      })
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(useFileSystemUndoStore.getState().undoStack).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(undoMutateAsync).toHaveBeenNthCalledWith(1, { transactionId: 'transaction_2' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(undoMutateAsync).toHaveBeenNthCalledWith(2, { transactionId: 'transaction_1' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() =>
      expect(redoMutateAsync).toHaveBeenNthCalledWith(1, { transactionId: 'transaction_1' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() =>
      expect(redoMutateAsync).toHaveBeenNthCalledWith(2, { transactionId: 'transaction_2' }),
    )
  })

  it('selects created roots after redo', async () => {
    const staleItem = createNote({ _id: 'stale_item' as Id<'sidebarItems'>, name: 'Stale' })
    const createdItemId = 'item_1' as Id<'sidebarItems'>
    sidebarItems = [staleItem]
    executeMutateAsync.mockResolvedValueOnce(createReceipt())
    undoMutateAsync.mockResolvedValueOnce(createReceipt())
    redoMutateAsync.mockResolvedValueOnce(createReceipt())
    useSidebarUIStore.getState().setSelectedItemIds([staleItem._id])

    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(useFileSystemUndoStore.getState().undoStack).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(useFileSystemUndoStore.getState().redoStack).toHaveLength(1))
    useSidebarUIStore.getState().setSelectedItemIds([staleItem._id])

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    await waitFor(() =>
      expect(useSidebarUIStore.getState().selectedItemIds).toEqual([createdItemId]),
    )
  })

  it('does not push failed operations into undo', async () => {
    executeMutateAsync.mockRejectedValueOnce(new Error('create failed'))
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    expect(useFileSystemUndoStore.getState().undoStack).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undoMutateAsync).not.toHaveBeenCalled()
  })

  it('does not run undo while another filesystem operation is pending', async () => {
    let resolveCreate: (receipt: FileSystemTransactionReceipt) => void = () => {}
    executeMutateAsync.mockReturnValueOnce(
      new Promise<FileSystemTransactionReceipt>((resolve) => {
        resolveCreate = resolve
      }),
    )
    undoMutateAsync.mockResolvedValueOnce({
      ...createReceipt('transaction_2' as Id<'filesystemTransactions'>),
      direction: 'undo',
    })
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )
    act(() => {
      useFileSystemUndoStore.getState().pushUndo(createReceipt())
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undoMutateAsync).not.toHaveBeenCalled()

    act(() => resolveCreate(createReceipt('transaction_2' as Id<'filesystemTransactions'>)))
    await waitFor(() => expect(useFileSystemUndoStore.getState().undoStack).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(undoMutateAsync).toHaveBeenCalledWith({ transactionId: 'transaction_2' }),
    )
  })

  it('clears trash selection and editor state from delete receipt snapshots', async () => {
    const item = createNote({
      _id: 'trash_item' as Id<'sidebarItems'>,
      name: 'Trash Item',
      slug: 'trash-item',
      status: SIDEBAR_ITEM_STATUS.trashed,
    })
    trashItems = [item]
    executeMutateAsync.mockResolvedValueOnce(createDeleteForeverReceipt(item))
    useSidebarUIStore.getState().setSelected(item.slug)
    useSidebarUIStore.getState().setSelectedItemIds([item._id])

    render(
      <FileSystemProvider>
        <EmptyTrashButton />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useSidebarUIStore.getState().selectedItemIds).toEqual([]))
    expect(clearEditorContentMock).toHaveBeenCalled()
  })

  it('records undo before reporting a receipt side-effect failure', async () => {
    navigateToItemMock.mockRejectedValueOnce(new Error('navigation failed'))

    render(
      <FileSystemProvider>
        <CreateButton />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useFileSystemUndoStore.getState().undoStack).toHaveLength(1))
  })

  it('generates a fresh client operation id for each forward command', async () => {
    let operationIndex = 0
    vi.stubGlobal('crypto', {
      randomUUID: () => `operation-${++operationIndex}`,
    })
    render(
      <FileSystemProvider>
        <CreateButton />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(2))
    expect(executeMutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ clientOperationId: 'operation-1' }),
    )
    expect(executeMutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ clientOperationId: 'operation-2' }),
    )
  })
})
