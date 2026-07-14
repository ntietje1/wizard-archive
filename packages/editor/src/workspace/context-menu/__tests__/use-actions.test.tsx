import { testResourceId } from '../../../../../../shared/test/resource-id'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { useWorkspaceContextMenuActions } from '../use-actions'
import { createWorkspaceResource } from '../../runtime'
import { createWorkspaceFilesystemContextMenuTarget } from '../filesystem-target'
import type { FileSystemItemContextMenuOperations } from '../../../filesystem/item-operation-contracts'
import type { ResourceShareSource } from '../../../sharing/contracts'
type AvailableResourceShareSource = Extract<ResourceShareSource, { status: 'available' }>

const createDownloadActionsMock = vi.hoisted(() =>
  vi.fn((options: unknown) => ({
    downloadItems: vi.fn(),
    downloadAll: vi.fn(),
    options,
  })),
)
const downloadDataSource = vi.hoisted(() => ({
  status: 'available' as const,
  loadItemsForDownload: vi.fn(),
  loadRootItemsForDownload: vi.fn(),
}))
const setDefaultPermissionMock = vi.hoisted(() =>
  vi.fn<AvailableResourceShareSource['setDefaultPermission']>(),
)
const renderItemsShareStateMock = vi.hoisted(() => vi.fn())
const toggleBookmarksMock = vi.hoisted(() =>
  vi.fn<FileSystemItemContextMenuOperations['toggleBookmarks']>(),
)
const openItemMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())
const toastInfoMock = vi.hoisted(() => vi.fn())

vi.mock('../../sidebar/workspace-state', () => ({
  useSidebarWorkspaceState: () => ({
    uiCommands: {
      setFolderState: vi.fn(),
    },
    editing: {
      setRenamingItemId: vi.fn(),
    },
  }),
}))

vi.mock('../actions/download-actions', () => ({
  createDownloadActions: (options: unknown) => createDownloadActionsMock(options),
}))

