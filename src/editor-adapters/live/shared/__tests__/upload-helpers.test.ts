import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { uploadToStorage } from '../upload-helpers'

const uploadFileMock = vi.hoisted(() => vi.fn())

vi.mock('~/shared/uploads/upload-file', () => ({
  uploadFile: uploadFileMock,
}))

describe('uploadToStorage', () => {
  beforeEach(() => {
    uploadFileMock.mockReset()
  })

  it('discards the server-issued session when the upload request fails', async () => {
    const uploadError = new Error('upload failed')
    const mutations = createUploadMutations()
    uploadFileMock.mockRejectedValue(uploadError)

    await expect(uploadToStorage(createUploadFile(), mutations)).rejects.toBe(uploadError)

    expect(mutations.discardUpload.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'upload-session-1',
    })
    expect(mutations.bindUpload.mutateAsync).not.toHaveBeenCalled()
  })

  it('returns the bound upload session without committing it', async () => {
    const storageId = 'storage-1' as Id<'_storage'>
    const mutations = createUploadMutations()
    uploadFileMock.mockResolvedValue(storageId)

    await expect(uploadToStorage(createUploadFile(), mutations)).resolves.toEqual({
      sessionId: 'upload-session-1',
      storageId,
    })

    expect(mutations.bindUpload.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      originalFileName: 'handout.txt',
      sessionId: 'upload-session-1',
      storageId,
    })
    expect(mutations.discardUpload.mutateAsync).not.toHaveBeenCalled()
  })

  it('discards uploaded storage and preserves the track failure', async () => {
    const storageId = 'storage-1' as Id<'_storage'>
    const trackError = new Error('bind failed')
    const mutations = createUploadMutations()
    uploadFileMock.mockResolvedValue(storageId)
    mutations.bindUpload.mutateAsync.mockRejectedValue(trackError)

    await expect(uploadToStorage(createUploadFile(), mutations)).rejects.toBe(trackError)

    expect(mutations.discardUpload.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'upload-session-1',
    })
  })

  it('preserves the bind failure when discard also fails', async () => {
    const storageId = 'storage-1' as Id<'_storage'>
    const bindError = new Error('bind failed')
    const mutations = createUploadMutations()
    uploadFileMock.mockResolvedValue(storageId)
    mutations.bindUpload.mutateAsync.mockRejectedValue(bindError)
    mutations.discardUpload.mutateAsync.mockRejectedValue(new Error('discard failed'))

    await expect(uploadToStorage(createUploadFile(), mutations)).rejects.toBe(bindError)
  })
})

function createUploadFile() {
  return {
    arrayBuffer: vi.fn(),
    name: 'handout.txt',
    type: 'text/plain',
  }
}

function createUploadMutations() {
  return {
    bindUpload: { mutateAsync: vi.fn().mockResolvedValue(null) },
    createUploadSession: {
      mutateAsync: vi.fn().mockResolvedValue({
        sessionId: 'upload-session-1',
        uploadUrl: 'https://upload.example',
      }),
    },
    discardUpload: { mutateAsync: vi.fn().mockResolvedValue(null) },
  }
}
