import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { NewNoteButton } from '../new-note'

const createItemMock = vi.hoisted(() => vi.fn())
const navigateToItemMock = vi.hoisted(() => vi.fn())
const openParentFoldersMock = vi.hoisted(() => vi.fn())
const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({ createItem: createItemMock }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarValidation', () => ({
  useSidebarValidation: () => ({ getDefaultName: () => 'New Note' }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({ navigateToItem: navigateToItemMock }),
}))

vi.mock('~/features/sidebar/hooks/useOpenParentFolders', () => ({
  useOpenParentFolders: () => ({ openParentFolders: openParentFoldersMock }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: handleErrorMock,
  logger: { warn: vi.fn() },
}))

describe('NewNoteButton', () => {
  beforeEach(() => {
    createItemMock.mockReset()
    navigateToItemMock.mockReset()
    openParentFoldersMock.mockReset()
    handleErrorMock.mockReset()
  })

  it('stays clickable while note creation is pending', async () => {
    const user = userEvent.setup()
    createItemMock.mockReturnValue(new Promise(() => {}))

    render(<NewNoteButton />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    expect(button).toBeEnabled()

    await user.click(button)

    expect(createItemMock).toHaveBeenCalledTimes(2)
  })

  it('opens and navigates to a successfully created note', async () => {
    const user = userEvent.setup()
    createItemMock.mockResolvedValue({ id: 'note_1', slug: 'new-note' })

    render(<NewNoteButton />)

    await user.click(screen.getByRole('button', { name: 'Create new note' }))

    expect(createItemMock).toHaveBeenCalledWith({
      type: SIDEBAR_ITEM_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: null },
      name: 'New Note',
    })
    expect(openParentFoldersMock).toHaveBeenCalledWith('note_1')
    expect(navigateToItemMock).toHaveBeenCalledWith('new-note')
  })

  it('reports create failures and leaves the button enabled', async () => {
    const user = userEvent.setup()
    const error = new Error('create failed')
    createItemMock.mockRejectedValue(error)

    render(<NewNoteButton />)

    const button = screen.getByRole('button', { name: 'Create new note' })
    await user.click(button)

    expect(handleErrorMock).toHaveBeenCalledWith(error, 'Failed to create note')
    expect(button).toBeEnabled()
  })
})