vi.mock('../actions/creation-actions', () => ({
  createCreationActions: () => ({
    createNote: vi.fn(),
    createFolder: vi.fn(),
    createMap: vi.fn(),
    createFile: vi.fn(),
    createCanvas: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    info: toastInfoMock,
  },
}))

describe('useWorkspaceContextMenuActions', () => {
  let runtime: ReturnType<typeof createTestWorkspaceRuntime>

  beforeEach(() => {
    createDownloadActionsMock.mockClear()
    renderItemsShareStateMock.mockReset()
    setDefaultPermissionMock.mockReset()
    toggleBookmarksMock.mockReset()
    openItemMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    toastInfoMock.mockReset()
    runtime = createTestWorkspaceRuntime({
      operations: {
        toggleBookmarks: toggleBookmarksMock,
      },
      sharing: {
        status: 'available',
        renderItemsShareState: renderItemsShareStateMock,
        setDefaultPermission: setDefaultPermissionMock,
        setParticipantPermission: vi.fn(),
      },
      download: downloadDataSource,
    })
    setDefaultPermissionMock.mockResolvedValue({ status: 'completed' })
  })

  it('routes general access changes through filesystem sharing operations', async () => {
    const first = createNote({ id: testResourceId('note_1') })
    const second = createNote({ id: testResourceId('note_2') })
    const { result } = renderContextMenuActions(runtime)

    await result.current.sharing.setGeneralAccessLevel(
      {
        surface: 'sidebar',
        item: first,
        selectedItems: [first, second],
      },
      PERMISSION_LEVEL.VIEW,
    )

    expect(renderItemsShareStateMock).not.toHaveBeenCalled()
    expect(setDefaultPermissionMock).toHaveBeenCalledExactlyOnceWith(
      [first, second],
      PERMISSION_LEVEL.VIEW,
    )
  })

  it('reports failed access changes once with the selected item count', async () => {
    const first = createNote({ id: testResourceId('note_1') })
    const second = createNote({ id: testResourceId('note_2') })
    setDefaultPermissionMock.mockRejectedValue(new Error('Share failed'))
    const { result } = renderContextMenuActions(runtime)

    await result.current.sharing.setGeneralAccessLevel(
      {
        surface: 'sidebar',
        item: first,
        selectedItems: [first, second],
      },
      PERMISSION_LEVEL.VIEW,
    )

    expect(toastErrorMock).toHaveBeenCalledExactlyOnceWith(
      'Failed to update access level for 2 items',
    )
  })

  it('does not report success for non-completed access results', async () => {
    const first = createNote({ id: testResourceId('note_1') })
    setDefaultPermissionMock.mockResolvedValue({ status: 'blocked', reason: 'not_mutable' })
    const { result } = renderContextMenuActions(runtime)

    await result.current.sharing.setGeneralAccessLevel(
      {
        surface: 'sidebar',
        item: first,
        selectedItems: [first],
      },
      PERMISSION_LEVEL.VIEW,
    )

    expect(toastSuccessMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledExactlyOnceWith('Failed to update access level for item')
  })

  it('does not require panel projection state to run access mutations', async () => {
    const first = createNote({ id: testResourceId('note_1') })
    const { result } = renderContextMenuActions(runtime)

    await result.current.sharing.setGeneralAccessLevel(
      {
        surface: 'sidebar',
        item: first,
        selectedItems: [first],
      },
      PERMISSION_LEVEL.VIEW,
    )

    expect(renderItemsShareStateMock).not.toHaveBeenCalled()
    expect(setDefaultPermissionMock).toHaveBeenCalledExactlyOnceWith([first], PERMISSION_LEVEL.VIEW)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('routes bookmark changes through the labeled context item', async () => {
    const first = createNote({ id: testResourceId('note_1') })
    const second = createNote({ id: testResourceId('note_2') })
    const { result } = renderContextMenuActions(runtime)

    await result.current.sidebarItem.toggleBookmark({
      surface: 'sidebar',
      item: first,
      selectedItems: [first, second],
    })

    expect(toggleBookmarksMock).toHaveBeenCalledExactlyOnceWith([first.id])
  })

  it('does not report bookmark success for non-completed command results', async () => {
    const note = createNote({ id: testResourceId('note_1') })
    toggleBookmarksMock.mockResolvedValue({ status: 'error' })
    const { result } = renderContextMenuActions(runtime)

    await result.current.sidebarItem.toggleBookmark({
      surface: 'sidebar',
      item: note,
      selectedItems: [note],
    })

    expect(toastSuccessMock).not.toHaveBeenCalledWith('Bookmark updated')
  })

  it('wires download actions to the workspace runtime download capability', () => {
    renderContextMenuActions(runtime)
    const options = createDownloadActionsMock.mock.calls[0]?.[0] as
      | {
          dataSource: unknown
        }
      | undefined

    expect(options).toEqual({
      dataSource: downloadDataSource,
    })
  })

  it('opens sidebar items through workspace runtime selection', async () => {
    const note = createNote({ id: testResourceId('note_1') })
    runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      item: note,
      navigation: {
        openItem: openItemMock,
      },
    })
    const { result } = renderContextMenuActions(runtime)

    await result.current.sidebarItem.open({
      surface: 'sidebar',
      item: note,
      selectedItems: [note],
    })

    expect(openItemMock).toHaveBeenCalledExactlyOnceWith(createWorkspaceResource(note.id))
  })

  it('opens sidebar items separately through workspace runtime navigation', async () => {
    const note = createNote({ id: testResourceId('note_1') })
    runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      item: note,
      navigation: {
        canOpenItemsSeparately: { status: 'available' },
        openItem: openItemMock,
      },
    })
    const { result } = renderContextMenuActions(runtime)

    await result.current.sidebarItem.openInNewTab({
      surface: 'map-view',
      item: note,
      selectedItems: [note],
    })

    expect(openItemMock).toHaveBeenCalledExactlyOnceWith(createWorkspaceResource(note.id), {
      target: 'separate',
    })
  })
})

function renderContextMenuActions(runtime: ReturnType<typeof createTestWorkspaceRuntime>) {
  return renderHook(() =>
    useWorkspaceContextMenuActions({
      filesystem: createWorkspaceFilesystemContextMenuTarget(runtime.filesystem),
      source: {
        catalog: runtime.filesystem.catalog,
        canOpenItemsSeparately: runtime.navigation.canOpenItemsSeparately,
        createItem: runtime.filesystem.operations.createItem,
        download: runtime.filesystem.download,
        openItem: runtime.navigation.openItem,
        sharing: runtime.filesystem.sharing.items,
        toggleBookmarks: runtime.filesystem.operations.toggleBookmarks,
      },
    }),
  )
}
