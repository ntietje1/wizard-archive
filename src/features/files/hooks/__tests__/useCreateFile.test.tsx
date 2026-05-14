import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { useCreateFile } from '../useCreateFile'

const createItemMock = vi.hoisted(() => vi.fn())
const discardCreatedItemMock = vi.hoisted(() => vi.fn())
const updateFileStorageMock = vi.hoisted(() => vi.fn())

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
    mutateAsync: updateFileStorageMock,
  }),
}))

describe('useCreateFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createItemMock.mockResolvedValue({
      id: 'file_1' as Id<'sidebarItems'>,
      slug: 'handout',
      transactionId: 'transaction_1' as Id<'filesystemTransactions'>,
    })
  })

  it('discards the filesystem item when file storage initialization fails', async () => {
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

    expect(discardCreatedItemMock).toHaveBeenCalledWith('transaction_1')
  })
})
