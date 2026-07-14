import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../../workspace/items-persistence-contract'
import { createNote } from '../../../test/sidebar-item-factory'
import { TrashBanner } from '../banner'

type TrashBannerSource = Parameters<typeof TrashBanner>[0]['source']

describe('TrashBanner', () => {
  it('requests empty-trash confirmation from filesystem permission state', async () => {
    const user = userEvent.setup()
    const requestEmptyTrash = vi.fn()
    const source = createTrashBannerSource({ canEmptyTrash: true, requestEmptyTrash })

    render(<TrashBanner source={source} />)

    await user.click(screen.getByRole('button', { name: 'Empty Trash' }))

    expect(requestEmptyTrash).toHaveBeenCalledOnce()
  })

  it('uses the trash restore permission for item restore actions', async () => {
    const user = userEvent.setup()
    const item = createNote({
      name: 'Trashed Note',
      status: RESOURCE_STATUS.trashed,
    })
    const restoreItems = vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'test' })
    const source = createTrashBannerSource({
      canDeleteItemForever: () => false,
      canEmptyTrash: true,
      canRestoreItem: () => true,
      restoreItems,
    })

    render(<TrashBanner item={item} source={source} />)

    await user.click(screen.getByRole('button', { name: 'Restore' }))

    expect(restoreItems).toHaveBeenCalledWith([item.id], null)
  })

  it('prevents duplicate restore requests while restore is pending', async () => {
    const user = userEvent.setup()
    const item = createNote({
      name: 'Trashed Note',
      status: RESOURCE_STATUS.trashed,
    })
    let resolveRestore!: (result: { status: 'completed' }) => void
    const restoreItems = vi.fn(
      () => new Promise<{ status: 'completed' }>((resolve) => (resolveRestore = resolve)),
    )
    const source = createTrashBannerSource({
      canEmptyTrash: true,
      restoreItems: restoreItems as unknown as TrashBannerSource['restoreItems'],
    })

    render(<TrashBanner item={item} source={source} />)

    const restoreButton = screen.getByRole('button', { name: 'Restore' })
    await user.click(restoreButton)
    await user.click(restoreButton)

    expect(restoreItems).toHaveBeenCalledOnce()
    expect(restoreButton).toBeDisabled()

    resolveRestore({ status: 'completed' })
  })

  it('requests permanent-delete confirmation from item trash permissions', async () => {
    const user = userEvent.setup()
    const item = createNote({
      name: 'Trashed Note',
      status: RESOURCE_STATUS.trashed,
    })
    const requestDeleteItemsForever = vi.fn()
    const source = createTrashBannerSource({
      canDeleteItemForever: () => true,
      canEmptyTrash: true,
      canRestoreItem: () => false,
      requestDeleteItemsForever,
    })

    render(<TrashBanner item={item} source={source} />)

    await user.click(screen.getByRole('button', { name: 'Delete from Trash' }))

    expect(requestDeleteItemsForever).toHaveBeenCalledWith([item.id])
  })

  it('keeps future deletion timestamps from producing negative trash age copy', () => {
    const item = createNote({
      name: 'Trashed Note',
      status: RESOURCE_STATUS.trashed,
      deletionTime: Date.now() + 24 * 60 * 60 * 1000,
    })
    const source = createTrashBannerSource({ canEmptyTrash: true })

    render(<TrashBanner item={item} source={source} />)

    expect(screen.getByText(/to the Trash today/)).toBeInTheDocument()
  })
})

function createTrashBannerSource({
  canDeleteItemForever = () => true,
  canEmptyTrash,
  canRestoreItem = () => true,
  requestDeleteItemsForever = vi.fn(),
  requestEmptyTrash = vi.fn(),
  restoreItems = vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'test' }),
}: {
  canDeleteItemForever?: TrashBannerSource['canDeleteItemForever']
  canEmptyTrash: boolean
  canRestoreItem?: TrashBannerSource['canRestoreItem']
  requestDeleteItemsForever?: TrashBannerSource['requestDeleteItemsForever']
  requestEmptyTrash?: TrashBannerSource['requestEmptyTrash']
  restoreItems?: TrashBannerSource['restoreItems']
}): TrashBannerSource {
  return {
    canEmptyTrash: () => canEmptyTrash,
    canDeleteItemForever,
    canRestoreItem,
    getDeletedByName: () => undefined,
    requestDeleteItemsForever,
    requestEmptyTrash,
    restoreItems,
  }
}
