import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FolderViewer } from '../viewer'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { FolderItemWithContent } from '../../../workspace/items'
import type { FolderViewerSource } from '../../../filesystem/cards/source'

const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}))

vi.mock('../../../workspace/context-menu/context-menu', () => ({
  WorkspaceContextMenu: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('../../../workspace/sidebar/use-item-surface-registration', () => ({
  useItemSurfaceRegistration: () => ({
    activateSurface: vi.fn(),
    handleSurfacePointerDown: vi.fn(),
    itemSurfaceHotkeyProps: {},
  }),
}))

vi.mock('../../../filesystem/create-new-dashboard-surface', () => ({
  CreateNewDashboardSurface: ({
    disabled = false,
    onCreate,
  }: {
    disabled?: boolean
    onCreate: (option: { type: 'note' }) => void
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const noteOption = { type: 'note' } as const
        onCreate(noteOption)
        onCreate(noteOption)
      }}
    >
      Create note in folder
    </button>
  ),
}))

vi.mock('../droppable-folder-zone', () => ({
  DroppableFolderZone: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <section className={className}>{children}</section>
  ),
}))

describe('FolderViewer', () => {
  it('treats one create activation as the active folder operation until it settles', async () => {
    const user = userEvent.setup()
    const createItemInFolder = vi.fn(
      () => new Promise<Awaited<ReturnType<FolderViewerSource['createItemInFolder']>>>(() => {}),
    )
    const openItem = vi.fn()

    render(
      <FolderViewer
        item={createFolderItem()}
        source={createFolderViewerSource({ createItemInFolder, openItem })}
      />,
    )

    const createNoteButton = screen.getByRole('button', { name: 'Create note in folder' })
    await user.click(createNoteButton)

    expect(createItemInFolder).toHaveBeenCalledOnce()
    expect(createNoteButton).toBeDisabled()
  })

  it('reports create failures and clears the pending state', async () => {
    const user = userEvent.setup()
    const createError = new Error('create failed')
    const createItemInFolder = vi.fn().mockRejectedValue(createError)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(
        <FolderViewer
          item={createFolderItem()}
          source={createFolderViewerSource({ createItemInFolder, openItem: vi.fn() })}
        />,
      )

      const createNoteButton = screen.getByRole('button', { name: 'Create note in folder' })
      await user.click(createNoteButton)

      expect(toastErrorMock).toHaveBeenCalledWith('Failed to create item')
      expect(consoleErrorSpy).toHaveBeenCalledWith(createError)
      expect(createNoteButton).not.toBeDisabled()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})

function createFolderViewerSource({
  createItemInFolder,
  openItem,
}: {
  createItemInFolder: FolderViewerSource['createItemInFolder']
  openItem: FolderViewerSource['openItem']
}): FolderViewerSource {
  return {
    canCreateInFolder: () => true,
    canDragItem: () => false,
    canDropIntoFolder: () => false,
    createItemInFolder,
    currentItemId: null,
    getChildren: () => [],
    getSidebarDragData: (item) => ({
      sidebarItemId: item.id,
      sidebarItemIds: [item.id],
      dragPreviewItemIds: [item.id],
    }),
    getStatus: () => 'success',
    openItem,
  }
}

function createFolderItem(): FolderItemWithContent {
  return {
    id: 'folder-1',
    name: 'Session Prep',
    type: RESOURCE_TYPES.folders,
    isTrashed: false,
    ancestors: [],
  } as unknown as FolderItemWithContent
}
