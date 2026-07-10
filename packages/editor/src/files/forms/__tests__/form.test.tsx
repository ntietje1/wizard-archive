import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { assertResourceItemColor, assertResourceItemSlug } from '../../../workspace/items'
import type { ValidationResult } from '../../../workspace/items'
import { createFile } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import { FileForm } from '../form'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import type { FileFormEditState, FileFormSource } from '../source'
import type { SidebarItemId } from '../../../../../../shared/common/ids'

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}))

vi.mock('@wizard-archive/ui/file-upload/section', () => ({
  FileUploadSection: ({ isSubmitting }: { isSubmitting: boolean }) => (
    <div data-submitting={String(isSubmitting)} data-testid="file-upload-section" />
  ),
}))

describe('FileForm', () => {
  beforeEach(() => {
    toastError.mockClear()
    toastSuccess.mockClear()
  })

  it('treats an edit load as pending file state instead of missing upload state', () => {
    renderFileForm({
      fileId: testId('file_1'),
      fileState: { status: 'loading', item: null, isPending: true, error: null },
    })

    expect(screen.getByText('Loading file...')).toBeInTheDocument()
    expect(screen.getByTestId('file-upload-section')).toHaveAttribute('data-submitting', 'true')
  })

  it('hydrates edit values when async file data becomes ready', async () => {
    const source = createFileFormSource()
    const upload = createUploadControl()
    const file = createFile({
      id: testId('file_1'),
      color: assertResourceItemColor('#3366ff'),
      iconName: 'FileText',
      name: 'Loaded handout',
      slug: 'loaded-handout',
      assetId: testId('storage_1'),
    })
    const { rerender } = render(
      <FileForm
        fileId={file.id}
        fileState={{ status: 'loading', item: null, isPending: true, error: null }}
        onClose={vi.fn()}
        source={source}
        upload={upload}
      />,
    )

    rerender(
      <FileForm
        fileId={file.id}
        fileState={{ status: 'ready', item: file, isPending: false, error: null }}
        onClose={vi.fn()}
        source={source}
        upload={upload}
      />,
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(source.updateItemMetadata).toHaveBeenCalledWith({
        color: assertResourceItemColor('#3366ff'),
        iconName: 'FileText',
        item: file,
        name: 'Loaded handout',
      })
    })
  })

  it('reports failed edit data instead of creating a replacement item', () => {
    const source = createFileFormSource()

    renderFileForm({
      fileId: testId('file_1'),
      fileState: { status: 'not_found', item: null, isPending: false, error: null },
      source,
    })

    expect(screen.getByText('File data failed to load. Please try again.')).toBeInTheDocument()
    expect(screen.getByLabelText('File Name (optional)')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('validates the effective uploaded filename when the optional name is blank', () => {
    const parentId: SidebarItemId = testId<'sidebarItems'>('parent_folder')
    const uploadedFile = new File(['duplicate'], 'duplicate.pdf', { type: 'application/pdf' })
    const source = createFileFormSource({
      validateItemName: vi.fn(() => ({ valid: false, error: 'Name already exists' })),
    })

    renderFileForm({
      parentId,
      source,
      upload: createUploadControl({
        file: uploadedFile,
        fileMetadata: { name: uploadedFile.name, size: uploadedFile.size, type: uploadedFile.type },
        preview: 'blob:duplicate',
      }),
    })

    expect(source.validateItemName).toHaveBeenCalledWith('duplicate.pdf', parentId, undefined)
    expect(screen.getByText('Name already exists')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  })

  it('updates existing file metadata when the stored file is still present', async () => {
    const file = createFile({
      id: testId('file_1'),
      name: 'Handout',
      slug: 'handout',
      assetId: testId('storage_1'),
    })
    const source = createFileFormSource()
    const onSuccess = vi.fn()

    renderFileForm({
      fileId: file.id,
      fileState: { status: 'ready', item: file, isPending: false, error: null },
      onSuccess,
      source,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(source.updateItemMetadata).toHaveBeenCalledWith({
        color: null,
        iconName: null,
        item: file,
        name: 'Handout',
      })
    })
    expect(toastSuccess).toHaveBeenCalledWith('File updated')
    expect(onSuccess).toHaveBeenCalledWith(assertResourceItemSlug('updated-handout'))
    expect(source.replaceFile).not.toHaveBeenCalled()
  })

  it('reports replacement upload failures after existing file metadata is saved', async () => {
    const replacement = new File(['updated'], 'updated.txt', { type: 'text/plain' })
    const file = createFile({
      id: testId('file_1'),
      name: 'Handout',
      slug: 'handout',
      assetId: testId('storage_1'),
    })
    const source = createFileFormSource()
    vi.mocked(source.replaceFile).mockRejectedValueOnce(new Error('Upload failed'))

    renderFileForm({
      fileId: file.id,
      fileState: { status: 'ready', item: file, isPending: false, error: null },
      source,
      upload: createUploadControl({
        file: replacement,
        fileMetadata: { name: 'updated.txt', size: replacement.size, type: 'text/plain' },
        preview: 'blob:updated',
      }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(source.updateItemMetadata).toHaveBeenCalled()
    })
    expect(source.replaceFile).toHaveBeenCalledWith({
      fileId: file.id,
      file: expect.objectContaining({
        contentType: 'text/plain',
        name: 'updated.txt',
        size: replacement.size,
      }),
    })
    expect(toastError).toHaveBeenCalledWith(
      'File details were saved, but the replacement upload failed.',
    )
    expect(toastSuccess).not.toHaveBeenCalledWith('File updated')
  })

  it('reports receipt-level replacement failures after existing file metadata is saved', async () => {
    const replacement = new File(['updated'], 'updated.txt', { type: 'text/plain' })
    const file = createFile({
      id: testId('file_1'),
      name: 'Handout',
      slug: 'handout',
      assetId: testId('storage_1'),
    })
    const source = createFileFormSource()
    vi.mocked(source.replaceFile).mockResolvedValueOnce({
      status: 'error',
      error: new Error('Upload failed'),
    })

    renderFileForm({
      fileId: file.id,
      fileState: { status: 'ready', item: file, isPending: false, error: null },
      source,
      upload: createUploadControl({
        file: replacement,
        fileMetadata: { name: 'updated.txt', size: replacement.size, type: 'text/plain' },
        preview: 'blob:updated',
      }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(source.updateItemMetadata).toHaveBeenCalled()
    })
    expect(toastError).toHaveBeenCalledWith(
      'File details were saved, but the replacement upload failed.',
    )
    expect(toastSuccess).not.toHaveBeenCalledWith('File updated')
  })

  it('creates a file, attaches the selected upload, opens it, and closes on success', async () => {
    const selectedFile = new File(['handout'], 'handout.txt', { type: 'text/plain' })
    const upload = createUploadControl({
      file: selectedFile,
      fileMetadata: { name: 'handout.txt', size: selectedFile.size, type: 'text/plain' },
      preview: 'blob:handout',
    })
    const source = createFileFormSource()
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    renderFileForm({ onClose, onSuccess, source, upload })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(source.replaceFile).toHaveBeenCalledWith({
        fileId: testId<'sidebarItems'>('created_file'),
        file: expect.objectContaining({
          contentType: 'text/plain',
          name: 'handout.txt',
          size: selectedFile.size,
        }),
      })
    })
    expect(source.createItem).toHaveBeenCalled()
    expect(source.openItem).toHaveBeenCalledWith(testId<'sidebarItems'>('created_file'))
    expect(toastSuccess).toHaveBeenCalledWith('File created')
    expect(onSuccess).toHaveBeenCalledWith(assertResourceItemSlug('created-file'))
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps created file success when opening the created file fails', async () => {
    const selectedFile = new File(['handout'], 'handout.txt', { type: 'text/plain' })
    const source = createFileFormSource()
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    vi.mocked(source.openItem).mockRejectedValueOnce(new Error('Open failed'))

    renderFileForm({
      onClose,
      onSuccess,
      source,
      upload: createUploadControl({
        file: selectedFile,
        fileMetadata: { name: 'handout.txt', size: selectedFile.size, type: 'text/plain' },
        preview: 'blob:handout',
      }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('File created')
    })
    expect(toastError).not.toHaveBeenCalledWith('Failed to save file')
    expect(onSuccess).toHaveBeenCalledWith(assertResourceItemSlug('created-file'))
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps created file success when opening the created file throws synchronously', async () => {
    const selectedFile = new File(['handout'], 'handout.txt', { type: 'text/plain' })
    const source = createFileFormSource()
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    vi.mocked(source.openItem).mockImplementationOnce(() => {
      throw new Error('Open failed')
    })

    renderFileForm({
      onClose,
      onSuccess,
      source,
      upload: createUploadControl({
        file: selectedFile,
        fileMetadata: { name: 'handout.txt', size: selectedFile.size, type: 'text/plain' },
        preview: 'blob:handout',
      }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('File created')
    })
    expect(toastError).not.toHaveBeenCalledWith('Failed to save file')
    expect(onSuccess).toHaveBeenCalledWith(assertResourceItemSlug('created-file'))
    expect(onClose).toHaveBeenCalled()
  })

  it('reports create failures as persistence failures after a valid upload is selected', async () => {
    const selectedFile = new File(['handout'], 'handout.txt', { type: 'text/plain' })
    const source = createFileFormSource()
    vi.mocked(source.createItem).mockResolvedValueOnce({
      status: 'failed',
      reason: 'create_failed',
    })

    renderFileForm({
      source,
      upload: createUploadControl({
        file: selectedFile,
        fileMetadata: { name: 'handout.txt', size: selectedFile.size, type: 'text/plain' },
        preview: 'blob:handout',
      }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Failed to create file')
    })
  })
})

function renderFileForm({
  fileId,
  fileState = { status: 'idle', item: null, isPending: false, error: null },
  onSuccess,
  onClose = vi.fn(),
  parentId,
  source = createFileFormSource(),
  upload = createUploadControl(),
}: {
  fileId?: SidebarItemId
  fileState?: FileFormEditState
  onClose?: () => void
  onSuccess?: (fileSlug?: string) => void
  parentId?: SidebarItemId | null
  source?: FileFormSource
  upload?: FileUploadControl
} = {}) {
  return render(
    <FileForm
      fileId={fileId}
      fileState={fileState}
      onClose={onClose}
      onSuccess={onSuccess}
      parentId={parentId}
      source={source}
      upload={upload}
    />,
  )
}

function createFileFormSource(overrides: Partial<FileFormSource> = {}): FileFormSource {
  const validName = { valid: true } satisfies ValidationResult
  return {
    createItem: vi.fn(async (_values, attachFile) => {
      const created = {
        status: 'completed' as const,
        id: testId<'sidebarItems'>('created_file'),
        slug: assertResourceItemSlug('created-file'),
      }
      await attachFile(created)
      return created
    }),
    openItem: vi.fn(),
    replaceFile: vi.fn(({ fileId }) => ({
      status: 'completed' as const,
      receipt: {
        kind: 'fileReplaced' as const,
        itemId: fileId,
        affectedCount: 1,
      },
    })),
    updateItemMetadata: vi.fn(() => ({
      slug: assertResourceItemSlug('updated-handout'),
    })),
    validateItemName: vi.fn(() => validName),
    ...overrides,
  }
}

function createUploadControl(overrides: Partial<FileUploadControl> = {}): FileUploadControl {
  return {
    file: null,
    fileInputRef: createRef<HTMLInputElement>(),
    fileMetadata: null,
    handleDrag: vi.fn(),
    handleDrop: vi.fn(),
    handleFileSelect: vi.fn(),
    isDragActive: false,
    isUploading: false,
    preview: '',
    uploadError: '',
    uploadProgress: { percentage: 0 },
    ...overrides,
  }
}
