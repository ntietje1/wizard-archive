import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadPreviewBlob } from '../upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'

const MOCK_UPLOAD_URL = 'https://upload.example.com/upload'
const MOCK_STORAGE_ID = 'storage_abc123' as Id<'_storage'>
const MOCK_ITEM_ID = 'note_123' as SidebarItemId
const MOCK_CLAIM_TOKEN = 'test-claim-token'

describe('uploadPreviewBlob', () => {
  let mockGenerateUploadUrl: () => Promise<string>
  let mockSetPreviewImage: (args: {
    itemId: SidebarItemId
    previewStorageId: Id<'_storage'>
    claimToken: string
  }) => Promise<null>

  beforeEach(() => {
    mockGenerateUploadUrl = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue(MOCK_UPLOAD_URL)
    mockSetPreviewImage = vi.fn().mockResolvedValue(null)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ storageId: MOCK_STORAGE_ID }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uploads blob and calls setPreviewImage with returned storageId', async () => {
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
      previewStorageId: MOCK_STORAGE_ID,
      claimToken: MOCK_CLAIM_TOKEN,
    })
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

  it('throws when generateUploadUrl fails', async () => {
    const error = new Error('URL generation failed')
    mockGenerateUploadUrl = vi.fn().mockRejectedValue(error)

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
      ),
    ).rejects.toThrow('URL generation failed')

    expect(fetch).not.toHaveBeenCalled()
    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('throws when setPreviewImage fails after successful upload', async () => {
    const error = new Error('setPreviewImage failed')
    mockSetPreviewImage = vi.fn().mockRejectedValue(error)

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
        MOCK_CLAIM_TOKEN,
      ),
    ).rejects.toThrow('setPreviewImage failed')

    expect(fetch).toHaveBeenCalled()
    expect(mockSetPreviewImage).toHaveBeenCalledWith({
      itemId: MOCK_ITEM_ID,
      previewStorageId: MOCK_STORAGE_ID,
      claimToken: MOCK_CLAIM_TOKEN,
    })
  })

  it('throws on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
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
      ),
    ).rejects.toThrow('missing storageId')

    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })

  it('throws on JSON parse error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      }),
    )

    const blob = new Blob(['test'], { type: 'image/webp' })

    await expect(
      uploadPreviewBlob(
        blob,
        mockGenerateUploadUrl,
        mockSetPreviewImage,
        MOCK_ITEM_ID,
      ),
    ).rejects.toThrow('Preview upload failed: invalid JSON response')

    expect(mockSetPreviewImage).not.toHaveBeenCalled()
  })
})
