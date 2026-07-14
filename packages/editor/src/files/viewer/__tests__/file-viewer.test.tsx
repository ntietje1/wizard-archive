import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { FileViewer } from '../viewer'
import type { FileViewerSource } from '../source'
import type { FileItemWithContent } from '../../item-contract'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'

const { fileContentViewerMock, fileUploadEmptyStateMock, replaceFileMock, toastError } = vi.hoisted(
  () => ({
    fileContentViewerMock: vi.fn(),
    fileUploadEmptyStateMock: vi.fn(),
    replaceFileMock: vi.fn(),
    toastError: vi.fn(),
  }),
)

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: vi.fn(),
  },
}))

vi.mock('../content-viewer', () => ({
  FileContentViewer: (props: Record<string, unknown>) => {
    fileContentViewerMock(props)
    return <div data-testid="file-content-viewer" />
  },
}))

vi.mock('@wizard-archive/ui/file-upload/empty-state', () => ({
  FileUploadEmptyState: (props: Record<string, unknown>) => {
    fileUploadEmptyStateMock(props)
    return <div data-testid="empty-file-upload" />
  },
}))

describe('FileViewer', () => {
  beforeEach(() => {
    fileContentViewerMock.mockClear()
    fileUploadEmptyStateMock.mockClear()
    replaceFileMock.mockReset()
    toastError.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders file content from the configured source and delegates replacement', async () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileItemWithContent
    const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })
    const source = createTestFileViewerSource({
      resolveFile: () => ({
        allowObjectUrl: true,
        contentType: 'text/plain',
        downloadUrl: 'blob:handout',
        name: 'Handout.txt',
        size: 12,
        status: 'available',
      }),
      replaceFile: replaceFileMock,
    })

    renderFileViewer(file, source)

    expect(screen.getByTestId('file-content-viewer')).toBeInTheDocument()
    expect(fileContentViewerMock).toHaveBeenCalledWith({
      allowDataUrl: false,
      allowObjectUrl: true,
      contentType: 'text/plain',
      downloadUrl: 'blob:handout',
      name: 'Handout.txt',
    })
    expect(screen.getByText('text/plain · 12 B')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'blob:handout')
    expect(screen.getByLabelText('Choose file replacement')).toHaveAttribute(
      'accept',
      expect.stringContaining('application/pdf'),
    )
    expect(screen.getByLabelText('Choose file replacement')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByLabelText('Choose file replacement')).not.toBeDisabled()

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [replacement] },
    })

    await waitFor(() => {
      expect(replaceFileMock).toHaveBeenCalledWith({
        fileId: file.id,
        file: expect.objectContaining({
          contentType: 'text/plain',
          name: 'new-clues.txt',
          size: replacement.size,
        }),
      })
    })
  })

  it('surfaces synchronously thrown replacement failures', async () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileItemWithContent
    const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })
    replaceFileMock.mockImplementationOnce(() => {
      throw new Error('Upload failed')
    })
    const source = createTestFileViewerSource({
      resolveFile: () => ({
        allowObjectUrl: true,
        contentType: 'text/plain',
        downloadUrl: 'blob:handout',
        name: 'Handout.txt',
        size: 12,
        status: 'available',
      }),
      replaceFile: replaceFileMock,
    })

    renderFileViewer(file, source)

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [replacement] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to replace file')
  })

  it('hides the download action when the resolved file URL is unsafe', () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileItemWithContent
    const source = createTestFileViewerSource({
      resolveFile: () => ({
        allowObjectUrl: false,
        contentType: 'text/plain',
        downloadUrl: 'http://example.test/handout.txt',
        name: 'Handout.txt',
        size: 12,
        status: 'available',
      }),
    })

    renderFileViewer(file, source)

    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull()
    expect(screen.getByTestId('file-content-viewer')).toBeInTheDocument()
  })

  it('allows trusted resolved data URLs for local files', () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileItemWithContent
    const source = createTestFileViewerSource({
      resolveFile: () => ({
        allowDataUrl: true,
        allowObjectUrl: false,
        contentType: 'text/plain',
        downloadUrl: 'data:text/plain,hello',
        name: 'Handout.txt',
        size: 5,
        status: 'available',
      }),
    })

    renderFileViewer(file, source)

    expect(fileContentViewerMock).toHaveBeenCalledWith({
      allowDataUrl: true,
      allowObjectUrl: false,
      contentType: 'text/plain',
      downloadUrl: 'data:text/plain,hello',
      name: 'Handout.txt',
    })
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      'data:text/plain,hello',
    )
  })

  it('surfaces replacement failures instead of dropping them silently', async () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileItemWithContent
    const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })
    replaceFileMock.mockRejectedValueOnce(new Error('Upload failed'))
    const source = createTestFileViewerSource({
      resolveFile: () => ({
        allowObjectUrl: true,
        contentType: 'text/plain',
        downloadUrl: 'blob:handout',
        name: 'Handout.txt',
        size: 12,
        status: 'available',
      }),
      replaceFile: replaceFileMock,
    })

    renderFileViewer(file, source)

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [replacement] },
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to replace file')
    })
  })

  it('clears stale replacement errors when the selected file changes', async () => {
    const firstFile = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'First handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileItemWithContent
    const secondFile = createFileFixture({
      id: 'file-2' as FileItemWithContent['id'],
      name: 'Second handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileItemWithContent
    const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })
    replaceFileMock.mockRejectedValueOnce(new Error('Upload failed'))
    const source = createTestFileViewerSource({
      resolveFile: (file) => ({
        allowObjectUrl: true,
        contentType: 'text/plain',
        downloadUrl: `blob:${file.id}`,
        name: file.name,
        size: 12,
        status: 'available',
      }),
      replaceFile: replaceFileMock,
    })

    const { rerender } = renderFileViewer(firstFile, source)

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [replacement] },
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to replace file')
    })

    rerender(<FileViewer item={secondFile} source={source} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables the hidden replacement input while replacement is in progress', async () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileItemWithContent
    const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })
    replaceFileMock.mockReturnValue(new Promise(() => undefined))
    const source = createTestFileViewerSource({
      resolveFile: () => ({
        allowObjectUrl: true,
        contentType: 'text/plain',
        downloadUrl: 'blob:handout',
        name: 'Handout.txt',
        size: 12,
        status: 'available',
      }),
      replaceFile: replaceFileMock,
    })

    renderFileViewer(file, source)

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [replacement] },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Choose file replacement')).toBeDisabled()
    })
  })

  it('recovers when replacement never settles', async () => {
    vi.useFakeTimers()
    try {
      const file = createFileFixture({
        id: 'file-1' as FileItemWithContent['id'],
        name: 'Handout',
        downloadUrl: null,
        contentType: 'text/plain',
      }) as FileItemWithContent
      const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })
      replaceFileMock.mockReturnValue(new Promise(() => undefined))
      const source = createTestFileViewerSource({
        resolveFile: () => ({
          allowObjectUrl: true,
          contentType: 'text/plain',
          downloadUrl: 'blob:handout',
          name: 'Handout.txt',
          size: 12,
          status: 'available',
        }),
        replaceFile: replaceFileMock,
      })

      renderFileViewer(file, source)

      fireEvent.change(screen.getByLabelText('Choose file replacement'), {
        target: { files: [replacement] },
      })

      expect(screen.getByLabelText('Choose file replacement')).toBeDisabled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to replace file')
      expect(screen.getByLabelText('Choose file replacement')).not.toBeDisabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders the empty file upload state and delegates selected files to replacement', async () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: null,
    }) as FileItemWithContent
    const source = createTestFileViewerSource({
      replaceFile: replaceFileMock,
      resolveFile: () => ({
        allowObjectUrl: false,
        contentType: null,
        downloadUrl: null,
        name: 'Handout',
        size: null,
        status: 'unattached',
      }),
    })

    renderFileViewer(file, source)

    expect(screen.getByTestId('empty-file-upload')).toBeInTheDocument()
    expect(fileUploadEmptyStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUpload: expect.objectContaining({
          file: null,
          fileMetadata: null,
          handleFileSelect: expect.any(Function),
          isDragActive: false,
          isUploading: false,
          preview: '',
          uploadError: '',
          uploadProgress: { percentage: 0 },
        }),
        title: 'Upload File',
        isSubmitting: false,
      }),
    )
    const uploadProps = fileUploadEmptyStateMock.mock.calls[0]?.[0] as {
      fileUpload: { handleFileSelect: (file: File) => unknown }
    }
    const selectedFile = new File(['new'], 'new.txt', { type: 'text/plain' })

    act(() => {
      uploadProps.fileUpload.handleFileSelect(selectedFile)
    })

    await waitFor(() => {
      expect(replaceFileMock).toHaveBeenCalledWith({
        fileId: file.id,
        file: expect.objectContaining({
          contentType: 'text/plain',
          name: 'new.txt',
          size: selectedFile.size,
        }),
      })
    })
  })

  it('distinguishes attached files whose URL cannot be resolved from empty file slots', () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      assetId: 'storage-1' as FileItemWithContent['assetId'],
      name: 'Handout',
      downloadUrl: null,
      contentType: 'application/pdf',
    }) as FileItemWithContent
    const source = createTestFileViewerSource({
      canReplaceFile: () => false,
      resolveFile: () => ({
        allowObjectUrl: false,
        contentType: 'application/pdf',
        downloadUrl: null,
        name: 'Handout.pdf',
        reason: 'missing',
        size: null,
        status: 'unavailable',
      }),
    })

    renderFileViewer(file, source)

    expect(screen.queryByText('No file has been attached.')).not.toBeInTheDocument()
    expect(screen.getByText('File unavailable')).toBeInTheDocument()
  })

  it('reports duplicate empty-file uploads while replacement is in progress', () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: null,
    }) as FileItemWithContent
    replaceFileMock.mockReturnValue(new Promise(() => undefined))
    const source = createTestFileViewerSource({
      replaceFile: replaceFileMock,
      resolveFile: () => ({
        allowObjectUrl: false,
        contentType: null,
        downloadUrl: null,
        name: 'Handout',
        size: null,
        status: 'unattached',
      }),
    })

    renderFileViewer(file, source)

    const uploadProps = fileUploadEmptyStateMock.mock.calls[0]?.[0] as {
      fileUpload: { handleFileSelect: (file: File) => unknown }
    }
    const firstFile = new File(['new'], 'new.txt', { type: 'text/plain' })
    const secondFile = new File(['newer'], 'newer.txt', { type: 'text/plain' })
    let result: unknown

    act(() => {
      uploadProps.fileUpload.handleFileSelect(firstFile)
      result = uploadProps.fileUpload.handleFileSelect(secondFile)
    })

    expect(result).toEqual({
      valid: false,
      error: 'File upload already in progress',
    })
  })

  it('surfaces empty-file upload validation failures through state and toast', () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: null,
    }) as FileItemWithContent
    const source = createTestFileViewerSource({
      replaceFile: replaceFileMock,
      resolveFile: () => ({
        allowObjectUrl: false,
        contentType: null,
        downloadUrl: null,
        name: 'Handout',
        size: null,
        status: 'unattached',
      }),
    })

    renderFileViewer(file, source)

    const uploadProps = fileUploadEmptyStateMock.mock.calls[0]?.[0] as {
      fileUpload: { handleFileSelect: (file: File) => unknown }
    }
    const oversizedFile = createFileWithSize('huge.pdf', 'application/pdf', 101 * 1024 * 1024)
    let result: unknown

    act(() => {
      result = uploadProps.fileUpload.handleFileSelect(oversizedFile)
    })

    expect(result).toEqual({
      valid: false,
      error: 'File must be less than 100MB',
    })
    expect(toastError).toHaveBeenCalledWith('File must be less than 100MB')
    expect(fileUploadEmptyStateMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        fileUpload: expect.objectContaining({
          uploadError: 'File must be less than 100MB',
        }),
      }),
    )
    expect(replaceFileMock).not.toHaveBeenCalled()
  })

  it('clears stale empty-file upload state when replacement fails', async () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: null,
    }) as FileItemWithContent
    replaceFileMock.mockRejectedValueOnce(new Error('Upload failed'))
    const source = createTestFileViewerSource({
      replaceFile: replaceFileMock,
      resolveFile: () => ({
        allowObjectUrl: false,
        contentType: null,
        downloadUrl: null,
        name: 'Handout',
        size: null,
        status: 'unattached',
      }),
    })

    renderFileViewer(file, source)

    const firstUploadProps = fileUploadEmptyStateMock.mock.calls[0]?.[0] as {
      fileUpload: { handleFileSelect: (file: File) => unknown }
    }
    const selectedFile = new File(['new'], 'new.txt', { type: 'text/plain' })
    act(() => {
      firstUploadProps.fileUpload.handleFileSelect(selectedFile)
    })

    await waitFor(() => {
      const latestUploadProps = fileUploadEmptyStateMock.mock.calls.at(-1)?.[0] as {
        fileUpload: {
          file: File | null
          fileMetadata: unknown
          isUploading: boolean
          preview: string
        }
      }
      expect(latestUploadProps.fileUpload).toEqual(
        expect.objectContaining({
          file: null,
          fileMetadata: null,
          isUploading: false,
          preview: '',
        }),
      )
    })
  })

  it('clears stale empty-file upload state when the selected empty file changes', async () => {
    const firstFile = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'First handout',
      downloadUrl: null,
      contentType: null,
    }) as FileItemWithContent
    const secondFile = createFileFixture({
      id: 'file-2' as FileItemWithContent['id'],
      name: 'Second handout',
      downloadUrl: null,
      contentType: null,
    }) as FileItemWithContent
    replaceFileMock.mockReturnValue(new Promise(() => undefined))
    const source = createTestFileViewerSource({
      replaceFile: replaceFileMock,
      resolveFile: () => ({
        allowObjectUrl: false,
        contentType: null,
        downloadUrl: null,
        name: 'Handout',
        size: null,
        status: 'unattached',
      }),
    })

    const { rerender } = renderFileViewer(firstFile, source)

    const firstUploadProps = fileUploadEmptyStateMock.mock.calls[0]?.[0] as {
      fileUpload: { handleFileSelect: (file: File) => unknown }
    }
    act(() => {
      firstUploadProps.fileUpload.handleFileSelect(
        new File(['new'], 'new.txt', { type: 'text/plain' }),
      )
    })

    await waitFor(() => {
      expect(fileUploadEmptyStateMock.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          fileUpload: expect.objectContaining({
            isUploading: true,
            preview: 'new.txt',
          }),
        }),
      )
    })

    rerender(<FileViewer item={secondFile} source={source} />)

    expect(fileUploadEmptyStateMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        fileUpload: expect.objectContaining({
          file: null,
          isUploading: false,
          preview: '',
        }),
      }),
    )
  })

  it('delegates dropped empty-file uploads to replacement', () => {
    const file = createFileFixture({
      id: 'file-1' as FileItemWithContent['id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: null,
    }) as FileItemWithContent
    const source = createTestFileViewerSource({
      replaceFile: replaceFileMock,
      resolveFile: () => ({
        allowObjectUrl: false,
        contentType: null,
        downloadUrl: null,
        name: 'Handout',
        size: null,
        status: 'unattached',
      }),
    })

    renderFileViewer(file, source)

    const uploadProps = fileUploadEmptyStateMock.mock.calls[0]?.[0] as {
      fileUpload: { handleDrop: (event: React.DragEvent<HTMLDivElement>) => void }
    }
    const droppedFile = new File(['dropped'], 'dropped.txt', { type: 'text/plain' })
    act(() => {
      uploadProps.fileUpload.handleDrop({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: { files: [droppedFile] },
      } as unknown as React.DragEvent<HTMLDivElement>)
    })

    expect(replaceFileMock).toHaveBeenCalledWith({
      fileId: file.id,
      file: expect.objectContaining({
        contentType: 'text/plain',
        name: 'dropped.txt',
        size: droppedFile.size,
      }),
    })
  })
})

