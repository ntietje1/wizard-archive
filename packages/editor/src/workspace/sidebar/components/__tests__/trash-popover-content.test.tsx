import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../../items-persistence-contract'
import type { AnyItem } from '../../../items'
import type { ReactNode } from 'react'
import { TrashPopoverContent } from '../trash-popover-content'
import { SidebarWorkspaceStateProvider } from '../../workspace-state'
import { createNote } from '../../../../test/sidebar-item-factory'
import type { TrashPopoverContentSource } from '../trash-popover-content'
import type { SidebarDragDataSource } from '../../../../drag-drop/sidebar-drag-data'
import { createTestSidebarWorkspaceState } from '../../__tests__/test-helpers'
import type { ResourceCommandResult } from '../../../../filesystem/transaction-contract'

const handleErrorMock = vi.hoisted(() => vi.fn())
const useDraggableCalls = vi.hoisted(
  () =>
    [] as Array<{
      canDrag: boolean
      data: Record<string, unknown>
    }>,
)

vi.mock('../../../../errors/handle-error', () => ({
  handleError: handleErrorMock,
}))

vi.mock('../../../../drag-drop/use-draggable', () => ({
  useDraggable: (options: { canDrag: boolean; data: Record<string, unknown> }) => {
    useDraggableCalls.push(options)
    return { draggableRef: vi.fn(), isDraggingRef: { current: false } }
  },
}))

