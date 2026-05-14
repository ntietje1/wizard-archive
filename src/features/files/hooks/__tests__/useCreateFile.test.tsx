import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { useCreateFile } from '../useCreateFile'

const createItemMock = vi.hoisted(() => vi.fn())
const updateFileStorageMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({
    createItem: createItemMock,
  }),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => ({
    mutateAsync: updateFileStorageMock,
  }),
}))

describe('useCreateFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createItemMock.mockImplementation(async (_args, initialize) => {
      const created = {
        id: 'file_1' as Id<'sidebarItems'>,
        slug: 'handout',
      }
      await initialize?.(created)
      return created
    })
  })

  it('initializes file storage through the filesystem create flow', async () => {
    const error = new Error('upload failed')
    updateFileStorageMock.mockRejectedValueOnce(error)
    const { result } = renderHook(() => useCreateFile())

    await expect(
      result.current.createFile({
        name: 'Handout',
        parentTarget: { kind: 'direct', parentId: null },
        storageId: 'storage_1' as Id<'_storage'>,
      }),
    ).rejects.toThrow(error)

    expect(updateFileStorageMock).toHaveBeenCalledWith({
      fileId: 'file_1',
      storageId: 'storage_1',
    })
  })
})
