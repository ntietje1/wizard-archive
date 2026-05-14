import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { useCreateMap } from '../useCreateMap'

const createItemMock = vi.hoisted(() => vi.fn())
const updateMapImageMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({
    createItem: createItemMock,
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
    createItemMock.mockImplementation(async (_args, initialize) => {
      const created = {
        id: 'map_1' as Id<'sidebarItems'>,
        slug: 'world-map',
      }
      await initialize?.(created)
      return created
    })
  })

  it('initializes map image storage through the filesystem create flow', async () => {
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

    expect(updateMapImageMock).toHaveBeenCalledWith({
      mapId: 'map_1',
      imageStorageId: 'storage_1',
    })
  })
})
