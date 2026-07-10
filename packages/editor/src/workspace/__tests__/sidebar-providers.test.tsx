import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { VIEW_CONTEXT } from '../view-context'
import type { ViewContext } from '../menu-context'
import { useWorkspaceContextMenuModelSource } from '../context-menu-model-source'
import { WorkspaceContextMenu } from '../context-menu/context-menu'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { FileSystemOperations } from '../../filesystem/operations'
import type { FileSystemDownload } from '../../filesystem/download'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { RESOURCE_STATUS } from '../items-persistence-contract'
import type { WorkspaceRuntime } from '../runtime'
import { useWorkspaceRuntime, WorkspaceRuntimeProvider } from '../runtime-context'
import {
  useRuntimeSidebarWorkspaceState,
  useSidebarWorkspaceState,
} from '../sidebar/workspace-state'
import { WorkspaceRuntimeSidebarProviders } from '../sidebar-providers'
import { useWorkspaceSidebarReveal } from '../sidebar/use-reveal'
import { createSidebarWorkspaceStateHarness } from '../sidebar/__tests__/test-helpers'

describe('WorkspaceRuntimeSidebarProviders', () => {
  beforeEach(() => {
    createSidebarWorkspaceStateHarness({ workspaceId: 'test-workspace' }).unmount()
  })

  it('supplies the shared workspace context menu with a runtime-backed model source', () => {
    render(<ProviderHarness />)

    expect(screen.getByRole('button', { name: 'Context target' })).toBeInTheDocument()
  })

  it('exposes full runtime context menu contributors through the shared provider', async () => {
    render(
      <ProviderHarness
        canCreateItems={true}
        download={{
          status: 'available',
          loadItemsForDownload: () =>
            Promise.resolve({
              status: 'completed',
              receipt: { kind: 'downloadPrepared', affectedCount: 0 },
              items: [],
              skippedItems: [],
            }),
          loadRootItemsForDownload: () =>
            Promise.resolve({
              status: 'completed',
              receipt: { kind: 'downloadPrepared', affectedCount: 0 },
              items: [],
              skippedItems: [],
            }),
        }}
      >
        <ContextMenuCommandProbe
          clickedItemId={'folder_1' as SidebarItemId}
          commandItemId="create-new-submenu"
          selectedItemIds={['folder_1' as SidebarItemId]}
          viewContext={VIEW_CONTEXT.SIDEBAR}
        />
      </ProviderHarness>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('context-menu-item-ids')).toHaveTextContent('create-new-submenu'),
    )
    expect(screen.getByTestId('context-menu-item-ids')).toHaveTextContent('download-items')
  })

  it.each([
    ['sidebar', VIEW_CONTEXT.SIDEBAR],
    ['folder-view', VIEW_CONTEXT.FOLDER_VIEW],
  ] as const)(
    'targets %s multi-selection through context-menu composition',
    async (_name, viewContext) => {
      const executeDropCommand = vi.fn()
      render(
        <ProviderHarness canCreateItems={true} executeDropCommand={executeDropCommand}>
          <ContextMenuCommandProbe
            clickedItemId={'note_2' as SidebarItemId}
            commandItemId="duplicate"
            selectedItemIds={['note_1' as SidebarItemId, 'note_2' as SidebarItemId]}
            viewContext={viewContext}
          />
        </ProviderHarness>,
      )

      await waitFor(() =>
        expect(screen.getByTestId('context-menu-item-ids')).toHaveTextContent('duplicate'),
      )

      screen.getByTestId('run-context-command').click()

      await waitFor(() => expect(executeDropCommand).toHaveBeenCalledTimes(2))
      expect(executeDropCommand.mock.calls.map(([command]) => command)).toEqual([
        { type: 'copy', itemIds: ['note_1'], targetParentId: null },
        { type: 'copy', itemIds: ['note_2'], targetParentId: 'folder_1' },
      ])
    },
  )

  it('hides root Duplicate when the actor cannot create root items', async () => {
    render(
      <ProviderHarness canCreateItems={false}>
        <ContextMenuCommandProbe
          clickedItemId={'note_1' as SidebarItemId}
          commandItemId="duplicate"
          selectedItemIds={['note_1' as SidebarItemId]}
          viewContext={VIEW_CONTEXT.SIDEBAR}
        />
      </ProviderHarness>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('context-menu-item-ids')).not.toHaveTextContent('duplicate'),
    )
  })

  it('reveals visible non-sidebar items through the shared context menu', async () => {
    render(
      <ProviderHarness>
        <ContextMenuCommandProbe
          clickedItemId={'note_2' as SidebarItemId}
          commandItemId="show-in-sidebar"
          selectedItemIds={['note_2' as SidebarItemId]}
          viewContext={VIEW_CONTEXT.FOLDER_VIEW}
        />
        <SidebarRevealCommandProbe itemId={'note_2' as SidebarItemId} />
      </ProviderHarness>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('context-menu-item-ids')).toHaveTextContent('show-in-sidebar'),
    )

    act(() => {
      screen.getByTestId('run-context-command').click()
    })

    await waitFor(() => expect(screen.getByTestId('folder-states')).toHaveTextContent('folder_1'))
  })

  it('targets trash-view multi-selection through context-menu composition', async () => {
    const restoreItems = vi.fn()
    render(
      <ProviderHarness canCreateItems={true} restoreItems={restoreItems}>
        <ContextMenuCommandProbe
          clickedItemId={'trash_2' as SidebarItemId}
          commandItemId="restore"
          selectedItemIds={['trash_1' as SidebarItemId, 'trash_2' as SidebarItemId]}
          viewContext={VIEW_CONTEXT.TRASH_VIEW}
        />
      </ProviderHarness>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('context-menu-item-ids')).toHaveTextContent('restore'),
    )

    screen.getByTestId('run-context-command').click()

    await waitFor(() =>
      expect(restoreItems).toHaveBeenCalledExactlyOnceWith(['trash_1', 'trash_2'], null),
    )
  })

  it('routes folder trash requests through the runtime filesystem operation model', async () => {
    const trashItems = vi.fn()
    render(
      <ProviderHarness trashItems={trashItems}>
        <ContextMenuCommandProbe
          clickedItemId={'folder_1' as SidebarItemId}
          commandItemId="delete"
          selectedItemIds={['folder_1' as SidebarItemId]}
          viewContext={VIEW_CONTEXT.SIDEBAR}
        />
      </ProviderHarness>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('context-menu-item-ids')).toHaveTextContent('delete'),
    )

    screen.getByTestId('run-context-command').click()

    await waitFor(() => expect(trashItems).toHaveBeenCalledExactlyOnceWith(['folder_1']))
  })

  it('reveals nested items through the workspace sidebar reveal command', async () => {
    render(
      <ProviderHarness>
        <SidebarRevealCommandProbe itemId={'note_2' as SidebarItemId} />
      </ProviderHarness>,
    )

    screen.getByRole('button', { name: 'Reveal nested item' }).click()

    await waitFor(() => expect(screen.getByTestId('folder-states')).toHaveTextContent('folder_1'))
  })

  it('reveals the current runtime item parents when the editor mounts', async () => {
    render(
      <ProviderHarness currentItemId={'note_2' as SidebarItemId}>
        <SidebarFolderStateProbe />
      </ProviderHarness>,
    )

    await waitFor(() => expect(screen.getByTestId('folder-states')).toHaveTextContent('folder_1'))
  })

  it('keeps mounted editor consumers on runtime-owned selection while context menus use sidebar selection', async () => {
    const executeDropCommand = vi.fn()
    render(
      <ProviderHarness canCreateItems={true} executeDropCommand={executeDropCommand}>
        <ContextMenuCommandProbe
          clickedItemId={'note_2' as SidebarItemId}
          commandItemId="duplicate"
          selectedItemIds={['note_1' as SidebarItemId, 'note_2' as SidebarItemId]}
          viewContext={VIEW_CONTEXT.SIDEBAR}
        />
        <MountedSelectionProbe />
      </ProviderHarness>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('context-menu-item-ids')).toHaveTextContent('duplicate'),
    )
    expect(screen.getByTestId('runtime-identity')).toHaveTextContent('same')
    expect(screen.getByTestId('mounted-selection')).toHaveTextContent('note_1')

    screen.getByTestId('run-context-command').click()

    await waitFor(() => expect(executeDropCommand).toHaveBeenCalledTimes(2))
    expect(executeDropCommand.mock.calls.map(([command]) => command.itemIds)).toEqual([
      ['note_1'],
      ['note_2'],
    ])
  })
})

