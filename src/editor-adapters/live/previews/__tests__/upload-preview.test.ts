import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { uploadPreviewBlob } from '../upload-preview'
import type { Id } from 'convex/_generated/dataModel'

const MOCK_UPLOAD_URL = 'https://upload.example.com/upload'
const MOCK_SESSION_ID = 'upload-session-1' as Id<'fileStorage'>
const MOCK_STORAGE_ID = 'storage_abc123' as Id<'_storage'>
const MOCK_ITEM_ID = 'note_123' as Id<'sidebarItems'>
const MOCK_CLAIM_TOKEN = 'test-claim-token'

describe('uploadPreviewBlob', () => {
  let mockGenerateUploadUrl: () => Promise<{
    sessionId: Id<'fileStorage'>
    uploadUrl: string
  }>
  let mockSetPreviewImage: (args: {
    itemId: Id<'sidebarItems'>
    uploadSessionId: Id<'fileStorage'>
    claimToken: string
  }) => Promise<{ status: 'published' } | { status: 'stale' }>

  beforeEach(() => {
    mockGenerateUploadUrl = vi.fn().mockResolvedValue({
      sessionId: MOCK_SESSION_ID,
      uploadUrl: MOCK_UPLOAD_URL,
    })
    mockSetPreviewImage = vi.fn().mockResolvedValue({ status: 'published' })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ storageId: MOCK_STORAGE_ID }),
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uploads blob and passes the upload session to setPreviewImage', async () => {
    const blob = new Blob(['test'], { type: 'image/webp' })

    await uploadPreviewBlob(
      blob,
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
      MOCK_CLAIM_TOKEN,
    )

    expect(mockGenerateUploadUrl).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(MOCK_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'image/webp' },
      body: blob,
      signal: expect.any(AbortSignal),
    })
    expect(mockSetPreviewImage).toHaveBeenCalledWith({
      itemId: MOCK_ITEM_ID,
      uploadSessionId: MOCK_SESSION_ID,
      claimToken: MOCK_CLAIM_TOKEN,
    })
  })

  it('binds uploaded preview storage before publishing', async () => {
    const lifecycle = createStorageLifecycle()

    await uploadPreviewBlob(
      new Blob(['test'], { type: 'image/webp' }),
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
      MOCK_CLAIM_TOKEN,
      previewUploadOptions(lifecycle),
    )

    expect(lifecycle.bindUpload).toHaveBeenCalledExactlyOnceWith({
      sessionId: MOCK_SESSION_ID,
      storageId: MOCK_STORAGE_ID,
      originalFileName: 'preview-image.webp',
    })
    expect(lifecycle.discardUpload).not.toHaveBeenCalled()
  })

  it('discards uploaded preview storage when publication is stale', async () => {
    const lifecycle = createStorageLifecycle()
    mockSetPreviewImage = vi.fn().mockResolvedValue({ status: 'stale' })

    const result = await uploadPreviewBlob(
      new Blob(['test'], { type: 'image/webp' }),
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
      MOCK_CLAIM_TOKEN,
      previewUploadOptions(lifecycle),
    )

    expect(result).toEqual({ status: 'stale' })
    expect(lifecycle.discardUpload).toHaveBeenCalledExactlyOnceWith({
      sessionId: MOCK_SESSION_ID,
    })
  })

  it('discards uploaded preview storage when tracking fails', async () => {
    const lifecycle = createStorageLifecycle()
    const trackError = new Error('track failed')
    lifecycle.bindUpload.mockRejectedValue(trackError)

    await expect(
      uploadPreviewBlob(
        new Blob(['test'], { type: 'image/webp' }),
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
        previewUploadOptions(lifecycle),
      ),
    ).rejects.toThrow(trackError)

    expect(lifecycle.discardUpload).toHaveBeenCalledExactlyOnceWith({
      sessionId: MOCK_SESSION_ID,
    })
    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }),
    )

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
      ),
    ).rejects.toThrow('Preview upload failed: 500')

    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('uses fallback Content-Type for blob with empty type', async () => {
    const blob = new Blob(['test'])

    await uploadPreviewBlob(
      blob,
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
      MOCK_CLAIM_TOKEN,
    )

    expect(fetch).toHaveBeenCalledWith(
      MOCK_UPLOAD_URL,
      expect.objectContaining({
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
    )
  })

  it('throws when upload session creation fails', async () => {
    const error = new Error('URL generation failed')
    mockGenerateUploadUrl = vi.fn().mockRejectedValue(error)

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
      ),
    ).rejects.toThrow('URL generation failed')

    expect(fetch).not.toHaveBeenCalled()
    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('times out upload URL generation before starting the upload request', async () => {
    vi.useFakeTimers()
    mockGenerateUploadUrl = vi.fn(
      () => new Promise<{ sessionId: Id<'fileStorage'>; uploadUrl: string }>(() => undefined),
    )

    const upload = uploadPreviewBlob(
      new Blob(['test'], { type: 'image/webp' }),
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
      MOCK_CLAIM_TOKEN,
    )
    await vi.waitFor(() => expect(mockGenerateUploadUrl).toHaveBeenCalledOnce())

    const expectedRejection = expect(upload).rejects.toThrow('Preview upload timed out after 30s')
    await vi.advanceTimersByTimeAsync(30_000)
    await expectedRejection
    expect(fetch).not.toHaveBeenCalled()
    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('aborts upload URL generation when the preview signal aborts', async () => {
    const controller = new AbortController()
    mockGenerateUploadUrl = vi.fn(
      () => new Promise<{ sessionId: Id<'fileStorage'>; uploadUrl: string }>(() => undefined),
    )

    const upload = uploadPreviewBlob(
      new Blob(['test'], { type: 'image/webp' }),
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
      MOCK_CLAIM_TOKEN,
      { signal: controller.signal },
    )
    await vi.waitFor(() => expect(mockGenerateUploadUrl).toHaveBeenCalledOnce())
    controller.abort()

    await expect(upload).rejects.toThrow('Preview upload aborted')
    expect(fetch).not.toHaveBeenCalled()
    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('throws when setPreviewImage fails after successful upload', async () => {
    const error = new Error('setPreviewImage failed')
    mockSetPreviewImage = vi.fn().mockRejectedValue(error)
    const lifecycle = createStorageLifecycle()

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
        previewUploadOptions(lifecycle),
      ),
    ).rejects.toThrow('setPreviewImage failed')

    expect(fetch).toHaveBeenCalled()
    expect(mockSetPreviewImage).toHaveBeenCalledWith({
      itemId: MOCK_ITEM_ID,
      uploadSessionId: MOCK_SESSION_ID,
      claimToken: MOCK_CLAIM_TOKEN,
    })
    expect(lifecycle.discardUpload).toHaveBeenCalledExactlyOnceWith({
      sessionId: MOCK_SESSION_ID,
    })
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
      ),
    ).rejects.toThrow('Failed to fetch')

    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('throws when response JSON is missing storageId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    )

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
      ),
    ).rejects.toThrow('missing storageId')

    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('throws when response JSON is not an object', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      }),
    )

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
      ),
    ).rejects.toThrow('missing storageId')

    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('does not upload when the preview signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      uploadPreviewBlob(
        new Blob(['test'], { type: 'image/webp' }),
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
        { signal: controller.signal },
      ),
    ).rejects.toThrow('Preview upload aborted')

    expect(mockGenerateUploadUrl).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('does not publish when the preview signal aborts after upload', async () => {
    const controller = new AbortController()
    const lifecycle = createStorageLifecycle()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => {
          controller.abort()
          return Promise.resolve({ storageId: MOCK_STORAGE_ID })
        },
      }),
    )

    await expect(
      uploadPreviewBlob(
        new Blob(['test'], { type: 'image/webp' }),
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
        previewUploadOptions(lifecycle, controller.signal),
      ),
    ).rejects.toThrow('Preview upload aborted')

    expect(fetch).toHaveBeenCalled()
    expect(mockSetPreviewImage).not.toHaveBeenCalled()
    expect(lifecycle.discardUpload).toHaveBeenCalledExactlyOnceWith({
      sessionId: MOCK_SESSION_ID,
    })
  })

  it('throws on JSON parse error', async () => {
    const parseError = new SyntaxError('Unexpected token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(parseError),
      }),
    )

    const blob = new Blob(['test'], { type: 'image/webp' })

    const upload = uploadPreviewBlob(
      blob,
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
      MOCK_CLAIM_TOKEN,
    )

    await expect(upload).rejects.toMatchObject({
      message: 'Preview upload failed: invalid JSON response (status 200)',
      cause: parseError,
    })

    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('aborts upload requests after the preview upload timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Upload aborted', 'AbortError')),
            { once: true },
          )
        })
      }),
    )

    const upload = uploadPreviewBlob(
      new Blob(['test'], { type: 'image/webp' }),
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
      MOCK_CLAIM_TOKEN,
    )
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())

    const expectedRejection = expect(upload).rejects.toThrow('Preview upload timed out after 30s')
    await vi.advanceTimersByTimeAsync(30_000)
    await expectedRejection
    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })
})

function createStorageLifecycle() {
  return {
    bindUpload: vi.fn().mockResolvedValue(null),
    discardUpload: vi.fn().mockResolvedValue(null),
  }
}

function previewUploadOptions(
  storageLifecycle: ReturnType<typeof createStorageLifecycle>,
  signal?: AbortSignal,
) {
  return { signal, storageLifecycle }
}
