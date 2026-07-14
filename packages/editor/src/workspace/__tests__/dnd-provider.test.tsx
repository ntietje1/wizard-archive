import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ComponentProps, ReactElement } from 'react'
import { toast } from 'sonner'
import { DEFAULT_SORT_OPTIONS } from '../items-persistence-contract'
import { WorkspaceRuntimeDndProvider } from '../dnd-provider'
import type { DndRuntimeProvider } from '../../drag-drop/runtime-provider'
import type { FileSystemItemDragDropOperations } from '../../filesystem/item-operation-contracts'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'
import { createFolder, createGameMap, createNote } from '../../test/sidebar-item-factory'
import type { WorkspaceNavigation } from '../runtime'
import type { SidebarWorkspaceState } from '../sidebar/workspace-state'
import { SidebarWorkspaceStateProvider } from '../sidebar/workspace-state'
import { createWorkspaceResource } from '../runtime'
import { testId } from '../../test/id'

type DndRuntimeProviderProps = ComponentProps<typeof DndRuntimeProvider>

const runtimeProviderState = vi.hoisted(() => ({
  props: null as DndRuntimeProviderProps | null,
}))

vi.mock('../../drag-drop/runtime-provider', () => ({
  DndRuntimeProvider: (props: DndRuntimeProviderProps) => {
    runtimeProviderState.props = props
    return <div data-testid="dnd-runtime-provider">{props.children}</div>
  },
}))

vi.mock('sonner', () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
  },
}))

