import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { useCreateMap } from '../useCreateMap'

const createItemMock = vi.hoisted(() => vi.fn())
const discardCreatedItemMock = vi.hoisted(() => vi.fn())
const updateMapImageMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({
    createItem: createItemMock,
  }),
}))

vi.mock('~/features/filesystem/useFileSystem', () => ({
  useFileSystem: () => ({
    discardCreatedItem: discardCreatedItemMock,
  }),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => ({
    mutateAsync: updateMapImageMock,
  }),
}))

describe('useCreateMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createItemMock.mockResolvedValue({
      id: 'map_1' as Id<'sidebarItems'>,
      slug: 'world-map',
      transactionId: 'transaction_1' as Id<'filesystemTransactions'>,
    })
  })

  it('discards the filesystem item when map image initialization fails', async () => {
    const error = new Error('image failed')
    updateMapImageMock.mockRejectedValueOnce(error)
    const { result } = renderHook(() => useCreateMap())

    await expect(
      result.current.createMap({
        name: 'World Map',
        parentTarget: { kind: 'direct', parentId: null },
        imageStorageId: 'storage_1' as Id<'_storage'>,
      }),
    ).rejects.toThrow(error)

    expect(discardCreatedItemMock).toHaveBeenCalledWith('transaction_1')
  })
})
