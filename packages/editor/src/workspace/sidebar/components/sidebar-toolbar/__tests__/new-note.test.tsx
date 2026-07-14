import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NewNoteButton } from '../new-note'
import { RESOURCE_TYPES } from '../../../../items-persistence-contract'
import type { CreateItemSource } from '../../../../../filesystem/create-item-source'

const createSidebarItemMock = vi.hoisted(() => vi.fn())
const openItemMock = vi.hoisted(() => vi.fn())
const toastInfoMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock, info: toastInfoMock },
}))

describe('NewNoteButton', () => {
  beforeEach(() => {
    createSidebarItemMock.mockReset()
    openItemMock.mockReset()
    toastErrorMock.mockReset()
    toastInfoMock.mockReset()
  })

  it('disables duplicate clicks while note creation is pending', async () => {
    const user = userEvent.setup()
    createSidebarItemMock.mockReturnValue(new Promise(() => {}))

    render(<NewNoteButton source={createSource()} />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    expect(button).toBeDisabled()

    await user.click(button)

    expect(createSidebarItemMock).toHaveBeenCalledTimes(1)
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  it('does not render when item creation is unavailable', () => {
    render(<NewNoteButton source={createSource({ canCreateItems: () => false })} />)

    expect(screen.queryByRole('button', { name: 'Create new note' })).not.toBeInTheDocument()
  })

  it('creates a note through filesystem operations', async () => {
    const user = userEvent.setup()
    createSidebarItemMock.mockResolvedValue({ status: 'completed', id: 'note_1' })

    render(<NewNoteButton source={createSource()} />)

    await user.click(screen.getByRole('button', { name: 'Create new note' }))

    await waitFor(() => {
      expect(createSidebarItemMock).toHaveBeenCalledWith({
        parentId: null,
        type: RESOURCE_TYPES.notes,
      })
      expect(openItemMock).toHaveBeenCalledWith('note_1')
    })
  })

  it('reports creation failures and leaves note creation available for retry', async () => {
    const user = userEvent.setup()
    createSidebarItemMock
      .mockRejectedValueOnce(new Error('create failed'))
      .mockResolvedValueOnce({ status: 'completed', id: 'note_1' })

    render(<NewNoteButton source={createSource()} />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Unable to create or open note')
      expect(button).toBeEnabled()
    })

    await user.click(button)

    await waitFor(() => {
      expect(createSidebarItemMock).toHaveBeenCalledTimes(2)
      expect(openItemMock).toHaveBeenCalledWith('note_1')
    })
  })

  it('leaves the button enabled after a failed creation result', async () => {
    const user = userEvent.setup()
    createSidebarItemMock.mockResolvedValue({ status: 'failed', reason: 'create_failed' })

    render(<NewNoteButton source={createSource()} />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    await waitFor(() => {
      expect(createSidebarItemMock).toHaveBeenCalledTimes(1)
      expect(button).toBeEnabled()
    })
  })
})

function createSource(overrides: Partial<CreateItemSource> = {}): CreateItemSource {
  return {
    canCreateItems: () => true,
    createItem: createSidebarItemMock,
    openCreateDashboard: () => undefined,
    openItem: openItemMock,
    ...overrides,
  }
}
