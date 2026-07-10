import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createNote } from '../../../test/sidebar-item-factory'
import { createWorkspaceResource } from '../../runtime'
import { createSidebarItemContextMenuActions } from '../actions/sidebar-item-actions'

const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../../../errors/handle-error', () => ({
  handleError: handleErrorMock,
}))

describe('createSidebarItemContextMenuActions', () => {
  beforeEach(() => {
    handleErrorMock.mockReset()
  })

  it('opens sidebar items from the navigation facet', async () => {
    const note = createNote()
    const openItem = vi.fn()
    const actions = createSidebarItemContextMenuActions({
      source: {
        canOpenItemsSeparately: { status: 'available' },
        openItem,
        toggleBookmarks: vi.fn(),
      },
      setRenamingItemId: vi.fn(),
      showItemInSidebar: vi.fn(),
    })

    await actions.open({ surface: 'sidebar', item: note, selectedItems: [note] })
    await actions.openInNewTab({ surface: 'sidebar', item: note, selectedItems: [note] })

    expect(openItem).toHaveBeenNthCalledWith(1, createWorkspaceResource(note.id))
    expect(openItem).toHaveBeenNthCalledWith(2, createWorkspaceResource(note.id), {
      target: 'separate',
    })
  })

  it('reports navigation failures', async () => {
    const note = createNote()
    const error = new Error('Unable to open')
    const actions = createSidebarItemContextMenuActions({
      source: {
        canOpenItemsSeparately: { status: 'available' },
        openItem: vi.fn(() => Promise.reject(error)),
        toggleBookmarks: vi.fn(),
      },
      setRenamingItemId: vi.fn(),
      showItemInSidebar: vi.fn(),
    })

    await actions.open({ surface: 'sidebar', item: note, selectedItems: [note] })

    expect(handleErrorMock).toHaveBeenCalledExactlyOnceWith(error, 'Failed to open item')
  })

  it('reports separate-window navigation failures', async () => {
    const note = createNote()
    const error = new Error('Unable to open separately')
    const actions = createSidebarItemContextMenuActions({
      source: {
        canOpenItemsSeparately: { status: 'available' },
        openItem: vi.fn(() => Promise.reject(error)),
        toggleBookmarks: vi.fn(),
      },
      setRenamingItemId: vi.fn(),
      showItemInSidebar: vi.fn(),
    })

    await actions.openInNewTab({ surface: 'sidebar', item: note, selectedItems: [note] })

    expect(handleErrorMock).toHaveBeenCalledExactlyOnceWith(error, 'Failed to open item')
  })
})
