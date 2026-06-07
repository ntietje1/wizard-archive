import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { SidebarItemName } from 'shared/sidebar-items/name'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import { FileSystemProvider } from '../filesystem-provider'
import { useFileSystem } from '../useFileSystem'
import type { FileSystemDropIntent } from '../useFileSystem'
import { useFileSystemUndoStore } from '../filesystem-undo-store'
import { setFileSystemClipboard, useFileSystemClipboard } from '../filesystem-clipboard-store'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'

let sidebarItems: Array<AnySidebarItem> = []
let trashItems: Array<AnySidebarItem> = []
const executeMutateAsync = vi.fn()
const undoMutateAsync = vi.fn()
const redoMutateAsync = vi.fn()
const clearEditorContentMock = vi.fn()
const navigateToItemMock = vi.fn()
const toastLoadingMock = vi.hoisted(() => vi.fn(() => 'toast-id'))
const toastDismissMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastInfoMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

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
    parentItemsMap: sidebarItems.reduce((map, item) => {
      const siblings = map.get(item.parentId) ?? []
      siblings.push(item)
      map.set(item.parentId, siblings)
      return map
    }, new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()),
  }),
  useTrashSidebarItems: () => ({
    data: trashItems,
    itemsMap: new Map(trashItems.map((item) => [item._id, item] as const)),
    parentItemsMap: trashItems.reduce((map, item) => {
      const siblings = map.get(item.parentId) ?? []
      siblings.push(item)
      map.set(item.parentId, siblings)
      return map
    }, new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()),
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

vi.mock('sonner', () => ({
  toast: {
    loading: toastLoadingMock,
    dismiss: toastDismissMock,
    success: toastSuccessMock,
    info: toastInfoMock,
    error: toastErrorMock,
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

function createRenameReceipt({
  transactionId = 'transaction_rename' as Id<'filesystemTransactions'>,
  direction = 'forward',
  before = 'Old Name',
  after = 'New Name',
}: {
  transactionId?: Id<'filesystemTransactions'>
  direction?: FileSystemTransactionReceipt['direction']
  before?: string
  after?: string
} = {}): FileSystemTransactionReceipt {
  const itemId = 'rename_item' as Id<'sidebarItems'>
  const beforeName = assertSidebarItemName(before)
  const afterName = assertSidebarItemName(after)
  return {
    transactionId,
    direction,
    command: { type: 'rename', itemId, name: afterName },
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
        before: { name: beforeName },
        fields: { name: afterName },
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

function createUndoCreateReceipt(item: AnySidebarItem): FileSystemTransactionReceipt {
  return {
    transactionId: 'transaction_create' as Id<'filesystemTransactions'>,
    direction: 'undo',
    command: {
      type: 'create',
      itemType: item.type,
      name: item.name,
      parentTarget: { kind: 'direct', parentId: item.parentId },
    },
    events: [{ type: 'created', itemId: item._id, slug: item.slug }],
    patches: [
      {
        type: 'updateSidebarItem',
        itemId: item._id,
        before: { status: SIDEBAR_ITEM_STATUS.active, parentId: item.parentId, slug: item.slug },
        fields: { status: SIDEBAR_ITEM_STATUS.undoHidden },
      },
    ],
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

function createUndoCopiedFolderReceipt({
  folder,
  child,
}: {
  folder: AnySidebarItem
  child: AnySidebarItem
}): FileSystemTransactionReceipt {
  return {
    transactionId: 'transaction_copy_folder' as Id<'filesystemTransactions'>,
    direction: 'undo',
    command: {
      type: 'copy',
      itemIds: ['source_folder' as Id<'sidebarItems'>],
      targetParentId: null,
    },
    events: [
      { type: 'copied', itemId: folder._id, sourceItemId: 'source_folder' as Id<'sidebarItems'> },
    ],
    patches: [
      {
        type: 'updateSidebarItem',
        itemId: folder._id,
        before: {
          status: SIDEBAR_ITEM_STATUS.active,
          parentId: folder.parentId,
          slug: folder.slug,
        },
        fields: { status: SIDEBAR_ITEM_STATUS.undoHidden },
      },
      {
        type: 'updateSidebarItem',
        itemId: child._id,
        before: { status: SIDEBAR_ITEM_STATUS.active, parentId: folder._id, slug: child.slug },
        fields: { status: SIDEBAR_ITEM_STATUS.undoHidden },
      },
    ],
    summary: {
      kind: 'copied',
      affectedCount: 2,
      createdCount: 1,
      mergedCount: 0,
      skippedCount: 0,
    },
    undoable: true,
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
        filesystem.confirmEmptyTrash()
      }}
    >
      Empty Trash
    </button>
  )
}

function ClipboardButtons({
  itemId,
  targetParentId = null,
}: {
  itemId: Id<'sidebarItems'>
  targetParentId?: Id<'sidebarItems'> | null
}) {
  const filesystem = useFileSystem()
  return (
    <>
      <button type="button" onClick={() => filesystem.copy([itemId])}>
        Copy
      </button>
      <button type="button" onClick={() => filesystem.cut([itemId])}>
        Cut
      </button>
      <button type="button" onClick={() => void filesystem.paste(targetParentId)}>
        Paste
      </button>
    </>
  )
}

function ClipboardProbe() {
  const clipboard = useFileSystemClipboard()
  return <output data-testid="clipboard">{JSON.stringify(clipboard)}</output>
}

function DropButton({ intent }: { intent: FileSystemDropIntent }) {
  const filesystem = useFileSystem()
  return (
    <button
      type="button"
      onClick={() => {
        void filesystem.executeDrop(intent)
      }}
    >
      Drop
    </button>
  )
}

function getRenderedClipboard() {
  const text = screen.getByTestId('clipboard').textContent
  return text ? JSON.parse(text) : null
}

describe('FileSystemProvider', () => {
  beforeEach(() => {
    sidebarItems = []
    trashItems = []
    useFileSystemUndoStore.getState().reset()
    setFileSystemClipboard(null)
    useSidebarUIStore.getState().clearSelectionForCampaignChange()
    executeMutateAsync.mockReset()
    undoMutateAsync.mockReset()
    redoMutateAsync.mockReset()
    toastLoadingMock.mockClear()
    toastDismissMock.mockClear()
    toastSuccessMock.mockClear()
    toastInfoMock.mockClear()
    toastErrorMock.mockClear()
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

  it('inserts the optimistic item without opening it while create is pending', async () => {
    let resolveCreate: (receipt: FileSystemTransactionReceipt) => void = () => {}
    executeMutateAsync.mockReturnValueOnce(
      new Promise<FileSystemTransactionReceipt>((resolve) => {
        resolveCreate = resolve
      }),
    )
    render(
      <FileSystemProvider>
        <CreateButton />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(sidebarItems).toHaveLength(1))
    const optimisticItem = sidebarItems[0]
    expect(String(optimisticItem._id)).toMatch(/^optimistic-create-/)
    expect(optimisticItem.slug).toBe('scene')
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([])
    expect(useSidebarUIStore.getState().selectedSlug).toBe(null)
    expect(navigateToItemMock).not.toHaveBeenCalled()
    expect(toastLoadingMock).toHaveBeenCalledWith('Creating item...')

    act(() => resolveCreate(createReceipt()))

    await waitFor(() =>
      expect(useSidebarUIStore.getState().selectedItemIds).toEqual([
        'item_1' as Id<'sidebarItems'>,
      ]),
    )
    await waitFor(() => expect(toastDismissMock).toHaveBeenCalledWith('toast-id'))
    expect(navigateToItemMock).not.toHaveBeenCalled()
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

  it('keeps undo state stable while pending and applies the server receipt when it resolves', async () => {
    const item = createNote({ _id: 'rename_item' as Id<'sidebarItems'>, name: 'New Name' })
    sidebarItems = [item]
    let resolveUndo: (receipt: FileSystemTransactionReceipt) => void = () => {}
    undoMutateAsync.mockReturnValueOnce(
      new Promise<FileSystemTransactionReceipt>((resolve) => {
        resolveUndo = resolve
      }),
    )
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )
    act(() => {
      useFileSystemUndoStore.getState().pushUndo(createRenameReceipt())
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    expect(sidebarItems[0]?.name).toBe('New Name')
    expect(toastLoadingMock).toHaveBeenCalledWith('Undoing...')
    expect(screen.getByTestId('filesystem-operation-status')).toHaveAttribute(
      'data-state',
      'pending',
    )

    act(() =>
      resolveUndo(
        createRenameReceipt({ direction: 'undo', before: 'New Name', after: 'Old Name' }),
      ),
    )

    await waitFor(() => expect(sidebarItems[0]?.name).toBe('Old Name'))
    await waitFor(() => expect(toastDismissMock).toHaveBeenCalledWith('toast-id'))
  })

  it('leaves visible state unchanged when undo fails and preserves the undo stack', async () => {
    const item = createNote({ _id: 'rename_item' as Id<'sidebarItems'>, name: 'New Name' })
    sidebarItems = [item]
    undoMutateAsync.mockRejectedValueOnce(new Error('undo failed'))
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )
    act(() => {
      useFileSystemUndoStore.getState().pushUndo(createRenameReceipt())
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(sidebarItems[0]?.name).toBe('New Name')
    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    expect(useFileSystemUndoStore.getState().undoStack).toHaveLength(1)
    expect(useFileSystemUndoStore.getState().redoStack).toHaveLength(0)
    expect(toastDismissMock).toHaveBeenCalledWith('toast-id')
  })

  it('clears the editor when undo hides the currently viewed created item', async () => {
    const item = createNote({
      _id: 'created_item' as Id<'sidebarItems'>,
      name: 'Scene',
      slug: 'scene',
      status: SIDEBAR_ITEM_STATUS.active,
    })
    sidebarItems = [item]
    undoMutateAsync.mockResolvedValueOnce(createUndoCreateReceipt(item))
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )
    useSidebarUIStore.getState().setSelected(item.slug)
    act(() => {
      useFileSystemUndoStore
        .getState()
        .pushUndo(createReceipt('transaction_create' as Id<'filesystemTransactions'>))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(clearEditorContentMock).toHaveBeenCalledTimes(1))
  })

  it('clears descendant selection and editor state when undo hides a copied folder tree', async () => {
    const folder = createFolder({
      _id: 'copied_folder' as Id<'sidebarItems'>,
      name: 'Copied Folder',
      slug: 'copied-folder',
      status: SIDEBAR_ITEM_STATUS.active,
    })
    const child = createNote({
      _id: 'copied_child' as Id<'sidebarItems'>,
      name: 'Copied Child',
      slug: 'copied-child',
      parentId: folder._id,
      status: SIDEBAR_ITEM_STATUS.active,
    })
    sidebarItems = [folder, child]
    undoMutateAsync.mockResolvedValueOnce(createUndoCopiedFolderReceipt({ folder, child }))
    useSidebarUIStore.getState().setSelected(child.slug)
    useSidebarUIStore.getState().setSelectedItemIds([child._id])

    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )
    act(() => {
      useFileSystemUndoStore.getState().pushUndo({
        ...createReceipt('transaction_copy_folder' as Id<'filesystemTransactions'>),
        command: {
          type: 'copy',
          itemIds: ['source_folder' as Id<'sidebarItems'>],
          targetParentId: null,
        },
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useSidebarUIStore.getState().selectedItemIds).toEqual([]))
    expect(clearEditorContentMock).toHaveBeenCalledTimes(1)
  })

  it('keeps redo state stable while pending and applies the server receipt when it resolves', async () => {
    const item = createNote({ _id: 'rename_item' as Id<'sidebarItems'>, name: 'Old Name' })
    sidebarItems = [item]
    let resolveRedo: (receipt: FileSystemTransactionReceipt) => void = () => {}
    redoMutateAsync.mockReturnValueOnce(
      new Promise<FileSystemTransactionReceipt>((resolve) => {
        resolveRedo = resolve
      }),
    )
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )
    act(() => {
      useFileSystemUndoStore.getState().pushUndo(createRenameReceipt())
      const entry = useFileSystemUndoStore.getState().peekUndo()
      if (!entry) throw new Error('Expected undo entry')
      useFileSystemUndoStore.getState().removeUndo()
      useFileSystemUndoStore.getState().pushRedoEntry(entry)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    await waitFor(() => expect(redoMutateAsync).toHaveBeenCalledTimes(1))
    expect(sidebarItems[0]?.name).toBe('Old Name')
    expect(toastLoadingMock).toHaveBeenCalledWith('Redoing...')

    act(() => resolveRedo(createRenameReceipt({ direction: 'redo' })))

    await waitFor(() => expect(sidebarItems[0]?.name).toBe('New Name'))
    await waitFor(() => expect(toastDismissMock).toHaveBeenCalledWith('toast-id'))
  })

  it('leaves visible state unchanged when redo fails and preserves the redo stack', async () => {
    const item = createNote({ _id: 'rename_item' as Id<'sidebarItems'>, name: 'Old Name' })
    sidebarItems = [item]
    redoMutateAsync.mockRejectedValueOnce(new Error('redo failed'))
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )
    act(() => {
      useFileSystemUndoStore.getState().pushUndo(createRenameReceipt())
      const entry = useFileSystemUndoStore.getState().peekUndo()
      if (!entry) throw new Error('Expected undo entry')
      useFileSystemUndoStore.getState().removeUndo()
      useFileSystemUndoStore.getState().pushRedoEntry(entry)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    expect(sidebarItems[0]?.name).toBe('Old Name')
    await waitFor(() => expect(redoMutateAsync).toHaveBeenCalledTimes(1))
    expect(useFileSystemUndoStore.getState().undoStack).toHaveLength(0)
    expect(useFileSystemUndoStore.getState().redoStack).toHaveLength(1)
    expect(toastDismissMock).toHaveBeenCalledWith('toast-id')
  })

  it('keeps additional undo and redo calls gated while a transaction is pending', async () => {
    const item = createNote({ _id: 'rename_item' as Id<'sidebarItems'>, name: 'New Name' })
    sidebarItems = [item]
    undoMutateAsync.mockReturnValueOnce(new Promise<FileSystemTransactionReceipt>(() => {}))
    render(
      <FileSystemProvider>
        <FileSystemButtons />
      </FileSystemProvider>,
    )
    act(() => {
      useFileSystemUndoStore.getState().pushUndo(createRenameReceipt())
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    expect(redoMutateAsync).not.toHaveBeenCalled()
    expect(toastLoadingMock).toHaveBeenCalledTimes(1)
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

  it('selects created roots after redo without navigating', async () => {
    const staleItem = createNote({ _id: 'stale_item' as Id<'sidebarItems'>, name: 'Stale' })
    const createdItemId = 'item_1' as Id<'sidebarItems'>
    sidebarItems = [staleItem]
    executeMutateAsync.mockResolvedValueOnce(createReceipt())
    undoMutateAsync.mockResolvedValueOnce({ ...createReceipt(), direction: 'undo' })
    redoMutateAsync.mockResolvedValueOnce({ ...createReceipt(), direction: 'redo' })
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
    navigateToItemMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    await waitFor(() =>
      expect(useSidebarUIStore.getState().selectedItemIds).toEqual([createdItemId]),
    )
    expect(navigateToItemMock).not.toHaveBeenCalled()
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
    await waitFor(() => expect(toastDismissMock).toHaveBeenCalledWith('toast-id'))
    expect(toastDismissMock.mock.invocationCallOrder[0]).toBeLessThan(
      toastErrorMock.mock.invocationCallOrder[0],
    )
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

  it('does not copy or cut trashed items into the filesystem clipboard', () => {
    const trashedItem = createNote({
      _id: 'trashed_clipboard_item' as Id<'sidebarItems'>,
      name: 'Trashed Clipboard Item',
      status: SIDEBAR_ITEM_STATUS.trashed,
    })
    trashItems = [trashedItem]
    render(
      <FileSystemProvider>
        <ClipboardProbe />
        <ClipboardButtons itemId={trashedItem._id} />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(getRenderedClipboard()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }))
    expect(executeMutateAsync).not.toHaveBeenCalled()
    expect(toastLoadingMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cut' }))
    expect(getRenderedClipboard()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }))
    expect(executeMutateAsync).not.toHaveBeenCalled()
    expect(toastLoadingMock).not.toHaveBeenCalled()
  })

  it('keeps a cut clipboard when conflict resolution is cancelled', async () => {
    const source = createNote({
      _id: 'cut_source' as Id<'sidebarItems'>,
      name: 'Shared Name',
      parentId: null,
    })
    const target = createFolder({
      _id: 'target_folder' as Id<'sidebarItems'>,
      name: 'Target Folder',
    })
    const conflictingChild = createNote({
      _id: 'existing_child' as Id<'sidebarItems'>,
      name: 'Shared Name',
      parentId: target._id,
    })
    sidebarItems = [source, target, conflictingChild]
    render(
      <FileSystemProvider>
        <ClipboardProbe />
        <ClipboardButtons itemId={source._id} targetParentId={target._id} />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cut' }))
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }))

    await screen.findByRole('dialog', { name: 'Resolve File Conflict' })
    expect(executeMutateAsync).not.toHaveBeenCalled()
    expect(toastLoadingMock).not.toHaveBeenCalled()
    expect(getRenderedClipboard()).toMatchObject({
      mode: 'cut',
      itemIds: [source._id],
    })

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Resolve File Conflict' })).toBeNull(),
    )
    expect(getRenderedClipboard()).toMatchObject({
      mode: 'cut',
      itemIds: [source._id],
    })
  })

  it('opens a drop target only after a conflicted drop commits', async () => {
    const sourceParent = createFolder({
      _id: 'source_parent' as Id<'sidebarItems'>,
      name: 'Source Folder',
    })
    const target = createFolder({
      _id: 'target_folder' as Id<'sidebarItems'>,
      name: 'Target Folder',
    })
    const source = createNote({
      _id: 'drop_source' as Id<'sidebarItems'>,
      name: 'Shared Name',
      parentId: sourceParent._id,
    })
    const conflictingChild = createNote({
      _id: 'drop_existing_child' as Id<'sidebarItems'>,
      name: 'Shared Name',
      parentId: target._id,
    })
    sidebarItems = [sourceParent, target, source, conflictingChild]
    render(
      <FileSystemProvider>
        <DropButton
          intent={{
            itemIds: [source._id],
            target: { type: 'folder', folder: target, ancestorIds: [] },
            options: { copy: true },
          }}
        />
      </FileSystemProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Drop' }))

    await screen.findByRole('dialog', { name: 'Resolve File Conflict' })
    expect(executeMutateAsync).not.toHaveBeenCalled()
    expect(
      useSidebarUIStore.getState().campaignStates.campaign_1?.folderStates[target._id],
    ).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Keep both items' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    expect(executeMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        decisions: [{ sourceItemId: source._id, action: 'keepBoth' }],
      }),
    )
    await waitFor(() =>
      expect(useSidebarUIStore.getState().campaignStates.campaign_1?.folderStates[target._id]).toBe(
        true,
      ),
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
    await screen.findByRole('dialog', { name: 'Empty Trash' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Empty Trash' }).at(-1)!)

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useSidebarUIStore.getState().selectedItemIds).toEqual([]))
    expect(clearEditorContentMock).toHaveBeenCalled()
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