function createTestFileViewerSource(overrides: Partial<FileViewerSource> = {}): FileViewerSource {
  return {
    canReplaceFile: () => true,
    replaceFile: ({ fileId }) => ({
      status: 'completed',
      receipt: { kind: 'fileReplaced', itemId: fileId, affectedCount: 1 },
    }),
    resolveFile: () => ({
      allowObjectUrl: false,
      contentType: null,
      downloadUrl: null,
      name: 'File',
      size: null,
      status: 'unattached',
    }),
    ...overrides,
  }
}

function renderFileViewer(file: FileItemWithContent, source: FileViewerSource) {
  return render(<FileViewer item={file} source={source} />)
}

function createFileWithSize(name: string, type: string, size: number) {
  const file = new File(['content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

type FileFixtureOverrides = Partial<Omit<FileItemWithContent, 'name'>> & {
  name?: string
}

function createFileFixture(overrides: FileFixtureOverrides = {}): FileItemWithContent {
  const { name = 'Handout', ...rest } = overrides
  return {
    createdAt: 0,
    id: 'file-1' as FileItemWithContent['id'],
    allPermissionLevel: null,
    ancestors: [],
    campaignId: 'campaign-1' as FileItemWithContent['campaignId'],
    color: null,
    contentType: null,
    createdBy: 'user-1' as FileItemWithContent['createdBy'],
    deletedBy: null,
    deletionTime: null,
    downloadUrl: null,
    iconName: null,
    isActive: true,
    isBookmarked: false,
    isTrashed: false,
    location: RESOURCE_LOCATION.sidebar,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    name: name as FileItemWithContent['name'],
    parentId: null,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    status: RESOURCE_STATUS.active,
    assetId: null,
    type: RESOURCE_TYPES.files,
    updatedBy: null,
    updatedTime: null,
    ...rest,
  }
}
