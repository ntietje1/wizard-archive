import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createWorkspaceResourceReadModel } from '@wizard-archive/editor/resources/items'
import type {
  WizardEditorItem,
  WizardEditorResourceCreateCommand,
  useWizardEditorResourceCommandRuntime,
} from '@wizard-archive/editor/adapter'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import { testCampaignMemberId } from '../../../../../shared/test/campaign-member-id'
import { isUuidV7 } from '@wizard-archive/editor/resources/domain-id'
import { createContext, use } from 'react'
import type { ReactNode } from 'react'
import { useLiveFileSystemRuntime } from '../host'
import type { LiveFileSystemReadModel } from '../read-model'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testOperationId } from '../../../../../shared/test/operation-id'
import type {
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'

let sidebarItems: Array<WizardEditorItem> = []
let trashItems: Array<WizardEditorItem> = []
const executeMutateAsync = vi.fn()
const undoMutateAsync = vi.fn()
const redoMutateAsync = vi.fn()
const clearWorkspaceContentMock = vi.fn()
const getCurrentResourceIdMock = vi.fn(() => currentResourceIdState.value)
const navigateToItemMock = vi.fn()
const toastLoadingMock = vi.hoisted(() => vi.fn(() => 'toast-id'))
const toastDismissMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastInfoMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())
const currentResourceIdState = vi.hoisted(() => ({
  value: null as ResourceId | null,
}))
const currentWorkspaceIdState = vi.hoisted(() => ({
  value: '01980c1a-5e70-7000-8000-000000000301' as CampaignId,
}))
const TRANSACTION_1 = testOperationId('transaction_1')
const TRANSACTION_2 = testOperationId('transaction_2')
type LiveFileSystemRuntime = ReturnType<typeof useLiveFileSystemRuntime>
type FileSystemOperationHost = LiveFileSystemRuntime['filesystem']['operations']
type FileSystemClipboardOperations = LiveFileSystemRuntime['filesystem']['clipboardOperations']
type FileSystemDropOperations = LiveFileSystemRuntime['filesystem']['dropOperations']
type FileSystemTrashOperations = LiveFileSystemRuntime['filesystem']['trashOperations']
type FileSystemHistoryOperations = LiveFileSystemRuntime['filesystem']['historyOperations']
type ResourceTransactionReceipt = Awaited<
  ReturnType<Parameters<typeof useWizardEditorResourceCommandRuntime>[0]['executeMutation']>
>
type ResourcePatchRow = Extract<
  ResourceTransactionReceipt['patches'][number],
  { type: 'upsertResource' }
>['item']
type TestResourceTitle = WizardEditorItem['name']
const TEST_RESOURCE_STATUS = {
  active: 'active',
  trashed: 'trashed',
  undoHidden: 'undoHidden',
} as const satisfies Record<string, WizardEditorItem['status']>
const TEST_RESOURCE_TYPES = {
  notes: 'note',
} as const satisfies Record<string, WizardEditorResourceCreateCommand['itemType']>
const TestFileSystemHostContext = createContext<FileSystemOperationHost | null>(null)
const TestFileSystemClipboardContext = createContext<FileSystemClipboardOperations | null>(null)
const TestFileSystemDropContext = createContext<FileSystemDropOperations | null>(null)
const TestFileSystemTrashContext = createContext<FileSystemTrashOperations | null>(null)
const TestFileSystemHistoryContext = createContext<FileSystemHistoryOperations | null>(null)

function testResourceTitle(name: string): TestResourceTitle {
  if (name.trim().length === 0) throw new Error('Expected non-empty test resource name')
  return name as TestResourceTitle
}

function patchRow(item: WizardEditorItem): ResourcePatchRow {
  return {
    ...item,
    workspaceId: currentWorkspaceIdState.value,
  } as unknown as ResourcePatchRow
}
type FileSystemDropCommand = Parameters<FileSystemDropOperations['executeDropCommand']>[0]

function useTestFileSystemHost() {
  const value = use(TestFileSystemHostContext)
  if (!value) throw new Error('Expected test filesystem host')
  return value
}

function useTestFileSystemHistory() {
  const value = use(TestFileSystemHistoryContext)
  if (!value) throw new Error('Expected test filesystem history operations')
  return value
}

