import { describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { ResourceImportFile } from '../../files/import-contract'
import { replaceMapImage } from '../map-image-replacement'
import { completedResourceOperation } from '../../filesystem/transaction-contract'

describe('replaceMapImage', () => {
  it('stages and commits a replacement image with a completed receipt', async () => {
    const file = createImportFile()
    const stageImage = vi.fn().mockResolvedValue({
      status: 'staged',
      image: 'storage-1',
      cancel: vi
        .fn()
        .mockResolvedValue(
          completedResourceOperation({ kind: 'mapImageUpdated', affectedCount: 1 }),
        ),
    })
    const commitImage = vi
      .fn()
      .mockResolvedValue(completedResourceOperation({ kind: 'mapImageUpdated', affectedCount: 1 }))

    await expect(
      replaceMapImage({
        commitImage,
        file,
        mapId: 'map-1' as SidebarItemId,
        stageImage,
      }),
    ).resolves.toEqual({
      status: 'completed',
      receipt: {
        kind: 'mapImageUpdated',
        itemId: 'map-1',
        affectedCount: 1,
      },
    })

    expect(stageImage).toHaveBeenCalledExactlyOnceWith({
      file,
      mapId: 'map-1',
    })
    expect(commitImage).toHaveBeenCalledExactlyOnceWith({
      image: 'storage-1',
      mapId: 'map-1',
    })
  })

  it('returns a stage rejection without committing', async () => {
    const stageImage = vi.fn().mockResolvedValue({
      status: 'unavailable',
      reason: 'map_not_found',
    })
    const commitImage = vi.fn()

    await expect(
      replaceMapImage({
        commitImage,
        file: createImportFile(),
        mapId: 'map-1' as SidebarItemId,
        stageImage,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'map_not_found' })

    expect(commitImage).not.toHaveBeenCalled()
  })

  it('cancels staged images when commit returns a non-completed result', async () => {
    const cancelImage = vi
      .fn()
      .mockResolvedValue(completedResourceOperation({ kind: 'mapImageUpdated', affectedCount: 1 }))
    const commitResult = { status: 'unavailable' as const, reason: 'map_not_found' }

    await expect(
      replaceMapImage({
        commitImage: vi.fn().mockResolvedValue(commitResult),
        file: createImportFile(),
        mapId: 'map-1' as SidebarItemId,
        stageImage: vi.fn().mockResolvedValue({
          status: 'staged',
          image: 'storage-1',
          cancel: cancelImage,
        }),
      }),
    ).resolves.toEqual(commitResult)

    expect(cancelImage).toHaveBeenCalledExactlyOnceWith({
      image: 'storage-1',
      mapId: 'map-1',
    })
  })

  it('cancels the staged image and returns the commit error when commit fails', async () => {
    const commitError = new Error('commit failed')
    const cancelImage = vi
      .fn()
      .mockResolvedValue(completedResourceOperation({ kind: 'mapImageUpdated', affectedCount: 1 }))

    await expect(
      replaceMapImage({
        commitImage: vi.fn().mockRejectedValue(commitError),
        file: createImportFile(),
        mapId: 'map-1' as SidebarItemId,
        stageImage: vi.fn().mockResolvedValue({
          status: 'staged',
          image: 'storage-1',
          cancel: cancelImage,
        }),
      }),
    ).resolves.toEqual({ status: 'error', error: commitError })

    expect(cancelImage).toHaveBeenCalledExactlyOnceWith({
      image: 'storage-1',
      mapId: 'map-1',
    })
  })

  it('surfaces cleanup failures when cancelling a staged image also fails', async () => {
    const commitError = new Error('commit failed')
    const cancelError = new Error('cancel failed')

    const result = await replaceMapImage({
      commitImage: vi.fn().mockRejectedValue(commitError),
      file: createImportFile(),
      mapId: 'map-1' as SidebarItemId,
      stageImage: vi.fn().mockResolvedValue({
        status: 'staged',
        image: 'storage-1',
        cancel: vi.fn().mockRejectedValue(cancelError),
      }),
    })

    expect(result).toMatchObject({
      status: 'error',
      error: {
        message: 'Map image replacement failed and cleanup also failed',
        commitError,
        cancelError,
      },
    })
  })

  it('returns a stage error when staging throws', async () => {
    const stageError = new Error('stage failed')
    const commitImage = vi.fn()

    await expect(
      replaceMapImage({
        commitImage,
        file: createImportFile(),
        mapId: 'map-1' as SidebarItemId,
        stageImage: vi.fn().mockRejectedValue(stageError),
      }),
    ).resolves.toEqual({ status: 'error', error: stageError })

    expect(commitImage).not.toHaveBeenCalled()
  })
})

function createImportFile(): ResourceImportFile {
  return {
    name: 'map.png',
    contentType: 'image/png',
    size: 3,
    arrayBuffer: () => new ArrayBuffer(3),
    text: () => 'map',
  }
}
