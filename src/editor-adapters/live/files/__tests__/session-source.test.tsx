import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useLiveFileSessionAdapter } from '../session-source'
import { uploadFile as uploadFileToUrl } from '~/shared/uploads/upload-file'
import type { Id } from 'convex/_generated/dataModel'
import type { WizardEditorFileSessionReplaceInput } from '@wizard-archive/editor/adapter'
import { createFile } from '~/test/factories/sidebar-item-factory'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'

const updateFileStorageMock = vi.hoisted(() => vi.fn())
const appMutationQueue = vi.hoisted(() => [] as Array<{ mutateAsync: ReturnType<typeof vi.fn> }>)
const generatePdfPreviewIfNeededMock = vi.hoisted(() => vi.fn())
const handleErrorMock = vi.hoisted(() => vi.fn())

type LiveFileSessionImportFile = WizardEditorFileSessionReplaceInput['file']
type LiveFileSessionResolvedItem = Parameters<
  ReturnType<typeof useLiveFileSessionAdapter>['session']['resolveFile']
>[0]

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => appMutationQueue.shift() ?? { mutateAsync: vi.fn() },
}))

vi.mock('~/editor-adapters/live/previews/use-pdf-preview-upload', () => ({
  usePdfPreviewUpload: () => ({
    generatePdfPreviewIfNeeded: generatePdfPreviewIfNeededMock,
  }),
}))

vi.mock('~/shared/uploads/upload-file', () => ({
  uploadFile: vi.fn(),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: handleErrorMock,
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => ({ mutateAsync: updateFileStorageMock }),
}))

function createImportFile(
  parts: Array<BlobPart>,
  name: string,
  options: FilePropertyBag,
): LiveFileSessionImportFile {
  const file = new File(parts, name, options)
  return {
    name: file.name,
    contentType: file.type,
    size: file.size,
    arrayBuffer: () => file.arrayBuffer(),
    text: () => file.text(),
  }
}

function createLiveFileAdapterInput(overrides: { canReplaceFile?: boolean } = {}) {
  return {
    canReplaceFile: () => overrides.canReplaceFile ?? true,
    getItemById: (itemId: string) =>
      createFile({
        id: itemId as Id<'sidebarItems'>,
        downloadUrl: `https://download/${itemId}`,
        name: 'Current File',
      }),
  }
}