function useTestFileSystemClipboard() {
  const value = use(TestFileSystemClipboardContext)
  if (!value) throw new Error('Expected test filesystem clipboard operations')
  return value
}

function useTestFileSystemDrop() {
  const value = use(TestFileSystemDropContext)
  if (!value) throw new Error('Expected test filesystem drop operations')
  return value
}

function useTestFileSystemTrash() {
  const value = use(TestFileSystemTrashContext)
  if (!value) throw new Error('Expected test filesystem trash operations')
  return value
}

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
    campaignId: currentWorkspaceIdState.value,
    campaign: {
      data: {
        myMembership: {
          id: testCampaignMemberId('member_1'),
        },
      },
    },
  }),
}))

vi.mock('~/editor-adapters/live/filesystem/sidebar-items-cache', () => ({
  useLiveSidebarItemsCache: () => ({
    getSnapshot: () => ({ sidebar: sidebarItems, trash: trashItems }),
    replaceSnapshot: (
      updater: (snapshot: { sidebar: Array<WizardEditorItem>; trash: Array<WizardEditorItem> }) => {
        sidebar: Array<WizardEditorItem>
        trash: Array<WizardEditorItem>
      },
    ) => {
      const next = updater({ sidebar: sidebarItems, trash: trashItems })
      sidebarItems = next.sidebar
      trashItems = next.trash
    },
  }),
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

function createReceipt(transactionId: OperationId = TRANSACTION_1): ResourceTransactionReceipt {
  const item = createNote({
    id: 'item_1' as ResourceId,
    name: 'Scene',
    status: TEST_RESOURCE_STATUS.active,
  })
  const patches = [{ type: 'upsertResource' as const, item: patchRow(item) }]
  return {
    transactionId,
    direction: 'forward',
    command: {
      type: 'create',
      resourceId: item.id,
      itemType: TEST_RESOURCE_TYPES.notes,
      name: testResourceTitle('Scene'),
      parentTarget: { kind: 'direct', parentId: null },
    },
    events: [
      {
        type: 'created',
        itemId: item.id,
      },
    ],
    patches,
    summary: {
      kind: 'created',
      affectedCount: 1,
      createdCount: 1,
    },
    undoable: true,
  }
}

function createDeleteForeverReceipt(item: WizardEditorItem): ResourceTransactionReceipt {
  return {
    transactionId: testOperationId('transaction_delete_forever'),
    direction: 'forward',
    command: { type: 'deleteForever', itemIds: [item.id] },
    events: [{ type: 'deletedForever', itemId: item.id }],
    patches: [{ type: 'removeResource', itemId: item.id, snapshot: patchRow(item) }],
    summary: {
      kind: 'deletedForever',
      affectedCount: 1,
      createdCount: 0,
    },
    undoable: false,
  }
}

function createRenameReceipt({
  transactionId = testOperationId('transaction_rename'),
  direction = 'forward',
  before = 'Old Name',
  after = 'New Name',
}: {
  transactionId?: OperationId
  direction?: ResourceTransactionReceipt['direction']
  before?: string
  after?: string
} = {}): ResourceTransactionReceipt {
  const itemId = 'rename_item' as ResourceId
  const beforeName = testResourceTitle(before)
  const afterName = testResourceTitle(after)
  return {
    transactionId,
    direction,
    command: { type: 'rename', itemId, name: afterName },
    events: [
      {
        type: 'renamed',
        itemId,
      },
    ],
    patches: [
      {
        type: 'updateResource',
        itemId,
        before: { name: beforeName },
        fields: { name: afterName },
      },
    ],
    summary: {
      kind: 'renamed',
      affectedCount: 1,
      createdCount: 0,
    },
    undoable: true,
  }
}

function createUndoCreateReceipt(item: WizardEditorItem): ResourceTransactionReceipt {
  return {
    transactionId: testOperationId('transaction_create'),
    direction: 'undo',
    command: {
      type: 'create',
      resourceId: item.id,
      itemType: item.type,
      name: item.name,
      parentTarget: { kind: 'direct', parentId: item.parentId },
    },
    events: [{ type: 'created', itemId: item.id }],
    patches: [
      {
        type: 'updateResource',
        itemId: item.id,
        before: {
          status: TEST_RESOURCE_STATUS.active,
          parentId: item.parentId,
        },
        fields: { status: TEST_RESOURCE_STATUS.undoHidden },
      },
    ],
    summary: {
      kind: 'created',
      affectedCount: 1,
      createdCount: 1,
    },
    undoable: true,
  }
}

function createUndoCopiedFolderReceipt({
  folder,
  child,
}: {
  folder: WizardEditorItem
  child: WizardEditorItem
}): ResourceTransactionReceipt {
  return {
    transactionId: testOperationId('transaction_copy_folder'),
    direction: 'undo',
    command: {
      type: 'copy',
      itemIds: ['source_folder' as ResourceId],
      targetParentId: null,
    },
    events: [{ type: 'copied', itemId: folder.id, sourceItemId: 'source_folder' as ResourceId }],
    patches: [
      {
        type: 'updateResource',
        itemId: folder.id,
        before: {
          status: TEST_RESOURCE_STATUS.active,
          parentId: folder.parentId,
        },
        fields: { status: TEST_RESOURCE_STATUS.undoHidden },
      },
      {
        type: 'updateResource',
        itemId: child.id,
        before: { status: TEST_RESOURCE_STATUS.active, parentId: folder.id },
        fields: { status: TEST_RESOURCE_STATUS.undoHidden },
      },
    ],
    summary: {
      kind: 'copied',
      affectedCount: 2,
      createdCount: 1,
    },
    undoable: true,
  }
}

function CreateButton() {
  const filesystem = useTestFileSystemHost()
  return (
    <button
      type="button"
      onClick={() => {
        void Promise.resolve(
          filesystem.createItem({
            itemType: TEST_RESOURCE_TYPES.notes,
            name: testResourceTitle('Scene'),
            parentTarget: { kind: 'direct', parentId: null },
          }),
        ).catch(() => undefined)
      }}
    >
      Create
    </button>
  )
}

function FileSystemButtons() {
  const filesystem = useTestFileSystemHost()
  const history = useTestFileSystemHistory()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void filesystem.createItem({
            itemType: TEST_RESOURCE_TYPES.notes,
            name: testResourceTitle('Scene'),
            parentTarget: { kind: 'direct', parentId: null },
          })
        }}
      >
        Create
      </button>
      <button
        type="button"
        onClick={() => {
          void history.undo()
        }}
      >
        Undo
      </button>
      <button
        type="button"
        onClick={() => {
          void history.redo()
        }}
      >
        Redo
      </button>
      <output data-testid="history-state">
        {JSON.stringify({ canUndo: history.canUndo, canRedo: history.canRedo })}
      </output>
    </>
  )
}

