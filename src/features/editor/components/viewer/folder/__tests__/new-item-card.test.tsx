import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_CREATION_COMMAND_BY_ID } from '~/features/sidebar/sidebar-item-creation-catalog'
import { NewItemCard } from '../new-item-card'
import type { Id } from 'convex/_generated/dataModel'

const createItemMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/editor/workspace/editor-workspace-source-context', () => ({
  useEditorWorkspaceSource: () => ({
    items: {
      createItem: createItemMock,
    },
  }),
}))

describe('NewItemCard', () => {
  beforeEach(() => {
    createItemMock.mockReset()
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
        type: SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.canvas'].type,
        parentId: 'folder_1',
      }),
    )
  })
})