function ProviderHarness({
  canCreateItems,
  children,
  currentItemId = 'note_1' as SidebarItemId,
  download,
  executeDropCommand = vi.fn(),
  restoreItems = vi.fn(),
  trashItems = vi.fn(),
}: {
  canCreateItems?: boolean
  children?: ReactNode
  currentItemId?: SidebarItemId
  download?: FileSystemDownload
  executeDropCommand?: FileSystemOperations['executeDropCommand']
  restoreItems?: FileSystemOperations['restoreItems']
  trashItems?: FileSystemOperations['trashItems']
}) {
  const runtimeRef = useRef<WorkspaceRuntime | null>(null)
  runtimeRef.current ??= createRuntime({
    canCreateItems,
    download,
    currentItemId,
    executeDropCommand,
    restoreItems,
    trashItems,
  })
  const runtime = runtimeRef.current
  const item = runtime.filesystem.catalog.getKnownItemById('note_1' as SidebarItemId)
  const sidebarWorkspaceState = useRuntimeSidebarWorkspaceState(runtime)

  if (!item) throw new Error('Expected note_1 to exist in the test runtime catalog')

  return (
    <WorkspaceRuntimeSidebarProviders
      runtime={runtime}
      sidebarWorkspaceState={sidebarWorkspaceState}
    >
      {(sidebarRuntime) => (
        <WorkspaceRuntimeProvider value={sidebarRuntime}>
          <span data-testid="runtime-identity">
            {Object.is(sidebarRuntime, runtime) ? 'same' : 'different'}
          </span>
          <WorkspaceContextMenu viewContext="sidebar" item={item}>
            <button type="button">Context target</button>
          </WorkspaceContextMenu>
          {children}
        </WorkspaceRuntimeProvider>
      )}
    </WorkspaceRuntimeSidebarProviders>
  )
}