function RenameButton({ itemId, name = 'New Name' }: { itemId: ResourceId; name?: string }) {
  const filesystem = useTestFileSystemHost()
  return (
    <button
      type="button"
      onClick={() => {
        void filesystem.renameItem({
          itemId,
          name: testResourceTitle(name),
        })
      }}
    >
      Rename
    </button>
  )
}

function EmptyTrashButton() {
  const trash = useTestFileSystemTrash()
  return (
    <button
      type="button"
      onClick={() => {
        trash.confirmEmptyTrash()
      }}
    >
      Empty Trash
    </button>
  )
}

function ToggleBookmarksButton({ itemIds }: { itemIds: Array<ResourceId> }) {
  const filesystem = useTestFileSystemHost()
  return (
    <button type="button" onClick={() => void filesystem.toggleBookmarks(itemIds)}>
      Toggle Bookmarks
    </button>
  )
}

function ClipboardButtons({
  itemId,
  targetParentId = null,
}: {
  itemId: ResourceId
  targetParentId?: ResourceId | null
}) {
  const clipboard = useTestFileSystemClipboard()
  return (
    <>
      <button type="button" onClick={() => clipboard.copy([itemId])}>
        Copy
      </button>
      <button type="button" onClick={() => clipboard.cut([itemId])}>
        Cut
      </button>
      <button type="button" onClick={() => void clipboard.paste(targetParentId)}>
        Paste
      </button>
    </>
  )
}

function DropButton({ command }: { command: FileSystemDropCommand }) {
  const dropOperations = useTestFileSystemDrop()
  return (
    <button
      type="button"
      onClick={() => {
        void dropOperations.executeDropCommand(command)
      }}
    >
      Drop
    </button>
  )
}

function getRenderedHistoryState() {
  const text = screen.getByTestId('history-state').textContent
  return text ? (JSON.parse(text) as { canUndo: boolean; canRedo: boolean }) : null
}

