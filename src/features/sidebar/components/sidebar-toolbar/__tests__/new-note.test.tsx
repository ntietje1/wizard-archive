import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { NewNoteButton } from '../new-note'

const createItemMock = vi.hoisted(() => vi.fn())
const openParentFoldersMock = vi.hoisted(() => vi.fn())
const handleErrorMock = vi.hoisted(() => vi.fn())
const toastInfoMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({ createItem: createItemMock }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarValidation', () => ({
  useSidebarValidation: () => ({ getDefaultName: () => 'New Note' }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' }),
}))

vi.mock('~/features/sidebar/hooks/useOpenParentFolders', () => ({
  useOpenParentFolders: () => ({ openParentFolders: openParentFoldersMock }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: handleErrorMock,
  logger: { warn: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { info: toastInfoMock },
}))

describe('NewNoteButton', () => {
  beforeEach(() => {
    createItemMock.mockReset()
    openParentFoldersMock.mockReset()
    handleErrorMock.mockReset()
    toastInfoMock.mockReset()
  })

  it('stays enabled but ignores duplicate clicks while note creation is pending', async () => {
    const user = userEvent.setup()
    createItemMock.mockReturnValue(new Promise(() => {}))

    render(<NewNoteButton />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    expect(button).toBeEnabled()

    await user.click(button)

    expect(createItemMock).toHaveBeenCalledTimes(1)
    expect(toastInfoMock).toHaveBeenCalledWith('Note creation in progress')
  })

  it('creates a note and opens its parent folders', async () => {
    const user = userEvent.setup()
    createItemMock.mockResolvedValue({ id: 'note_1', slug: 'new-note' })

    render(<NewNoteButton />)

    await user.click(screen.getByRole('button', { name: 'Create new note' }))

    await waitFor(() =>
      expect(createItemMock).toHaveBeenCalledWith({
        type: SIDEBAR_ITEM_TYPES.notes,
        parentTarget: { kind: 'direct', parentId: null },
        name: 'New Note',
      }),
    )
    expect(openParentFoldersMock).toHaveBeenCalledWith('note_1')
  })

  it('reports create failures and leaves the button enabled', async () => {
    const user = userEvent.setup()
    const error = new Error('create failed')
    createItemMock.mockRejectedValue(error)

    render(<NewNoteButton />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    await waitFor(() => {
      expect(handleErrorMock).toHaveBeenCalledWith(error, 'Failed to create note')
      expect(button).toBeEnabled()
    })
  })
})