describe('useLiveFileSessionAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appMutationQueue.length = 0
    handleErrorMock.mockReset()
    generatePdfPreviewIfNeededMock.mockReset()
  })

  it('replaces file content through the live file session source', async () => {
    const createUploadSessionMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        sessionId: 'upload-session-1',
        uploadUrl: 'https://upload',
      }),
    }
    const bindUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const discardUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    appMutationQueue.push(createUploadSessionMutation, bindUploadMutation, discardUploadMutation)
    vi.mocked(uploadFileToUrl).mockResolvedValue('storage-1' as Id<'_storage'>)
    updateFileStorageMock.mockResolvedValue(undefined)
    const { result } = renderHook(() => useLiveFileSessionAdapter(createLiveFileAdapterInput()))
    const file = createImportFile(['updated'], 'updated.pdf', { type: 'application/pdf' })

    await expect(
      result.current.session.replaceFile({
        file,
        fileId: 'file-1' as Id<'sidebarItems'>,
      }),
    ).resolves.toEqual({
      status: 'completed',
      receipt: {
        kind: 'fileReplaced',
        itemId: 'file-1',
        affectedCount: 1,
      },
    })

    expect(createUploadSessionMutation.mutateAsync).toHaveBeenCalledWith({})
    expect(uploadFileToUrl).toHaveBeenCalledWith(file, 'https://upload')
    expect(bindUploadMutation.mutateAsync).toHaveBeenCalledWith({
      sessionId: 'upload-session-1',
      storageId: 'storage-1',
      originalFileName: 'updated.pdf',
    })
    expect(updateFileStorageMock).toHaveBeenCalledWith({
      fileId: 'file-1',
      uploadSessionId: 'upload-session-1',
    })
    expect(discardUploadMutation.mutateAsync).not.toHaveBeenCalled()
    expect(generatePdfPreviewIfNeededMock).toHaveBeenCalledWith(file, 'file-1')
  })

  it('logs rejected fire-and-forget preview generation after replacing a file', async () => {
    const createUploadSessionMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        sessionId: 'upload-session-1',
        uploadUrl: 'https://upload',
      }),
    }
    const bindUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const discardUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const previewError = new Error('preview failed')
    appMutationQueue.push(createUploadSessionMutation, bindUploadMutation, discardUploadMutation)
    vi.mocked(uploadFileToUrl).mockResolvedValue('storage-1' as Id<'_storage'>)
    updateFileStorageMock.mockResolvedValue(undefined)
    generatePdfPreviewIfNeededMock.mockRejectedValue(previewError)
    const { result } = renderHook(() => useLiveFileSessionAdapter(createLiveFileAdapterInput()))
    const file = createImportFile(['updated'], 'updated.pdf', { type: 'application/pdf' })

    await result.current.session.replaceFile({
      file,
      fileId: 'file-1' as Id<'sidebarItems'>,
    })
    await vi.waitFor(() => expect(handleErrorMock).toHaveBeenCalled())

    expect(handleErrorMock).toHaveBeenCalledWith(previewError, 'Failed to generate PDF preview')
  })

  it('initializes imported file content through live storage and preview services', async () => {
    const createUploadSessionMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        sessionId: 'upload-session-2',
        uploadUrl: 'https://upload',
      }),
    }
    const bindUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const discardUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    appMutationQueue.push(createUploadSessionMutation, bindUploadMutation, discardUploadMutation)
    updateFileStorageMock.mockResolvedValue(undefined)
    vi.mocked(uploadFileToUrl).mockResolvedValue('storage-2' as Id<'_storage'>)
    const { result } = renderHook(() => useLiveFileSessionAdapter(createLiveFileAdapterInput()))
    const file = createImportFile(['portrait'], 'portrait.png', { type: 'image/png' })
    const onProgress = vi.fn()

    await result.current.initializeImportedFile({
      file,
      fileId: 'file-2' as Id<'sidebarItems'>,
      onProgress,
    })

    expect(createUploadSessionMutation.mutateAsync).toHaveBeenCalledWith({})
    expect(uploadFileToUrl).toHaveBeenCalledWith(file, 'https://upload', { onProgress })
    expect(bindUploadMutation.mutateAsync).toHaveBeenCalledWith({
      sessionId: 'upload-session-2',
      storageId: 'storage-2',
      originalFileName: 'portrait.png',
    })
    expect(updateFileStorageMock).toHaveBeenCalledWith({
      fileId: 'file-2',
      uploadSessionId: 'upload-session-2',
    })
    expect(discardUploadMutation.mutateAsync).not.toHaveBeenCalled()
    expect(generatePdfPreviewIfNeededMock).toHaveBeenCalledWith(file, 'file-2')
  })

  it('discards uploaded file storage when the live storage update fails', async () => {
    const createUploadSessionMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        sessionId: 'upload-session-3',
        uploadUrl: 'https://upload',
      }),
    }
    const bindUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const discardUploadMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
    const updateError = new Error('update failed')
    appMutationQueue.push(createUploadSessionMutation, bindUploadMutation, discardUploadMutation)
    vi.mocked(uploadFileToUrl).mockResolvedValue('storage-3' as Id<'_storage'>)
    updateFileStorageMock.mockRejectedValue(updateError)
    const { result } = renderHook(() => useLiveFileSessionAdapter(createLiveFileAdapterInput()))
    const file = createImportFile(['updated'], 'updated.pdf', { type: 'application/pdf' })

    await expect(
      result.current.session.replaceFile({
        file,
        fileId: 'file-3' as Id<'sidebarItems'>,
      }),
    ).resolves.toEqual({ status: 'error', error: updateError })

    expect(discardUploadMutation.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'upload-session-3',
    })
    expect(generatePdfPreviewIfNeededMock).not.toHaveBeenCalled()
  })

  it('requires edit access to replace live file content', async () => {
    const { result } = renderHook(() =>
      useLiveFileSessionAdapter(createLiveFileAdapterInput({ canReplaceFile: false })),
    )
    const file = createImportFile(['updated'], 'updated.pdf', { type: 'application/pdf' })

    await expect(
      result.current.session.replaceFile({
        file,
        fileId: 'file-4' as Id<'sidebarItems'>,
      }),
    ).resolves.toMatchObject({
      status: 'error',
      error: { message: 'This workspace is read-only' },
    })

    expect(uploadFileToUrl).not.toHaveBeenCalled()
    expect(updateFileStorageMock).not.toHaveBeenCalled()
  })

  it('preserves attachment state when resolving live files without download urls', () => {
    const { result } = renderHook(() => useLiveFileSessionAdapter(createLiveFileAdapterInput()))

    expect(
      result.current.session.resolveFile(
        createFile({
          id: 'file-attached' as Id<'sidebarItems'>,
          assetId: generateDomainId(DOMAIN_ID_KIND.asset),
          downloadUrl: null,
          name: 'Broken handout',
        }) as LiveFileSessionResolvedItem,
      ),
    ).toMatchObject({
      reason: 'missing',
      status: 'unavailable',
    })
    expect(
      result.current.session.resolveFile(
        createFile({
          id: 'file-empty' as Id<'sidebarItems'>,
          assetId: null,
          downloadUrl: null,
          name: 'Empty handout',
        }) as LiveFileSessionResolvedItem,
      ),
    ).toMatchObject({
      status: 'unattached',
    })
  })
})
