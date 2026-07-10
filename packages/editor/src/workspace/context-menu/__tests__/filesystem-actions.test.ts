import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createNote } from '../../../test/sidebar-item-factory'
import type { FilesystemContextMenuActionTarget } from '../filesystem-actions'
import { createFilesystemContextMenuActions } from '../filesystem-actions'

const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}))

describe('createFilesystemContextMenuActions', () => {
  beforeEach(() => {
    toastErrorMock.mockReset()
  })

  it('routes selected items through filesystem operations', async () => {
    const first = createNote()
    const second = createNote()
    const filesystem = createFileSystem()
    const actions = createFilesystemContextMenuActions({ filesystem })
    const context = {
      surface: 'sidebar' as const,
      item: first,
      selectedItems: [first, second],
    }

    await actions.delete(context)
    await actions.duplicate(context)
    await actions.restore(context)
    await actions.permanentlyDelete(context)

    expect(filesystem.trashItems).toHaveBeenCalledExactlyOnceWith([first, second])
    expect(filesystem.duplicateItems).toHaveBeenCalledExactlyOnceWith([first, second])
    expect(filesystem.restoreItems).toHaveBeenCalledExactlyOnceWith([first, second], null)
    expect(filesystem.requestDeleteItemsForever).toHaveBeenCalledExactlyOnceWith([first, second])
  })

  it('routes paste through the clicked destination item', async () => {
    const item = createNote()
    const selectedItems = [item, createNote()]
    const filesystem = createFileSystem()
    const actions = createFilesystemContextMenuActions({ filesystem })

    await actions.paste({ surface: 'sidebar', item, selectedItems })

    expect(filesystem.pasteIntoTarget).toHaveBeenCalledExactlyOnceWith({
      clickedItem: item,
    })
  })

  it('opens the filesystem dialog for empty trash', async () => {
    const filesystem = createFileSystem()
    const onDialogOpen = vi.fn()
    const actions = createFilesystemContextMenuActions({
      filesystem,
      onDialogOpen,
    })

    await actions.emptyTrash({ surface: 'trash-view', selectedItems: [] })

    expect(filesystem.requestEmptyTrash).toHaveBeenCalledOnce()
    expect(onDialogOpen).toHaveBeenCalledOnce()
  })

  it('reports filesystem operation failures without rejecting the menu action', async () => {
    const first = createNote()
    const filesystem = createFileSystem()
    vi.mocked(filesystem.trashItems).mockRejectedValue(new Error('Trash failed'))
    const actions = createFilesystemContextMenuActions({ filesystem })

    await expect(
      actions.delete({
        surface: 'sidebar',
        item: first,
        selectedItems: [first],
      }),
    ).resolves.toBeUndefined()

    expect(toastErrorMock).toHaveBeenCalledExactlyOnceWith('Failed to move items to trash')
  })
})

function createFileSystem(): FilesystemContextMenuActionTarget {
  return {
    canDeleteItemsForever: vi.fn(() => false),
    canDuplicateItems: vi.fn(() => false),
    canEmptyTrash: true,
    canPasteIntoTarget: vi.fn(() => false),
    canRestoreItems: vi.fn(() => false),
    canTrashItems: vi.fn(() => false),
    duplicateItems: vi.fn(),
    requestEmptyTrash: vi.fn(),
    pasteIntoTarget: vi.fn(),
    requestDeleteItemsForever: vi.fn(),
    restoreItems: vi.fn(),
    trashItems: vi.fn(),
  }
}
