import type { ResourceId } from '../../resources/domain-id'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { CreateNewDashboard } from '../create-new-dashboard'

import { assertResourceItemSlug } from '../../workspace/items'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { CreateItemSource } from '../create-item-source'

const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../../errors/handle-error', () => ({
  handleError: handleErrorMock,
}))

describe('CreateNewDashboard', () => {
  it('creates items through filesystem operations and opens the created item', async () => {
    const user = userEvent.setup()
    const createItem = vi.fn<CreateItemSource['createItem']>((_input) => ({
      status: 'completed',
      id: 'note-1' as ResourceId,
      slug: assertResourceItemSlug('note-1'),
    }))
    const openItem = vi.fn()

    render(
      <CreateNewDashboard
        parentId={'folder-1' as ResourceId}
        folderPath="Folder/"
        source={createDashboardSource({
          createItem,
          openItem,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Note/ }))

    await waitFor(() => {
      expect(createItem).toHaveBeenCalledWith({
        name: 'Untitled Note',
        parentId: 'folder-1',
        type: RESOURCE_TYPES.notes,
      })
    })
    expect(openItem).toHaveBeenCalledWith('note-1')
  })

  it('creates map actions as game-map resources with a map default name', async () => {
    const user = userEvent.setup()
    const createItem = vi.fn<CreateItemSource['createItem']>(() => ({
      status: 'completed',
      id: 'map-canvas-1' as ResourceId,
      slug: assertResourceItemSlug('untitled-map'),
    }))
    const openItem = vi.fn()

    render(
      <CreateNewDashboard
        parentId={null}
        source={createDashboardSource({
          createItem,
          openItem,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Map/ }))

    await waitFor(() => {
      expect(createItem).toHaveBeenCalledWith({
        name: 'Untitled Map',
        parentId: null,
        type: RESOURCE_TYPES.gameMaps,
      })
    })
  })

  it('reports an opening error when a created item cannot be opened', async () => {
    const user = userEvent.setup()
    const createItem = vi.fn<CreateItemSource['createItem']>(() => ({
      status: 'completed',
      id: 'note-1' as ResourceId,
      slug: assertResourceItemSlug('note-1'),
    }))
    const openError = new Error('open failed')
    const openItem = vi.fn<CreateItemSource['openItem']>(() => {
      throw openError
    })

    render(
      <CreateNewDashboard
        parentId={'folder-1' as ResourceId}
        folderPath="Folder/"
        source={createDashboardSource({
          createItem,
          openItem,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Note/ }))

    await waitFor(() => {
      expect(handleErrorMock).toHaveBeenCalledWith(openError, 'Created item, but failed to open it')
    })
  })
})

function createDashboardSource({
  createItem,
  openItem,
}: {
  createItem: CreateItemSource['createItem']
  openItem: CreateItemSource['openItem']
}): CreateItemSource {
  return {
    canCreateItems: () => true,
    createItem,
    openCreateDashboard: () => undefined,
    openItem,
  }
}