function TestLiveFileSystemHost({ children }: { children: ReactNode }) {
  const runtime = useLiveFileSystemRuntime(
    currentWorkspaceIdState.value,
    {
      getCurrentResourceId: getCurrentResourceIdMock,
      clearWorkspaceContent: clearWorkspaceContentMock,
      openResource: (resource, options) => navigateToItemMock(resource.id, options),
    },
    createTestFileSystemReadModel(),
  )
  const filesystem = runtime.filesystem

  return (
    <TestFileSystemHostContext.Provider value={filesystem.operations}>
      <TestFileSystemClipboardContext.Provider value={filesystem.clipboardOperations}>
        <TestFileSystemDropContext.Provider value={filesystem.dropOperations}>
          <TestFileSystemTrashContext.Provider value={filesystem.trashOperations}>
            <TestFileSystemHistoryContext.Provider value={filesystem.historyOperations}>
              {children}
              {filesystem.dialog}
            </TestFileSystemHistoryContext.Provider>
          </TestFileSystemTrashContext.Provider>
        </TestFileSystemDropContext.Provider>
      </TestFileSystemClipboardContext.Provider>
    </TestFileSystemHostContext.Provider>
  )
}

function createTestFileSystemReadModel(): LiveFileSystemReadModel {
  return {
    activeItems: sidebarItems,
    activeError: null,
    activeStatus: 'success',
    allItems: [...sidebarItems, ...trashItems],
    refreshActive: vi.fn(),
    refreshTrash: vi.fn(),
    visibleTrashItems: trashItems,
    trashError: null,
    trashStatus: 'success',
    visibleActiveItems: sidebarItems,
    readModel: createWorkspaceResourceReadModel([...sidebarItems, ...trashItems]),
  }
}