function SidebarRevealCommandProbe({ itemId }: { itemId: SidebarItemId }) {
  const showItemInSidebar = useWorkspaceSidebarReveal()

  return (
    <>
      <SidebarFolderStateProbe />
      <button
        type="button"
        onClick={() => {
          showItemInSidebar(itemId)
        }}
      >
        Reveal nested item
      </button>
    </>
  )
}

function SidebarFolderStateProbe() {
  const source = useSidebarWorkspaceState()

  return (
    <output data-testid="folder-states">{Object.keys(source.ui.folderStates).join(',')}</output>
  )
}

function MountedSelectionProbe() {
  const runtime = useWorkspaceRuntime()
  useSidebarWorkspaceState()

  return (
    <span data-testid="mounted-selection">
      {runtime.filesystem.selection.selectedItemIds.join(',')}
    </span>
  )
}

function ContextMenuCommandProbe({
  clickedItemId,
  commandItemId,
  selectedItemIds,
  viewContext,
}: {
  clickedItemId: SidebarItemId
  commandItemId: string
  selectedItemIds: Array<SidebarItemId>
  viewContext: ViewContext
}) {
  const source = useSidebarWorkspaceState()
  const runtime = useWorkspaceRuntime()
  const ModelSource = useWorkspaceContextMenuModelSource()
  const clickedItem = runtime.filesystem.catalog.getKnownItemById(clickedItemId)
  const selectionCommandsRef = useRef(source.selectionCommands)
  selectionCommandsRef.current = source.selectionCommands

  useEffect(() => {
    const surface =
      viewContext === VIEW_CONTEXT.FOLDER_VIEW
        ? 'folder-view'
        : viewContext === VIEW_CONTEXT.TRASH_VIEW
          ? 'trash'
          : 'sidebar'
    selectionCommandsRef.current.setActiveItemSurface({
      surface,
      parentId: null,
      visibleItemIds: selectedItemIds,
    })
    selectionCommandsRef.current.setSelectedItemIds(selectedItemIds)
  }, [selectedItemIds, viewContext])

  if (!clickedItem) {
    return null
  }

  return (
    <ModelSource options={{ item: clickedItem, viewContext }}>
      {(model) => {
        const commandItem = model.surfaceModel.menu.flatItems.find(
          (item) => item.id === commandItemId,
        )
        return (
          <>
            <output data-testid="context-menu-item-ids">
              {model.surfaceModel.menu.flatItems.map((item) => item.id).join(',')}
            </output>
            <button
              type="button"
              data-testid="run-context-command"
              onClick={() => {
                void commandItem?.onSelect()
              }}
            >
              Run context command
            </button>
          </>
        )
      }}
    </ModelSource>
  )
}

function createRuntime({
  canCreateItems,
  currentItemId,
  download,
  executeDropCommand,
  restoreItems,
  trashItems,
}: {
  canCreateItems?: boolean
  currentItemId?: SidebarItemId
  download?: FileSystemDownload
  executeDropCommand?: FileSystemOperations['executeDropCommand']
  restoreItems?: FileSystemOperations['restoreItems']
  trashItems?: FileSystemOperations['trashItems']
}): WorkspaceRuntime {
  const note = createNote({ id: 'note_1' as SidebarItemId })
  const folder = createFolder({ id: 'folder_1' as SidebarItemId })
  const secondNote = createNote({
    id: 'note_2' as SidebarItemId,
    parentId: folder.id,
  })
  const trashedNote = createNote({
    id: 'trash_1' as SidebarItemId,
    status: RESOURCE_STATUS.trashed,
  })
  const secondTrashedNote = createNote({
    id: 'trash_2' as SidebarItemId,
    status: RESOURCE_STATUS.trashed,
  })
  const currentItem = currentItemId === secondNote.id ? secondNote : note

  return createTestWorkspaceRuntime({
    activeItems: [note, folder, secondNote],
    canCreateItems,
    download,
    operations: {
      ...(executeDropCommand ? { executeDropCommand } : {}),
      ...(restoreItems ? { restoreItems } : {}),
      ...(trashItems ? { trashItems } : {}),
    },
    item: currentItem,
    trashItems: [trashedNote, secondTrashedNote],
  })
}