describe('WorkspaceRuntimeDndProvider', () => {
  beforeEach(() => {
    runtimeProviderState.props = null
    vi.mocked(toast.dismiss).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.loading).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  it('supplies runtime-backed DnD data with explicit disabled external file drops', async () => {
    const openItem = vi.fn()
    const executeDropCommand = vi.fn()
    const runtime = createRuntime({ executeDropCommand, openItem })

    renderWithSidebar(
      <WorkspaceRuntimeDndProvider runtime={runtime} workspaceName="Test workspace">
        <span>child</span>
      </WorkspaceRuntimeDndProvider>,
    )

    const props = runtimeProviderState.props
    expect(props).toMatchObject({
      dropPlanningContext: {
        workspaceId: null,
        workspaceName: 'Test workspace',
        canCreateRootItems: true,
        canManageFolders: true,
      },
      externalFiles: { status: 'disabled', handleDropFiles: expect.any(Function) },
    })
    await expect(
      props?.externalFiles.handleDropFiles({ files: [], rootFolders: [] }),
    ).resolves.toEqual({
      status: 'unsupported',
      reason: 'external_file_drops_disabled',
    })
    const noteId = testId<'sidebarItems'>('note_market')
    const childNoteId = testId<'sidebarItems'>('note_clues')
    const canvasId = testId<'sidebarItems'>('canvas_heist')

    expect(props?.catalog.getKnownItemById(noteId)).toBe(
      runtime.filesystem.catalog.getKnownItemById(noteId),
    )
    expect(props?.catalog.getVisibleAncestors(childNoteId)).toEqual(
      runtime.filesystem.catalog.getVisibleAncestors(childNoteId),
    )

    await props?.dndContext.openItem(runtime.filesystem.catalog.getKnownItemById(canvasId)!)
    expect(openItem).toHaveBeenCalledWith(createWorkspaceResource(canvasId))

    executeDropCommand.mockResolvedValueOnce({ status: 'rejected', reason: 'stale-history' })

    await expect(
      props?.dndContext.executeFileSystemCommand({
        type: 'trash',
        itemIds: [noteId],
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'stale-history' })
    expect(executeDropCommand).toHaveBeenCalledWith({
      type: 'trash',
      itemIds: [noteId],
    })
  })

  it('passes explicit external file-drop capabilities through to the DnD runtime', () => {
    renderWithSidebar(
      <WorkspaceRuntimeDndProvider
        externalFiles={{ status: 'enabled' }}
        runtime={createRuntime({ executeDropCommand: vi.fn(), openItem: vi.fn() })}
        workspaceName="Test workspace"
      >
        <span>child</span>
      </WorkspaceRuntimeDndProvider>,
    )

    expect(runtimeProviderState.props?.externalFiles.status).toBe('enabled')
    expect(runtimeProviderState.props?.externalFiles).toEqual({
      status: 'enabled',
      handleDropFiles: expect.any(Function),
    })
  })

  it('disables external file drops when create permission is unavailable', async () => {
    renderWithSidebar(
      <WorkspaceRuntimeDndProvider
        externalFiles={{ status: 'enabled' }}
        runtime={createRuntime({
          canCreateItems: false,
          executeDropCommand: vi.fn(),
          openItem: vi.fn(),
        })}
        workspaceName="Test workspace"
      >
        <span>child</span>
      </WorkspaceRuntimeDndProvider>,
    )

    expect(runtimeProviderState.props?.externalFiles.status).toBe('disabled')
    await expect(
      runtimeProviderState.props?.externalFiles.handleDropFiles({ files: [], rootFolders: [] }),
    ).resolves.toEqual({
      status: 'unsupported',
      reason: 'external_file_drops_disabled',
    })
  })

  it('reveals external file-drop results through sidebar workspace state when available', async () => {
    const importFile = vi.fn().mockResolvedValue({
      status: 'imported',
      kind: 'note',
      fileName: 'notes.txt',
      result: {
        id: testId<'sidebarItems'>('note_clues'),
        slug: 'note-clues',
      },
    })
    const openItem = vi.fn()
    const setFolderState = vi.fn()
    const runtime = createRuntime({
      executeDropCommand: vi.fn(),
      importFile,
      openItem,
    })

    render(
      <SidebarWorkspaceStateProvider value={createSidebarWorkspaceState({ setFolderState })}>
        <WorkspaceRuntimeDndProvider
          externalFiles={{ status: 'enabled' }}
          runtime={runtime}
          workspaceName="Test workspace"
        >
          <span>child</span>
        </WorkspaceRuntimeDndProvider>
      </SidebarWorkspaceStateProvider>,
    )

    const externalFiles = runtimeProviderState.props?.externalFiles
    expect(externalFiles?.status).toBe('enabled')

    if (externalFiles?.status === 'enabled') {
      await expect(
        externalFiles.handleDropFiles({
          files: [{ file: new File(['hello'], 'notes.txt'), relativePath: 'notes.txt' }],
          rootFolders: [],
        }),
      ).resolves.toEqual({
        status: 'completed',
        receipt: {
          id: 'note_clues',
          slug: 'note-clues',
        },
      })
    }

    expect(importFile).toHaveBeenCalled()
    expect(setFolderState).toHaveBeenCalledWith('folder_clues', true)
    expect(openItem).toHaveBeenCalledWith(
      createWorkspaceResource(testId<'sidebarItems'>('note_clues')),
      {
        replace: true,
      },
    )
  })
})

function renderWithSidebar(ui: ReactElement) {
  return render(
    <SidebarWorkspaceStateProvider
      value={createSidebarWorkspaceState({
        setFolderState: vi.fn(),
      })}
    >
      {ui}
    </SidebarWorkspaceStateProvider>,
  )
}

type WorkspaceRuntimeDndProviderRuntime = ComponentProps<
  typeof WorkspaceRuntimeDndProvider
>['runtime']

function createRuntime({
  canCreateItems = true,
  executeDropCommand,
  importFile,
  openItem,
}: {
  canCreateItems?: boolean
  executeDropCommand: FileSystemItemDragDropOperations['executeDropCommand']
  importFile?: FileSystemItemDragDropOperations['importFile']
  openItem: WorkspaceNavigation['openItem']
}): WorkspaceRuntimeDndProviderRuntime {
  const folder = createFolder({
    id: testId<'sidebarItems'>('folder_clues'),
    name: 'Clues',
  })
  const note = createNote({
    id: testId<'sidebarItems'>('note_market'),
    name: 'The Lantern Market',
  })
  const childNote = createNote({
    id: testId<'sidebarItems'>('note_clues'),
    name: 'Clue Board',
    parentId: folder.id,
  })
  const canvas = createGameMap({
    id: testId<'sidebarItems'>('canvas_heist'),
    name: 'Harbor Heist Board',
  })
  const operations = {
    executeDropCommand,
    ...(importFile ? { importFile } : {}),
  }

  const runtime = createTestWorkspaceRuntime({
    activeItems: [folder, note, childNote, canvas],
    canCreateItems,
    canEmptyTrash: true,
    canManageFolders: true,
    operations,
    item: note,
  })

  const { filesystem } = runtime

  return {
    filesystem: {
      catalog: {
        getKnownItemById: filesystem.catalog.getKnownItemById,
        getVisibleAncestors: filesystem.catalog.getVisibleAncestors,
        getVisibleRoots: filesystem.catalog.getVisibleRoots,
      },
      load: filesystem.load,
      operationItems: filesystem.operationItems,
      operations: filesystem.operations,
      paths: filesystem.paths,
      permissions: filesystem.permissions,
    },
    navigation: {
      openItem,
    },
  }
}

function createSidebarWorkspaceState({
  setFolderState,
}: {
  setFolderState: SidebarWorkspaceState['uiCommands']['setFolderState']
}): SidebarWorkspaceState {
  return {
    ui: {
      bookmarksOnlyMode: false,
      closeAllFoldersMode: false,
      folderStates: {},
    },
    uiCommands: {
      setFolderState,
      toggleFolderState: vi.fn(),
      clearAllFolderStates: vi.fn(),
      toggleCloseAllFoldersMode: vi.fn(),
      exitCloseAllMode: vi.fn(),
      toggleBookmarksOnlyMode: vi.fn(),
    },
    sort: {
      options: DEFAULT_SORT_OPTIONS,
      setOptions: vi.fn(),
    },
    editing: {
      renamingItemId: null,
      setRenamingItemId: vi.fn(),
    },
    selection: {
      activeItemSurface: null,
      focusedItemId: null,
      selectedItemIds: [],
    },
    selectionCommands: {
      setSelectedItemIds: vi.fn(),
      selectSingleItem: vi.fn(),
      toggleItemSelection: vi.fn(),
      selectItemRange: vi.fn(),
      setFocusedItem: vi.fn(),
      moveFocus: vi.fn(),
      clearItemSelection: vi.fn(),
      normalizeContextSelection: vi.fn(),
      setActiveItemSurface: vi.fn(),
      clearSelectionForWorkspaceChange: vi.fn(),
      getSelectionSnapshot: vi.fn(() => ({
        activeItemSurface: null,
        anchorItemId: null,
        focusedItemId: null,
        selectedItemIds: [],
      })),
    },
  }
}