describe('useLiveFileSystemRuntime', () => {
  let campaignIndex = 0

  beforeEach(() => {
    sidebarItems = []
    trashItems = []
    currentWorkspaceIdState.value = testCampaignId(`campaign_${++campaignIndex}`)
    executeMutateAsync.mockReset()
    undoMutateAsync.mockReset()
    redoMutateAsync.mockReset()
    toastLoadingMock.mockClear()
    toastDismissMock.mockClear()
    toastSuccessMock.mockClear()
    toastInfoMock.mockClear()
    toastErrorMock.mockClear()
    clearWorkspaceContentMock.mockReset()
    getCurrentResourceIdMock.mockClear()
    navigateToItemMock.mockReset()
    currentResourceIdState.value = null
    executeMutateAsync.mockResolvedValue(createReceipt())
  })

  it('sends a UUIDv7 operation id for forward commands', async () => {
    render(
      <TestLiveFileSystemHost>
        <CreateButton />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalled())
    const operationId = executeMutateAsync.mock.calls[0]?.[0].operationId
    expect(isUuidV7(operationId)).toBe(true)
  })

  it('inserts the optimistic item while create is pending', async () => {
    let resolveCreate: (receipt: ResourceTransactionReceipt) => void = () => {}
    executeMutateAsync.mockReturnValueOnce(
      new Promise<ResourceTransactionReceipt>((resolve) => {
        resolveCreate = resolve
      }),
    )
    render(
      <TestLiveFileSystemHost>
        <CreateButton />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(sidebarItems).toHaveLength(1))
    const optimisticItem = sidebarItems[0]
    const submittedCommand = executeMutateAsync.mock.calls[0]?.[0].command
    expect(isUuidV7(optimisticItem.id)).toBe(true)
    expect(optimisticItem.id).toBe(submittedCommand.resourceId)
    expect(toastLoadingMock).toHaveBeenCalledWith('Creating item...')

    act(() => resolveCreate(createReceipt()))

    await waitFor(() => expect(toastDismissMock).toHaveBeenCalledWith('toast-id'))
  })

  it('rejects malformed mutation receipts before committing optimistic changes', async () => {
    executeMutateAsync.mockResolvedValueOnce({ status: 'completed' })
    render(
      <TestLiveFileSystemHost>
        <CreateButton />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(sidebarItems).toHaveLength(0))
    expect(toastErrorMock).toHaveBeenCalledWith('Filesystem operation failed')
    expect(toastSuccessMock).not.toHaveBeenCalled()
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
      <TestLiveFileSystemHost>
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getRenderedHistoryState()).toMatchObject({ canUndo: true }))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(undoMutateAsync).toHaveBeenCalledWith({ transactionId: TRANSACTION_1 }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() =>
      expect(redoMutateAsync).toHaveBeenCalledWith({ transactionId: TRANSACTION_1 }),
    )
  })

  it('keeps undo state stable while pending and applies the server receipt when it resolves', async () => {
    const item = createNote({ id: 'rename_item' as ResourceId, name: 'Old Name' })
    sidebarItems = [item]
    let resolveUndo: (receipt: ResourceTransactionReceipt) => void = () => {}
    executeMutateAsync.mockResolvedValueOnce(createRenameReceipt())
    undoMutateAsync.mockReturnValueOnce(
      new Promise<ResourceTransactionReceipt>((resolve) => {
        resolveUndo = resolve
      }),
    )
    render(
      <TestLiveFileSystemHost>
        <RenameButton itemId={item.id} />
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(sidebarItems[0]?.name).toBe('New Name'))

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
    const item = createNote({ id: 'rename_item' as ResourceId, name: 'Old Name' })
    sidebarItems = [item]
    executeMutateAsync.mockResolvedValueOnce(createRenameReceipt())
    undoMutateAsync
      .mockRejectedValueOnce(new Error('undo failed'))
      .mockResolvedValueOnce(
        createRenameReceipt({ direction: 'undo', before: 'New Name', after: 'Old Name' }),
      )
    render(
      <TestLiveFileSystemHost>
        <RenameButton itemId={item.id} />
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(sidebarItems[0]?.name).toBe('New Name'))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(sidebarItems[0]?.name).toBe('New Name')
    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    expect(toastDismissMock).toHaveBeenCalledWith('toast-id')

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(2))
  })

  it('clears the editor when undo hides the currently viewed created item', async () => {
    const item = createNote({
      id: 'item_1' as ResourceId,
      name: 'Scene',
      status: TEST_RESOURCE_STATUS.active,
    })
    currentResourceIdState.value = item.id
    executeMutateAsync.mockResolvedValueOnce(createReceipt(testOperationId('transaction_create')))
    undoMutateAsync.mockResolvedValueOnce(createUndoCreateReceipt(item))
    render(
      <TestLiveFileSystemHost>
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(getRenderedHistoryState()).toMatchObject({ canUndo: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    expect(getCurrentResourceIdMock.mock.results.map((result) => result.value)).toContain(item.id)
    await waitFor(() => expect(clearWorkspaceContentMock).toHaveBeenCalledTimes(1))
  })

  it('clears editor state when undo hides a copied folder tree', async () => {
    const folder = createFolder({
      id: 'copied_folder' as ResourceId,
      name: 'Copied Folder',
      status: TEST_RESOURCE_STATUS.active,
    })
    const child = createNote({
      id: 'copied_child' as ResourceId,
      name: 'Copied Child',
      parentId: folder.id,
      status: TEST_RESOURCE_STATUS.active,
    })
    sidebarItems = [folder, child]
    undoMutateAsync.mockResolvedValueOnce(createUndoCopiedFolderReceipt({ folder, child }))
    executeMutateAsync.mockResolvedValueOnce(
      createReceipt(testOperationId('transaction_copy_folder')),
    )
    currentResourceIdState.value = child.id

    render(
      <TestLiveFileSystemHost>
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(getRenderedHistoryState()).toMatchObject({ canUndo: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    expect(clearWorkspaceContentMock).toHaveBeenCalledTimes(1)
  })

  it('keeps redo state stable while pending and applies the server receipt when it resolves', async () => {
    const item = createNote({ id: 'rename_item' as ResourceId, name: 'Old Name' })
    sidebarItems = [item]
    executeMutateAsync.mockResolvedValueOnce(createRenameReceipt())
    undoMutateAsync.mockResolvedValueOnce(
      createRenameReceipt({ direction: 'undo', before: 'New Name', after: 'Old Name' }),
    )
    let resolveRedo: (receipt: ResourceTransactionReceipt) => void = () => {}
    redoMutateAsync.mockReturnValueOnce(
      new Promise<ResourceTransactionReceipt>((resolve) => {
        resolveRedo = resolve
      }),
    )
    render(
      <TestLiveFileSystemHost>
        <RenameButton itemId={item.id} />
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(sidebarItems[0]?.name).toBe('New Name'))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(sidebarItems[0]?.name).toBe('Old Name'))

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    await waitFor(() => expect(redoMutateAsync).toHaveBeenCalledTimes(1))
    expect(sidebarItems[0]?.name).toBe('Old Name')
    expect(toastLoadingMock).toHaveBeenCalledWith('Redoing...')

    act(() => resolveRedo(createRenameReceipt({ direction: 'redo' })))

    await waitFor(() => expect(sidebarItems[0]?.name).toBe('New Name'))
    await waitFor(() => expect(toastDismissMock).toHaveBeenCalledWith('toast-id'))
  })

  it('leaves visible state unchanged when redo fails and preserves the redo stack', async () => {
    const item = createNote({ id: 'rename_item' as ResourceId, name: 'Old Name' })
    sidebarItems = [item]
    executeMutateAsync.mockResolvedValueOnce(createRenameReceipt())
    undoMutateAsync.mockResolvedValueOnce(
      createRenameReceipt({ direction: 'undo', before: 'New Name', after: 'Old Name' }),
    )
    redoMutateAsync
      .mockRejectedValueOnce(new Error('redo failed'))
      .mockResolvedValueOnce(createRenameReceipt({ direction: 'redo' }))
    render(
      <TestLiveFileSystemHost>
        <RenameButton itemId={item.id} />
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(sidebarItems[0]?.name).toBe('New Name'))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(sidebarItems[0]?.name).toBe('Old Name'))

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    expect(sidebarItems[0]?.name).toBe('Old Name')
    await waitFor(() => expect(redoMutateAsync).toHaveBeenCalledTimes(1))
    expect(toastDismissMock).toHaveBeenCalledWith('toast-id')

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    await waitFor(() => expect(redoMutateAsync).toHaveBeenCalledTimes(2))
  })

  it('keeps additional undo and redo calls gated while a transaction is pending', async () => {
    const item = createNote({ id: 'rename_item' as ResourceId, name: 'Old Name' })
    sidebarItems = [item]
    executeMutateAsync.mockResolvedValueOnce(createRenameReceipt())
    undoMutateAsync.mockReturnValueOnce(new Promise<ResourceTransactionReceipt>(() => {}))
    render(
      <TestLiveFileSystemHost>
        <RenameButton itemId={item.id} />
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(sidebarItems[0]?.name).toBe('New Name'))
    toastLoadingMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    await waitFor(() => expect(undoMutateAsync).toHaveBeenCalledTimes(1))
    expect(toastLoadingMock).toHaveBeenCalledTimes(1)
  })

  it('keeps original transaction ids through multiple undo and redo operations', async () => {
    executeMutateAsync
      .mockResolvedValueOnce(createReceipt(TRANSACTION_1))
      .mockResolvedValueOnce(createReceipt(TRANSACTION_2))
    undoMutateAsync
      .mockResolvedValueOnce({
        ...createReceipt(TRANSACTION_2),
        direction: 'undo',
      })
      .mockResolvedValueOnce({
        ...createReceipt(TRANSACTION_1),
        direction: 'undo',
      })
    redoMutateAsync
      .mockResolvedValueOnce({
        ...createReceipt(TRANSACTION_1),
        direction: 'redo',
      })
      .mockResolvedValueOnce({
        ...createReceipt(TRANSACTION_2),
        direction: 'redo',
      })
    render(
      <TestLiveFileSystemHost>
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getRenderedHistoryState()).toMatchObject({ canUndo: true }))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(undoMutateAsync).toHaveBeenNthCalledWith(1, { transactionId: TRANSACTION_2 }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(undoMutateAsync).toHaveBeenNthCalledWith(2, { transactionId: TRANSACTION_1 }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() =>
      expect(redoMutateAsync).toHaveBeenNthCalledWith(1, { transactionId: TRANSACTION_1 }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() =>
      expect(redoMutateAsync).toHaveBeenNthCalledWith(2, { transactionId: TRANSACTION_2 }),
    )
  })

  it('runs redo through the latest transaction after undo', async () => {
    const staleItem = createNote({ id: 'stale_item' as ResourceId, name: 'Stale' })
    sidebarItems = [staleItem]
    executeMutateAsync.mockResolvedValueOnce(createReceipt())
    undoMutateAsync.mockResolvedValueOnce({ ...createReceipt(), direction: 'undo' })
    redoMutateAsync.mockResolvedValueOnce({ ...createReceipt(), direction: 'redo' })

    render(
      <TestLiveFileSystemHost>
        <FileSystemButtons />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(getRenderedHistoryState()).toMatchObject({ canUndo: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(getRenderedHistoryState()).toMatchObject({ canRedo: true }))
    navigateToItemMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))

    await waitFor(() =>
      expect(redoMutateAsync).toHaveBeenCalledWith({ transactionId: TRANSACTION_1 }),
    )
  })

  it('moves a cut item into a duplicate-title destination without prompting', async () => {
    const source = createNote({
      id: 'cut_source' as ResourceId,
      name: 'Shared Name',
      parentId: null,
    })
    const target = createFolder({
      id: 'target_folder' as ResourceId,
      name: 'Target Folder',
    })
    const conflictingChild = createNote({
      id: 'existing_child' as ResourceId,
      name: 'Shared Name',
      parentId: target.id,
    })
    sidebarItems = [source, target, conflictingChild]
    render(
      <TestLiveFileSystemHost>
        <ClipboardButtons itemId={source.id} targetParentId={target.id} />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cut' }))
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    expect(executeMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        command: {
          type: 'move',
          itemIds: [source.id],
          targetParentId: target.id,
        },
      }),
    )
  })

  it('runs a duplicate-title drop directly', async () => {
    const sourceParent = createFolder({
      id: 'source_parent' as ResourceId,
      name: 'Source Folder',
    })
    const target = createFolder({
      id: 'target_folder' as ResourceId,
      name: 'Target Folder',
    })
    const source = createNote({
      id: 'drop_source' as ResourceId,
      name: 'Shared Name',
      parentId: sourceParent.id,
    })
    const conflictingChild = createNote({
      id: 'drop_existing_child' as ResourceId,
      name: 'Shared Name',
      parentId: target.id,
    })
    sidebarItems = [sourceParent, target, source, conflictingChild]
    render(
      <TestLiveFileSystemHost>
        <DropButton
          command={{
            type: 'copy',
            itemIds: [source.id],
            targetParentId: target.id,
          }}
        />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Drop' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    expect(executeMutateAsync).toHaveBeenCalledWith(expect.objectContaining({}))
  })

  it('clears editor state from delete receipt snapshots', async () => {
    const item = createNote({
      id: 'trash_item' as ResourceId,
      name: 'Trash Item',
      status: TEST_RESOURCE_STATUS.trashed,
    })
    trashItems = [item]
    executeMutateAsync.mockResolvedValueOnce(createDeleteForeverReceipt(item))
    currentResourceIdState.value = item.id

    render(
      <TestLiveFileSystemHost>
        <EmptyTrashButton />
      </TestLiveFileSystemHost>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }))
    await screen.findByRole('dialog', { name: 'Empty Trash' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Empty Trash' }).at(-1)!)

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(1))
    expect(clearWorkspaceContentMock).toHaveBeenCalled()
  })

  it('generates a fresh operation id for each forward command', async () => {
    render(
      <TestLiveFileSystemHost>
        <CreateButton />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(executeMutateAsync).toHaveBeenCalledTimes(2))
    const firstOperationId = executeMutateAsync.mock.calls[0]?.[0].operationId
    const secondOperationId = executeMutateAsync.mock.calls[1]?.[0].operationId
    expect(isUuidV7(firstOperationId)).toBe(true)
    expect(isUuidV7(secondOperationId)).toBe(true)
    expect(firstOperationId).not.toBe(secondOperationId)
  })

  it('routes bookmark toggles through the filesystem command executor', async () => {
    const first = createNote({ id: 'bookmark_1' as ResourceId, name: 'First' })
    const second = createNote({ id: 'bookmark_2' as ResourceId, name: 'Second' })
    sidebarItems = [first, second]
    render(
      <TestLiveFileSystemHost>
        <ToggleBookmarksButton itemIds={[first.id, second.id]} />
      </TestLiveFileSystemHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Bookmarks' }))

    await waitFor(() =>
      expect(executeMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            type: 'toggleBookmarks',
            itemIds: [first.id, second.id],
          },
        }),
      ),
    )
  })
})
