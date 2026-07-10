import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { useClaimAndUploadPreview } from '../use-claim-and-upload-preview'

const campaignMutationQueue = vi.hoisted(
  () => [] as Array<{ mutateAsync: ReturnType<typeof vi.fn> }>,
)
const appMutationQueue = vi.hoisted(() => [] as Array<{ mutateAsync: ReturnType<typeof vi.fn> }>)
const uploadPreviewBlobMock = vi.hoisted(() => vi.fn())

vi.mock('convex/_generated/api', () => ({
  api: {
    sidebarItems: {
      mutations: {
        claimPreviewGeneration: 'claimPreviewGeneration',
        setPreviewImage: 'setPreviewImage',
      },
    },
    storage: {
      mutations: {
        bindUpload: 'bindUpload',
        createUploadSession: 'createUploadSession',
        discardUpload: 'discardUpload',
      },
    },
  },
}))

vi.mock('../upload-preview', () => ({
  uploadPreviewBlob: (...args: Array<unknown>) => uploadPreviewBlobMock(...args),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => campaignMutationQueue.shift(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => appMutationQueue.shift(),
}))

const itemId = 'item_1' as Id<'sidebarItems'>

describe('useClaimAndUploadPreview', () => {
  beforeEach(() => {
    campaignMutationQueue.length = 0
    appMutationQueue.length = 0
    uploadPreviewBlobMock.mockReset()
  })

  it('returns not-claimed without rendering or uploading when the claim is declined', async () => {
    const claimPreview = mutation({ status: 'unavailable', reason: 'current' })
    const generate = vi.fn()
    queueMutations({ claimPreview })

    const { result } = renderHook(() => useClaimAndUploadPreview())

    await expect(result.current(itemId, generate)).resolves.toEqual({ status: 'not-claimed' })
    expect(generate).not.toHaveBeenCalled()
    expect(uploadPreviewBlobMock).not.toHaveBeenCalled()
  })

  it('returns stale without uploading when the preview signal aborts after claiming', async () => {
    const claimPreview = mutation({ status: 'claimed', claimToken: 'claim-1' })
    const controller = new AbortController()
    const generate = vi.fn(() => {
      controller.abort()
      return Promise.resolve(new Blob(['preview'], { type: 'image/webp' }))
    })
    queueMutations({ claimPreview })

    const { result } = renderHook(() => useClaimAndUploadPreview())

    await expect(result.current(itemId, generate, { signal: controller.signal })).resolves.toEqual({
      status: 'stale',
    })
    expect(uploadPreviewBlobMock).not.toHaveBeenCalled()
  })

  it('uploads a claimed preview through the storage lifecycle mutations', async () => {
    const claimPreview = mutation({ status: 'claimed', claimToken: 'claim-1' })
    const setPreviewImage = mutation({ status: 'published' })
    const createUploadSession = mutation({
      sessionId: 'upload-session-1',
      uploadUrl: 'https://upload.example',
    })
    const bindUpload = mutation(null)
    const discardUpload = mutation(null)
    const previewBlob = new Blob(['preview'], { type: 'image/webp' })
    const generate = vi.fn().mockResolvedValue(previewBlob)
    uploadPreviewBlobMock.mockResolvedValue({ status: 'published' })
    queueMutations({
      claimPreview,
      bindUpload,
      createUploadSession,
      discardUpload,
      setPreviewImage,
    })

    const { result } = renderHook(() => useClaimAndUploadPreview())

    await expect(result.current(itemId, generate)).resolves.toEqual({ status: 'success' })
    expect(uploadPreviewBlobMock).toHaveBeenCalledExactlyOnceWith(
      previewBlob,
      expect.any(Function),
      expect.any(Function),
      itemId,
      'claim-1',
      {
        signal: undefined,
        storageLifecycle: {
          bindUpload: expect.any(Function),
          discardUpload: expect.any(Function),
        },
      },
    )
  })

  it('returns stale when content changes before preview publication', async () => {
    const claimPreview = mutation({ status: 'claimed', claimToken: 'claim-1' })
    uploadPreviewBlobMock.mockResolvedValue({ status: 'stale' })
    queueMutations({ claimPreview })

    const { result } = renderHook(() => useClaimAndUploadPreview())

    await expect(
      result.current(itemId, () => Promise.resolve(new Blob(['preview']))),
    ).resolves.toEqual({ status: 'stale' })
  })

  it('returns error when upload publication fails', async () => {
    const claimPreview = mutation({ status: 'claimed', claimToken: 'claim-1' })
    const uploadError = new Error('upload failed')
    uploadPreviewBlobMock.mockRejectedValue(uploadError)
    queueMutations({ claimPreview })

    const { result } = renderHook(() => useClaimAndUploadPreview())

    await expect(
      result.current(itemId, () => Promise.resolve(new Blob(['preview']))),
    ).resolves.toEqual({
      status: 'error',
      error: uploadError,
    })
  })
})

function mutation(result: unknown) {
  return { mutateAsync: vi.fn().mockResolvedValue(result) }
}

function queueMutations({
  bindUpload = mutation(null),
  claimPreview = mutation({ status: 'claimed', claimToken: 'claim-1' }),
  createUploadSession = mutation({
    sessionId: 'upload-session-1',
    uploadUrl: 'https://upload.example',
  }),
  discardUpload = mutation(null),
  setPreviewImage = mutation({ status: 'published' }),
}: {
  bindUpload?: ReturnType<typeof mutation>
  claimPreview?: ReturnType<typeof mutation>
  createUploadSession?: ReturnType<typeof mutation>
  discardUpload?: ReturnType<typeof mutation>
  setPreviewImage?: ReturnType<typeof mutation>
}) {
  campaignMutationQueue.push(claimPreview, setPreviewImage)
  appMutationQueue.push(createUploadSession, bindUpload, discardUpload)
}