describe('TrashPopoverContent', () => {
  beforeEach(() => {
    handleErrorMock.mockReset()
    useDraggableCalls.length = 0
  })

  it('uses source selection and filesystem operations for trash actions', async () => {
    const user = userEvent.setup()
    const trashedNote = createNote({
      deletionTime: Date.UTC(2026, 0, 1),
      name: 'Trashed Note',
      slug: 'trashed-note',
      status: RESOURCE_STATUS.trashed,
    })
    const onClose = vi.fn()
    const openTrash = vi.fn()
    const openItem = vi.fn()
    const restoreItems = vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'test' })
    const requestDeleteItemsForever = vi.fn()
    const requestEmptyTrash = vi.fn()
    const source = createTrashSource({
      openItem,
      openTrash,
      requestDeleteItemsForever,
      requestEmptyTrash,
      restoreItems,
      trashItems: [trashedNote],
    })

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={onClose} />
      </TrashPopoverTestProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open full trash view' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(openTrash).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /Trashed Note/ }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(openItem).toHaveBeenCalledWith(trashedNote.id)

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(restoreItems).toHaveBeenCalledWith([trashedNote.id], null)

    await user.click(screen.getByRole('button', { name: 'Delete forever' }))
    expect(requestDeleteItemsForever).toHaveBeenCalledWith([trashedNote.id])

    await user.click(screen.getByRole('button', { name: 'Empty Trash' }))
    expect(requestEmptyTrash).toHaveBeenCalledTimes(1)
  })

  it('keeps trash mutation controls disabled while their operation is pending', async () => {
    const trashedNote = createNote({
      deletionTime: Date.UTC(2026, 0, 1),
      name: 'Trashed Note',
      slug: 'trashed-note',
      status: RESOURCE_STATUS.trashed,
    })
    const restoreDeferred = createDeferred<ResourceCommandResult>()
    const restoreItems = vi.fn(() => restoreDeferred.promise)
    const source = createTrashSource({
      restoreItems,
      trashItems: [trashedNote],
    })

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={vi.fn()} />
      </TrashPopoverTestProvider>,
    )

    const restoreButton = screen.getByRole('button', { name: 'Restore' })
    fireEvent.click(restoreButton)
    fireEvent.click(restoreButton)

    expect(restoreButton).toBeDisabled()
    expect(restoreItems).toHaveBeenCalledTimes(1)

    restoreDeferred.resolve({ status: 'unavailable', reason: 'test' })

    await waitFor(() => expect(restoreButton).toBeEnabled())
  })

  it('serializes conflicting trash mutations for the same item while one operation is pending', async () => {
    const trashedNote = createNote({
      deletionTime: Date.UTC(2026, 0, 1),
      name: 'Trashed Note',
      slug: 'trashed-note',
      status: RESOURCE_STATUS.trashed,
    })
    const restoreDeferred = createDeferred<ResourceCommandResult>()
    const restoreItems = vi.fn(() => restoreDeferred.promise)
    const requestDeleteItemsForever = vi.fn()
    const requestEmptyTrash = vi.fn()
    const source = createTrashSource({
      requestDeleteItemsForever,
      requestEmptyTrash,
      restoreItems,
      trashItems: [trashedNote],
    })

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={vi.fn()} />
      </TrashPopoverTestProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }))
    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }))

    expect(restoreItems).toHaveBeenCalledTimes(1)
    expect(requestDeleteItemsForever).not.toHaveBeenCalled()
    expect(requestEmptyTrash).not.toHaveBeenCalled()

    restoreDeferred.resolve({ status: 'unavailable', reason: 'test' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled())
  })

  it('blocks item trash mutations while empty trash is pending', async () => {
    const trashedNote = createNote({
      deletionTime: Date.UTC(2026, 0, 1),
      name: 'Trashed Note',
      slug: 'trashed-note',
      status: RESOURCE_STATUS.trashed,
    })
    const emptyTrashDeferred = createDeferred<void>()
    const requestEmptyTrash = vi.fn(() => emptyTrashDeferred.promise)
    const requestDeleteItemsForever = vi.fn()
    const restoreItems = vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'test' })
    const source = createTrashSource({
      requestDeleteItemsForever,
      requestEmptyTrash,
      restoreItems,
      trashItems: [trashedNote],
    })

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={vi.fn()} />
      </TrashPopoverTestProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }))

    expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }))

    expect(requestEmptyTrash).toHaveBeenCalledTimes(1)
    expect(restoreItems).not.toHaveBeenCalled()
    expect(requestDeleteItemsForever).not.toHaveBeenCalled()

    emptyTrashDeferred.resolve()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeEnabled())
  })

  it('uses per-item trash action permissions for popover restore and delete actions', async () => {
    const user = userEvent.setup()
    const restoreOnlyNote = createNote({
      deletionTime: Date.UTC(2026, 0, 1),
      name: 'Restore Only',
      slug: 'restore-only',
      status: RESOURCE_STATUS.trashed,
    })
    const deleteOnlyNote = createNote({
      deletionTime: Date.UTC(2026, 0, 2),
      name: 'Delete Only',
      slug: 'delete-only',
      status: RESOURCE_STATUS.trashed,
    })
    const restoreItems = vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'test' })
    const requestDeleteItemsForever = vi.fn()
    const source = createTrashSource({
      canDeleteItemForever: (item) => item.id === deleteOnlyNote.id,
      canRestoreItem: (item) => item.id === restoreOnlyNote.id,
      requestDeleteItemsForever,
      restoreItems,
      trashItems: [restoreOnlyNote, deleteOnlyNote],
    })

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={vi.fn()} />
      </TrashPopoverTestProvider>,
    )

    await user.click(
      within(screen.getByTestId(`trash-item-${restoreOnlyNote.id}`)).getByRole('button', {
        name: 'Restore',
      }),
    )
    await user.click(
      within(screen.getByTestId(`trash-item-${deleteOnlyNote.id}`)).getByRole('button', {
        name: 'Delete forever',
      }),
    )

    expect(restoreItems).toHaveBeenCalledWith([restoreOnlyNote.id], null)
    expect(requestDeleteItemsForever).toHaveBeenCalledWith([deleteOnlyNote.id])
  })

  it('wires popover trash rows to the shared sidebar drag data source', () => {
    const trashedNote = createNote({
      deletionTime: Date.UTC(2026, 0, 1),
      name: 'Draggable Trash',
      slug: 'draggable-trash',
      status: RESOURCE_STATUS.trashed,
    })
    const canDragItem = vi.fn(() => true)
    const getSidebarDragData = vi.fn(() => ({
      dragPreviewItemIds: [trashedNote.id],
      sidebarItemId: trashedNote.id,
      sidebarItemIds: [trashedNote.id],
    }))
    const source = {
      ...createTrashSource({ trashItems: [trashedNote] }),
      canDragItem,
      getSidebarDragData,
    } satisfies TrashPopoverContentSource &
      SidebarDragDataSource & { canDragItem: (item: AnyItem) => boolean }

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={vi.fn()} />
      </TrashPopoverTestProvider>,
    )

    expect(canDragItem).toHaveBeenCalledWith(trashedNote)
    expect(getSidebarDragData).toHaveBeenCalledWith(
      trashedNote,
      expect.objectContaining({
        activeItemSurface: null,
        selectedItemIds: [],
      }),
    )
    expect(useDraggableCalls).toContainEqual({
      canDrag: true,
      data: {
        dragPreviewItemIds: [trashedNote.id],
        sidebarItemId: trashedNote.id,
        sidebarItemIds: [trashedNote.id],
      },
    })
  })

  it('renders epoch deletion timestamps as real trash dates', () => {
    const epochTrashedNote = createNote({
      deletionTime: 0,
      name: 'Epoch Trash',
      slug: 'epoch-trash',
      status: RESOURCE_STATUS.trashed,
    })
    const source = createTrashSource({
      trashItems: [epochTrashedNote],
    })

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={vi.fn()} />
      </TrashPopoverTestProvider>,
    )

    expect(screen.getByText(`Deleted ${new Date(0).toLocaleDateString()}`)).toBeInTheDocument()
  })

  it('routes trash navigation failures through sidebar error handling', async () => {
    const user = userEvent.setup()
    const source = createTrashSource({
      openTrash: vi.fn().mockRejectedValue(new Error('trash unavailable')),
    })

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={vi.fn()} />
      </TrashPopoverTestProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open full trash view' }))

    await waitFor(() => {
      expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), 'Failed to open trash')
    })
  })

  it('keeps the popover open until trash navigation settles', async () => {
    const openTrashDeferred = createDeferred<void>()
    const onClose = vi.fn()
    const source = createTrashSource({
      openTrash: vi.fn(() => openTrashDeferred.promise),
    })

    render(
      <TrashPopoverTestProvider>
        <TrashPopoverContent source={source} onClose={onClose} />
      </TrashPopoverTestProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open full trash view' }))

    expect(onClose).not.toHaveBeenCalled()

    openTrashDeferred.resolve()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})

function TrashPopoverTestProvider({ children }: { children: ReactNode }) {
  return (
    <SidebarWorkspaceStateProvider value={createTestSidebarWorkspaceState()}>
      {children}
    </SidebarWorkspaceStateProvider>
  )
}

function createTrashSource({
  canDragItem = () => false,
  canDeleteItemForever = () => true,
  canEmptyTrash = true,
  canRestoreItem = () => true,
  getSidebarDragData = (item) => ({
    dragPreviewItemIds: [item.id],
    sidebarItemId: item.id,
    sidebarItemIds: [item.id],
  }),
  openItem = vi.fn(),
  openTrash = vi.fn(),
  requestDeleteItemsForever = vi.fn(),
  requestEmptyTrash = vi.fn(),
  restoreItems = vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'test' }),
  trashItems = [],
}: {
  canDragItem?: TrashPopoverContentSource['canDragItem']
  canDeleteItemForever?: (item: AnyItem) => boolean
  canEmptyTrash?: boolean
  canRestoreItem?: (item: AnyItem) => boolean
  getSidebarDragData?: TrashPopoverContentSource['getSidebarDragData']
  openItem?: TrashPopoverContentSource['openItem']
  openTrash?: TrashPopoverContentSource['openTrash']
  requestDeleteItemsForever?: TrashPopoverContentSource['requestDeleteItemsForever']
  requestEmptyTrash?: TrashPopoverContentSource['requestEmptyTrash']
  restoreItems?: TrashPopoverContentSource['restoreItems']
  trashItems?: Array<AnyItem>
} = {}): TrashPopoverContentSource {
  return {
    canDragItem,
    canDeleteItemForever,
    canEmptyTrash: () => canEmptyTrash,
    canRestoreItem,
    getSidebarDragData,
    getRootItems: () => trashItems,
    openItem,
    openTrash,
    requestDeleteItemsForever,
    requestEmptyTrash,
    restoreItems,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}
