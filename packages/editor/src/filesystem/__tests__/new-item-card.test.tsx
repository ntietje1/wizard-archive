import type { ResourceId } from '../../resources/domain-id'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NewItemCard } from '../new-item-card'

import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'

type NewItemCardSource = Parameters<typeof NewItemCard>[0]['source']

const createItemMock = vi.hoisted(() => vi.fn())

describe('NewItemCard', () => {
  beforeEach(() => {
    createItemMock.mockReset()
  })

  it('names the create trigger as a menu button', () => {
    render(<NewItemCard parentId={'folder_1' as ResourceId} source={createTestSource()} />)

    const trigger = screen.getByRole('button', { name: 'Create item in this folder' })

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens from the keyboard and includes Canvas creation', async () => {
    const user = userEvent.setup()
    render(<NewItemCard parentId={'folder_1' as ResourceId} source={createTestSource()} />)

    const trigger = screen.getByRole('button', { name: 'Create item in this folder' })
    trigger.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('New Canvas')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('creates a canvas in the current folder', async () => {
    const user = userEvent.setup()
    createItemMock.mockResolvedValue({ status: 'completed', id: 'canvas_1', slug: 'canvas-1' })
    render(<NewItemCard parentId={'folder_1' as ResourceId} source={createTestSource()} />)

    await user.click(screen.getByRole('button', { name: 'Create item in this folder' }))
    await user.click(await screen.findByText('New Canvas'))

    await waitFor(() =>
      expect(createItemMock).toHaveBeenCalledWith({
        name: 'Untitled Canvas',
        parentId: 'folder_1',
        type: RESOURCE_TYPES.canvases,
      }),
    )
  })

  it('creates a canvas from keyboard menu selection', async () => {
    const user = userEvent.setup()
    createItemMock.mockResolvedValue({ status: 'completed', id: 'canvas_1', slug: 'canvas-1' })
    render(<NewItemCard parentId={'folder_1' as ResourceId} source={createTestSource()} />)

    await user.click(screen.getByRole('button', { name: 'Create item in this folder' }))
    const canvasItem = await screen.findByRole('menuitem', { name: 'New Canvas' })
    canvasItem.focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(createItemMock).toHaveBeenCalledWith({
        name: 'Untitled Canvas',
        parentId: 'folder_1',
        type: RESOURCE_TYPES.canvases,
      }),
    )
  })

  it('ignores duplicate create requests while creation is pending', async () => {
    const user = userEvent.setup()
    createItemMock.mockImplementation(() => new Promise(() => undefined))
    render(<NewItemCard parentId={'folder_1' as ResourceId} source={createTestSource()} />)

    const trigger = screen.getByRole('button', { name: 'Create item in this folder' })
    await user.click(trigger)
    await user.click(await screen.findByRole('menuitem', { name: 'New Canvas' }))
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    expect(createItemMock).toHaveBeenCalledTimes(1)
  })
})

function createTestSource(): NewItemCardSource {
  return {
    createItemInFolder: createItemMock,
  }
}
