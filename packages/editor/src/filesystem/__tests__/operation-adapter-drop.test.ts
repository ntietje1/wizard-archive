import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ResourceCommandRuntimeArgs } from '../operation-runtime-contract'
import type { FileSystemIntentCommand } from '../domain/intent-planning'
import { useWorkspaceResourceCommandRuntime } from '../operation-adapter'
import type { SidebarItemId } from '../../../../../shared/common/ids'

type TestUndoState = {
  undoStack: []
  redoStack: []
  setWorkspace: (workspaceId: string) => void
}

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  handleError: vi.fn(),
  setFolderState: vi.fn(),
  setWorkspace: vi.fn(),
}))

vi.mock('../../errors/handle-error', () => ({
  handleError: mocks.handleError,
}))

vi.mock('../../workspace/sidebar/ui-store', () => ({
  useWorkspaceFileSystemOperationState: () => ({
    activeItemSurface: null,
    selectionCommands: {},
    uiCommands: {
      setFolderState: mocks.setFolderState,
    },
  }),
}))

vi.mock('../cache', () => ({
  createFileSystemCacheAdapter: (cache: unknown) => cache,
}))

vi.mock('../clipboard-operations', () => ({
  useFileSystemClipboardOperations: () => ({
    copy: vi.fn(),
    cut: vi.fn(),
    canUseClipboardOperations: true,
    cancelClipboard: vi.fn(() => false),
    canPaste: vi.fn(() => false),
    paste: vi.fn(() => ({ status: 'unavailable', reason: 'test' })),
  }),
}))

vi.mock('../dialogs', () => ({
  useFileSystemDialogs: () => ({
    dialog: null,
  }),
}))

vi.mock('../executor', () => ({
  useFileSystemExecutor: () => ({
    pendingOperationCount: 0,
    pendingConflict: null,
    clearPendingConflict: vi.fn(),
    resolvePendingConflict: vi.fn(),
    executeCommand: mocks.executeCommand,
    discardCreatedItem: vi.fn(),
    runHistoryCommand: vi.fn(() => ({ status: 'noop', reason: 'test' })),
  }),
}))

vi.mock('../executor-effects', () => ({
  createFileSystemExecutorEffects: () => ({}),
}))

vi.mock('../item-command-operations', () => ({
  createFileSystemItemCommandOperations: () => ({
    createItem: vi.fn(),
    renameItem: vi.fn(),
    toggleBookmarks: vi.fn(),
    deleteForever: vi.fn(),
    emptyTrash: vi.fn(),
    restoreItems: vi.fn(),
    trashItems: vi.fn(),
  }),
  createFileSystemTrashDialogOperations: () => ({
    requestTrashItems: vi.fn(),
    confirmEmptyTrash: vi.fn(),
    confirmDeleteForever: vi.fn(),
  }),
}))

vi.mock('../../sharing/sidebar-items/command-operations', () => ({
  createSidebarItemsShareCommandOperations: () => ({}),
}))

vi.mock('../undo-store', () => ({
  createFileSystemUndoStore: () => {
    const state: TestUndoState = {
      undoStack: [],
      redoStack: [],
      setWorkspace: mocks.setWorkspace,
    }
    const store = ((selector: (state: TestUndoState) => unknown) => selector(state)) as ((
      selector: (state: TestUndoState) => unknown,
    ) => unknown) & { getState: () => typeof state }
    store.getState = () => state
    return store
  },
}))

function sidebarItemId(id: string): SidebarItemId {
  return id as SidebarItemId
}

function createRuntimeArgs(): ResourceCommandRuntimeArgs {
  return {
    workspaceId: 'workspace-1',
    currentUserId: null,
    cache: {} as ResourceCommandRuntimeArgs['cache'],
    navigation: {} as ResourceCommandRuntimeArgs['navigation'],
    trashState: {} as ResourceCommandRuntimeArgs['trashState'],
    executeMutation: vi.fn(),
    undoMutation: vi.fn(),
    redoMutation: vi.fn(),
  }
}

describe('filesystem operation adapter drop execution', () => {
  beforeEach(() => {
    mocks.executeCommand.mockReset()
    mocks.handleError.mockReset()
    mocks.setFolderState.mockReset()
    mocks.setWorkspace.mockReset()
  })

  it('opens the drop destination after a successful command', async () => {
    const folderId = sidebarItemId('folder-1')
    const command: FileSystemIntentCommand = {
      type: 'move',
      itemIds: [sidebarItemId('note-1')],
      targetParentId: folderId,
    }
    mocks.executeCommand.mockResolvedValue({ status: 'completed', receipt: null })

    const { result } = renderHook(() => useWorkspaceResourceCommandRuntime(createRuntimeArgs()))

    await expect(
      result.current.filesystem.dropOperations.executeDropCommand(command),
    ).resolves.toEqual({ status: 'completed', receipt: null })

    expect(mocks.executeCommand).toHaveBeenCalledWith(command, { onSuccess: expect.any(Function) })

    act(() => {
      mocks.executeCommand.mock.calls[0]?.[1]?.onSuccess?.()
    })
    expect(mocks.setFolderState).toHaveBeenCalledWith(folderId, true)
  })

  it('reports command failures at the runtime adapter boundary', async () => {
    const error = new Error('move failed')
    mocks.executeCommand.mockRejectedValue(error)

    const { result } = renderHook(() => useWorkspaceResourceCommandRuntime(createRuntimeArgs()))

    await expect(
      result.current.filesystem.dropOperations.executeDropCommand({
        type: 'move',
        itemIds: [sidebarItemId('note-1')],
        targetParentId: sidebarItemId('folder-1'),
      }),
    ).resolves.toEqual({ status: 'error', error })

    expect(mocks.handleError).toHaveBeenCalledWith(error, 'Failed to move items')
  })
})
