import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadPreviewBlob } from '../upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'

const MOCK_UPLOAD_URL = 'https://upload.example.com/upload'
const MOCK_STORAGE_ID = 'storage_abc123' as Id<'_storage'>
const MOCK_ITEM_ID = 'note_123' as SidebarItemId

describe('uploadPreviewBlob', () => {
  let mockGenerateUploadUrl: () => Promise<string>
  let mockSetPreviewImage: (args: {
    itemId: SidebarItemId
    previewStorageId: Id<'_storage'>
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

  it('uploads blob and calls setPreviewImage with returned storageId', async () => {
    const blob = new Blob(['test'], { type: 'image/webp' })

    await uploadPreviewBlob(
      blob,
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
    )

    expect(mockGenerateUploadUrl).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(MOCK_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'image/webp' },
      body: blob,
    })
    expect(mockSetPreviewImage).toHaveBeenCalledWith({
      itemId: MOCK_ITEM_ID,
      previewStorageId: MOCK_STORAGE_ID,
    })
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
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

  it('passes blob type as Content-Type header', async () => {
    const blob = new Blob(['test'], { type: 'image/png' })

    await uploadPreviewBlob(
      blob,
      mockGenerateUploadUrl,
      mockSetPreviewImage,
      MOCK_ITEM_ID,
    )

    expect(fetch).toHaveBeenCalledWith(
      MOCK_UPLOAD_URL,
      expect.objectContaining({
        headers: { 'Content-Type': 'image/png' },
      }),
    )
  })
})
