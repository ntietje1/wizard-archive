import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { toast } from 'sonner'
import { createFolder } from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { createWorkspaceEmbedTargetOperations } from '../target-operations'
import { createResourceCatalogModel } from '../../filesystem/catalog'
import type { FileSystemLoadState } from '../../filesystem/load-state'

const mocks = vi.hoisted(() => ({
  importFile: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
  },
}))

function createReadyFileSystemLoadState(): FileSystemLoadState {
  return {
    activeStatus: 'success',
    activeError: null,
    refreshActive: () => Promise.resolve(),
    refreshTrash: () => Promise.resolve(),
    trashError: null,
    trashStatus: 'success',
  }
}

describe('createWorkspaceEmbedTargetOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.importFile.mockResolvedValue({
      status: 'imported',
      kind: 'file',
      fileName: 'portrait.png',
      result: {
        id: testId<'sidebarItems'>('file-1'),
        slug: 'portrait',
      },
    })
  })

  it('imports embed files through the workspace filesystem as file-only imports', async () => {
    const filesystem = createFileSystem()
    const operations = createWorkspaceEmbedTargetOperations(filesystem)
    if (!operations?.uploadFile) {
      throw new Error('Expected embed upload operation')
    }
    const uploadFile = operations.uploadFile
    const file = new File(['image'], 'portrait.png', { type: 'image/png' })

    let uploaded: Awaited<ReturnType<typeof uploadFile>> | undefined
    await act(async () => {
      uploaded = await uploadFile(file)
    })

    expect(mocks.importFile).toHaveBeenCalledWith({
      file: expect.objectContaining({
        contentType: 'image/png',
        name: 'portrait.png',
        size: 5,
      }),
      parentId: testId<'sidebarItems'>('assets'),
      acceptedKinds: ['file'],
      onProgress: expect.any(Function),
    })
    expect(uploaded).toEqual({ status: 'completed', itemId: testId<'sidebarItems'>('file-1') })
  })

  it('does not expose upload operations when the filesystem cannot edit', () => {
    expect(createWorkspaceEmbedTargetOperations(createFileSystem({ canEdit: false }))).toBe(
      undefined,
    )
  })

  it('returns an explicit skipped result and reports skipped embed file imports', async () => {
    mocks.importFile.mockResolvedValueOnce({
      status: 'skipped',
      fileName: 'portrait.svg',
      reason: 'unsupported',
      error: 'Unsupported file type',
    })
    const uploadFile = requireUploadFile(createWorkspaceEmbedTargetOperations(createFileSystem()))

    let uploaded: Awaited<ReturnType<typeof uploadFile>> | undefined
    await act(async () => {
      uploaded = await uploadFile(new File(['image'], 'portrait.svg', { type: 'image/svg+xml' }))
    })

    expect(uploaded).toEqual({
      status: 'skipped',
      reason: 'unsupported',
      error: 'Unsupported file type',
    })
    expect(toast.error).toHaveBeenCalled()
  })

  it('reports unavailable skipped embed file imports with an unavailable fallback', async () => {
    mocks.importFile.mockResolvedValueOnce({
      status: 'skipped',
      fileName: 'portrait.png',
      reason: 'unavailable',
    })
    const uploadFile = requireUploadFile(createWorkspaceEmbedTargetOperations(createFileSystem()))

    let uploaded: Awaited<ReturnType<typeof uploadFile>> | undefined
    await act(async () => {
      uploaded = await uploadFile(new File(['image'], 'portrait.png', { type: 'image/png' }))
    })

    expect(uploaded).toEqual({
      status: 'skipped',
      reason: 'unavailable',
    })
    expect(toast.error).toHaveBeenCalled()
    expect(getToastContentMessage()).toBe('Destination unavailable')
  })

  it('returns an explicit failed result and reports failed embed file imports', async () => {
    mocks.importFile.mockRejectedValueOnce(new Error('Upload failed'))
    const uploadFile = requireUploadFile(createWorkspaceEmbedTargetOperations(createFileSystem()))

    let uploaded: Awaited<ReturnType<typeof uploadFile>> | undefined
    await act(async () => {
      uploaded = await uploadFile(new File(['image'], 'portrait.png', { type: 'image/png' }))
    })

    expect(uploaded).toMatchObject({ status: 'skipped', reason: 'failed' })
    expect(toast.error).toHaveBeenCalled()
  })

  it('preserves failed import command results for embed uploads', async () => {
    const error = new Error('Write failed')
    mocks.importFile.mockResolvedValueOnce({
      status: 'skipped',
      fileName: 'portrait.png',
      reason: 'failed',
      error,
    })
    const uploadFile = requireUploadFile(createWorkspaceEmbedTargetOperations(createFileSystem()))

    let uploaded: Awaited<ReturnType<typeof uploadFile>> | undefined
    await act(async () => {
      uploaded = await uploadFile(new File(['image'], 'portrait.png', { type: 'image/png' }))
    })

    expect(uploaded).toEqual({
      status: 'skipped',
      reason: 'failed',
      error,
    })
    expect(toast.error).toHaveBeenCalled()
  })

  it('returns an explicit unsupported result when import returns a non-file item', async () => {
    mocks.importFile.mockResolvedValueOnce({
      status: 'imported',
      kind: 'folder',
      fileName: 'reference-folder',
      result: {
        id: testId<'sidebarItems'>('folder-1'),
        slug: 'reference-folder',
      },
    })
    const uploadFile = requireUploadFile(createWorkspaceEmbedTargetOperations(createFileSystem()))

    let uploaded: Awaited<ReturnType<typeof uploadFile>> | undefined
    await act(async () => {
      uploaded = await uploadFile(new File(['image'], 'portrait.png', { type: 'image/png' }))
    })

    expect(uploaded).toEqual({ status: 'skipped', reason: 'unsupported' })
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it('uses separate upload toast ids for concurrent files with the same name', async () => {
    mocks.importFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                status: 'imported',
                kind: 'file',
                fileName: 'portrait.png',
                result: {
                  id: testId<'sidebarItems'>('file-1'),
                  slug: 'portrait',
                },
              }),
            0,
          )
        }),
    )
    const uploadFile = requireUploadFile(createWorkspaceEmbedTargetOperations(createFileSystem()))

    const firstUpload = uploadFile(new File(['first'], 'portrait.png', { type: 'image/png' }))
    const secondUpload = uploadFile(new File(['second'], 'portrait.png', { type: 'image/png' }))

    await waitFor(() => expect(mocks.importFile).toHaveBeenCalledTimes(2))

    const firstProgress = mocks.importFile.mock.calls[0]?.[0].onProgress
    const secondProgress = mocks.importFile.mock.calls[1]?.[0].onProgress
    firstProgress?.({ fileName: 'portrait.png', percentage: 20 })
    secondProgress?.({ fileName: 'portrait.png', percentage: 40 })

    expect(toast.loading).toHaveBeenCalledTimes(2)
    const firstToastId = vi.mocked(toast.loading).mock.calls[0]?.[1]?.id
    const secondToastId = vi.mocked(toast.loading).mock.calls[1]?.[1]?.id
    expect(firstToastId).toEqual(expect.stringContaining('portrait.png'))
    expect(secondToastId).toEqual(expect.stringContaining('portrait.png'))
    expect(firstToastId).not.toBe(secondToastId)

    await act(async () => {
      await Promise.all([firstUpload, secondUpload])
    })
  })
})

function requireUploadFile(operations: ReturnType<typeof createWorkspaceEmbedTargetOperations>) {
  if (!operations?.uploadFile) {
    throw new Error('Expected embed upload operation')
  }
  return operations.uploadFile
}

function getToastContentMessage() {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0]
  return typeof content === 'object' && content && 'props' in content
    ? (content.props as { message?: unknown }).message
    : undefined
}

function createFileSystem({ canEdit = true }: { canEdit?: boolean } = {}) {
  const assets = createFolder({
    id: testId<'sidebarItems'>('assets'),
    name: 'Assets',
    parentId: null,
  })
  const catalog = createResourceCatalogModel({
    activeItems: [assets],
    trashItems: [],
  }).catalog

  return {
    catalog,
    load: createReadyFileSystemLoadState(),
    operations: {
      createItem: vi.fn(),
      importFile: mocks.importFile,
    },
    permissions: {
      canEdit,
    },
  }
}
