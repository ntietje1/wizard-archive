import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { useLiveGameMapSessionSource } from '../session-source'
import { uploadFile as uploadFileToUrl } from '~/shared/uploads/upload-file'
import type { WizardEditorMapSession } from '@wizard-archive/editor/adapter'
import { testMapPinId } from 'shared/test/map-pin-id'

const campaignMutationQueue = vi.hoisted(() => [] as Array<ReturnType<typeof vi.fn>>)
const appMutationQueue = vi.hoisted(() => [] as Array<{ mutateAsync: ReturnType<typeof vi.fn> }>)
type LiveMapImageImportFile = Parameters<WizardEditorMapSession['updateMapImage']>[0]['file']

vi.mock('~/shared/uploads/upload-file', () => ({
  uploadFile: vi.fn(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => appMutationQueue.shift() ?? { mutateAsync: vi.fn() },
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => ({
    mutateAsync: campaignMutationQueue.shift() ?? vi.fn(),
  }),
}))

function createImportFile(
  parts: Array<BlobPart>,
  name: string,
  options: FilePropertyBag,
): LiveMapImageImportFile {
  const file = new File(parts, name, options)
  return {
    name: file.name,
    contentType: file.type,
    size: file.size,
    arrayBuffer: () => file.arrayBuffer(),
    text: () => file.text(),
  }
}

describe('useLiveGameMapSessionSource', () => {
  beforeEach(() => {
    campaignMutationQueue.length = 0
    appMutationQueue.length = 0
    vi.mocked(uploadFileToUrl).mockReset()
  })

  it('updates map pins through the live game map session source', async () => {
    const createdPinId = testMapPinId('live-pin')
    const createPins = vi.fn().mockResolvedValue([createdPinId])
    const updatePin = vi.fn().mockResolvedValue(undefined)
    const removePin = vi.fn().mockResolvedValue(undefined)
    const updateVisibility = vi.fn().mockResolvedValue(undefined)
    campaignMutationQueue.push(vi.fn(), createPins, updatePin, removePin, updateVisibility, vi.fn())
    const { result } = renderHook(() => useLiveGameMapSessionSource())

    const createResult = await result.current.session.pins.create({
      mapId: 'map-1' as Id<'sidebarItems'>,
      pins: [{ itemId: 'note-1' as Id<'sidebarItems'>, layerId: 'upper', x: 12, y: 34 }],
    })
    expect(createPins).toHaveBeenCalledWith({
      mapId: 'map-1',
      pins: [{ itemId: 'note-1', layerId: 'upper', x: 12, y: 34 }],
    })
    expect(createResult).toEqual({
      status: 'completed',
      receipt: {
        kind: 'mapPinsCreated',
        itemId: 'map-1',
        affectedCount: 1,
        pinIds: [createdPinId],
      },
    })
    await expect(
      result.current.session.pins.update({
        mapId: 'map-1' as Id<'sidebarItems'>,
        mapPinId: createdPinId,
        x: 56,
        y: 78,
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: { kind: 'mapPinUpdated', itemId: 'map-1', affectedCount: 1 },
    })
    await expect(
      result.current.session.pins.setVisibility({
        mapId: 'map-1' as Id<'sidebarItems'>,
        mapPinId: createdPinId,
        isVisible: false,
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: { kind: 'mapPinVisibilityUpdated', itemId: 'map-1', affectedCount: 1 },
    })
    await expect(
      result.current.session.pins.remove({
        mapId: 'map-1' as Id<'sidebarItems'>,
        mapPinId: createdPinId,
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: { kind: 'mapPinRemoved', itemId: 'map-1', affectedCount: 1 },
    })

    expect(createPins).toHaveBeenCalledWith({
      mapId: 'map-1',
      pins: [{ itemId: 'note-1', layerId: 'upper', x: 12, y: 34 }],
    })
    expect(updatePin).toHaveBeenCalledWith({ mapPinId: createdPinId, x: 56, y: 78 })
    expect(updateVisibility).toHaveBeenCalledWith({ mapPinId: createdPinId, visible: false })
    expect(removePin).toHaveBeenCalledWith({ mapPinId: createdPinId })
  })

  it('updates map images through the live game map session source', async () => {
    const createUploadSessionMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        sessionId: 'upload-session-1',
        uploadUrl: 'https://upload',
      }),
    }
    const bindUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const discardUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const beginMapImageReplacement = vi.fn().mockResolvedValue('replacement-1')
    const updateMapImage = vi.fn().mockResolvedValue(undefined)
    appMutationQueue.push(createUploadSessionMutation, bindUploadMutation, discardUploadMutation)
    vi.mocked(uploadFileToUrl).mockResolvedValue('storage-1' as Id<'_storage'>)
    campaignMutationQueue.push(
      beginMapImageReplacement,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      updateMapImage,
    )
    const { result } = renderHook(() => useLiveGameMapSessionSource())
    const file = createImportFile(['map'], 'map.png', { type: 'image/png' })

    await expect(
      result.current.session.updateMapImage({
        file,
        mapId: 'map-1' as Id<'sidebarItems'>,
      }),
    ).resolves.toEqual({
      status: 'completed',
      receipt: {
        kind: 'mapImageUpdated',
        itemId: 'map-1',
        affectedCount: 1,
      },
    })

    expect(createUploadSessionMutation.mutateAsync).toHaveBeenCalledWith({})
    expect(uploadFileToUrl).toHaveBeenCalledWith(file, 'https://upload')
    expect(bindUploadMutation.mutateAsync).toHaveBeenCalledWith({
      sessionId: 'upload-session-1',
      storageId: 'storage-1',
      originalFileName: 'map.png',
    })
    expect(beginMapImageReplacement).toHaveBeenCalledWith({ mapId: 'map-1' })
    expect(updateMapImage).toHaveBeenCalledWith({
      layerId: null,
      mapId: 'map-1',
      replacementToken: 'replacement-1',
      uploadSessionId: 'upload-session-1',
    })
    expect(discardUploadMutation.mutateAsync).not.toHaveBeenCalled()
  })

  it('discards uploaded map image storage when the live update fails', async () => {
    const createUploadSessionMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        sessionId: 'upload-session-1',
        uploadUrl: 'https://upload',
      }),
    }
    const bindUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const discardUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const updateError = new Error('update failed')
    const beginMapImageReplacement = vi.fn().mockResolvedValue('replacement-1')
    const updateMapImage = vi.fn().mockRejectedValue(updateError)
    appMutationQueue.push(createUploadSessionMutation, bindUploadMutation, discardUploadMutation)
    vi.mocked(uploadFileToUrl).mockResolvedValue('storage-1' as Id<'_storage'>)
    campaignMutationQueue.push(
      beginMapImageReplacement,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      updateMapImage,
    )
    const { result } = renderHook(() => useLiveGameMapSessionSource())
    const file = createImportFile(['map'], 'map.png', { type: 'image/png' })

    await expect(
      result.current.session.updateMapImage({
        file,
        mapId: 'map-1' as Id<'sidebarItems'>,
      }),
    ).resolves.toEqual({ status: 'error', error: updateError })

    expect(discardUploadMutation.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'upload-session-1',
    })
  })

  it('discards an older map image upload when a newer replacement wins', async () => {
    const firstUpload = createDeferred<Id<'_storage'>>()
    const createUploadSessionMutation = {
      mutateAsync: vi
        .fn()
        .mockResolvedValueOnce({ sessionId: 'upload-session-1', uploadUrl: 'https://upload/1' })
        .mockResolvedValueOnce({ sessionId: 'upload-session-2', uploadUrl: 'https://upload/2' }),
    }
    const bindUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const discardUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const beginMapImageReplacement = vi
      .fn()
      .mockResolvedValueOnce('replacement-1')
      .mockResolvedValueOnce('replacement-2')
    const updateMapImage = vi.fn().mockResolvedValue(undefined)
    appMutationQueue.push(createUploadSessionMutation, bindUploadMutation, discardUploadMutation)
    vi.mocked(uploadFileToUrl)
      .mockImplementationOnce(() => firstUpload.promise)
      .mockResolvedValueOnce('storage-2' as Id<'_storage'>)
    campaignMutationQueue.push(
      beginMapImageReplacement,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      updateMapImage,
    )
    const { result } = renderHook(() => useLiveGameMapSessionSource())

    const firstUpdate = result.current.session.updateMapImage({
      file: createImportFile(['first'], 'first.png', { type: 'image/png' }),
      mapId: 'map-1' as Id<'sidebarItems'>,
    })
    await vi.waitFor(() => expect(uploadFileToUrl).toHaveBeenCalledOnce())
    const secondUpdate = await result.current.session.updateMapImage({
      file: createImportFile(['second'], 'second.png', { type: 'image/png' }),
      mapId: 'map-1' as Id<'sidebarItems'>,
    })
    firstUpload.resolve('storage-1' as Id<'_storage'>)

    await expect(firstUpdate).resolves.toEqual({
      status: 'unavailable',
      reason: 'stale_map_image',
    })
    expect(secondUpdate).toMatchObject({
      status: 'completed',
      receipt: { kind: 'mapImageUpdated' },
    })
    expect(updateMapImage).toHaveBeenCalledExactlyOnceWith({
      layerId: null,
      mapId: 'map-1',
      replacementToken: 'replacement-2',
      uploadSessionId: 'upload-session-2',
    })
    expect(discardUploadMutation.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'upload-session-1',
    })
  })
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
