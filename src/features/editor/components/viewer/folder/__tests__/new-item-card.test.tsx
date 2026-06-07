import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { NewItemCard } from '../new-item-card'
import type { Id } from 'convex/_generated/dataModel'

const createItemMock = vi.hoisted(() => vi.fn())
const openParentFoldersMock = vi.hoisted(() => vi.fn())
const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({ createItem: createItemMock }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarValidation', () => ({
  useSidebarValidation: () => ({
    getDefaultName: (type: string) => `New ${type}`,
  }),
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

describe('NewItemCard', () => {
  beforeEach(() => {
    createItemMock.mockReset()
    openParentFoldersMock.mockReset()
    handleErrorMock.mockReset()
  })

  it('names the create trigger as a menu button', () => {
    render(<NewItemCard parentId={'folder_1' as Id<'sidebarItems'>} />)

    const trigger = screen.getByRole('button', { name: 'Create item in this folder' })

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens from the keyboard and includes Canvas creation', async () => {
    const user = userEvent.setup()
    render(<NewItemCard parentId={'folder_1' as Id<'sidebarItems'>} />)

    const trigger = screen.getByRole('button', { name: 'Create item in this folder' })
    trigger.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('New Canvas')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('creates a canvas in the current folder', async () => {
    const user = userEvent.setup()
    createItemMock.mockResolvedValue({ id: 'canvas_1', slug: 'canvas-1' })
    render(<NewItemCard parentId={'folder_1' as Id<'sidebarItems'>} />)

    await user.click(screen.getByRole('button', { name: 'Create item in this folder' }))
    await user.click(await screen.findByText('New Canvas'))

    await waitFor(() =>
      expect(createItemMock).toHaveBeenCalledWith({
        type: SIDEBAR_ITEM_TYPES.canvases,
        parentTarget: { kind: 'direct', parentId: 'folder_1' },
        name: `New ${SIDEBAR_ITEM_TYPES.canvases}`,
      }),
    )
    expect(openParentFoldersMock).toHaveBeenCalledWith('canvas_1')
  })
})
