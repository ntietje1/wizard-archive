import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SIDEBAR_ITEM_CREATION_COMMAND_BY_ID } from '~/features/sidebar/sidebar-item-creation-catalog'
import { NewNoteButton } from '../new-note'

const createSidebarItemMock = vi.hoisted(() => vi.fn())
const toastInfoMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/sidebar/workspace/sidebar-workspace-source', () => ({
  useSidebarWorkspaceSource: () => ({
    commands: {
      createSidebarItem: createSidebarItemMock,
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: { info: toastInfoMock },
}))

describe('NewNoteButton', () => {
  beforeEach(() => {
    createSidebarItemMock.mockReset()
    toastInfoMock.mockReset()
  })

  it('stays enabled but ignores duplicate clicks while note creation is pending', async () => {
    const user = userEvent.setup()
    createSidebarItemMock.mockReturnValue(new Promise(() => {}))

    render(<NewNoteButton />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    expect(button).toBeEnabled()

    await user.click(button)

    expect(createSidebarItemMock).toHaveBeenCalledTimes(1)
    expect(toastInfoMock).toHaveBeenCalledWith('Note creation in progress')
  })

  it('creates a note through the workspace source', async () => {
    const user = userEvent.setup()
    createSidebarItemMock.mockResolvedValue({ id: 'note_1', slug: 'new-note' })

    render(<NewNoteButton />)

    await user.click(screen.getByRole('button', { name: 'Create new note' }))

    await waitFor(() =>
      expect(createSidebarItemMock).toHaveBeenCalledWith({
        type: SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.note'].type,
        parentId: null,
      }),
    )
  })

  it('leaves the button enabled when creation does not return an item', async () => {
    const user = userEvent.setup()
    createSidebarItemMock.mockResolvedValue(null)

    render(<NewNoteButton />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    await waitFor(() => {
      expect(createSidebarItemMock).toHaveBeenCalledTimes(1)
      expect(button).toBeEnabled()
    })
  })
})
