import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileViewer } from '../file-viewer'
import { FileViewerSourceProvider } from '../file-viewer-source'
import { createFile } from '~/test/factories/sidebar-item-factory'
import type { FileWithContent } from 'shared/files/types'

const { fileContentViewerMock, fileUploadEmptyStateMock, replaceFileMock } = vi.hoisted(() => ({
  fileContentViewerMock: vi.fn(),
  fileUploadEmptyStateMock: vi.fn(),
  replaceFileMock: vi.fn(),
}))

vi.mock('../file-content-viewer', () => ({
  FileContentViewer: (props: Record<string, unknown>) => {
    fileContentViewerMock(props)
    return <div data-testid="file-content-viewer" />
  },
}))

vi.mock('~/features/file-upload/components/file-upload-empty-state', () => ({
  FileUploadEmptyState: (props: Record<string, unknown>) => {
    fileUploadEmptyStateMock(props)
    return <div data-testid="empty-file-upload" />
  },
}))

describe('FileViewer', () => {
  it('renders file content from the configured source and delegates replacement', () => {
    const file = createFile({
      _id: 'file-1' as FileWithContent['_id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: 'text/plain',
    }) as FileWithContent
    const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })

    render(
      <FileViewerSourceProvider
        value={{
          resolveFile: () => ({
            allowObjectUrl: true,
            contentType: 'text/plain',
            downloadUrl: 'blob:handout',
            name: 'Handout.txt',
            size: 12,
          }),
          getEmptyFileUpload: () => null,
          replaceFile: replaceFileMock,
        }}
      >
        <FileViewer item={file} />
      </FileViewerSourceProvider>,
    )

    expect(screen.getByTestId('file-content-viewer')).toBeInTheDocument()
    expect(fileContentViewerMock).toHaveBeenCalledWith({
      allowObjectUrl: true,
      contentType: 'text/plain',
      downloadUrl: 'blob:handout',
      name: 'Handout.txt',
    })
    expect(screen.getByText('text/plain · 12 B')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'blob:handout')

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [replacement] },
    })

    expect(replaceFileMock).toHaveBeenCalledWith(file, replacement)
    expect(fileUploadEmptyStateMock).not.toHaveBeenCalled()
  })

  it('renders the empty file upload state from source-provided upload capability', () => {
    const file = createFile({
      _id: 'file-1' as FileWithContent['_id'],
      name: 'Handout',
      downloadUrl: null,
      contentType: null,
    }) as FileWithContent
    const fileUpload = { isUploading: false }

    render(
      <FileViewerSourceProvider
        value={{
          resolveFile: () => ({
            allowObjectUrl: false,
            contentType: null,
            downloadUrl: null,
            name: 'Handout',
            size: null,
          }),
          getEmptyFileUpload: () => ({ fileUpload: fileUpload as never, isSubmitting: true }),
        }}
      >
        <FileViewer item={file} />
      </FileViewerSourceProvider>,
    )

    expect(screen.getByTestId('empty-file-upload')).toBeInTheDocument()
    expect(fileUploadEmptyStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUpload,
        title: 'Upload File',
        isSubmitting: true,
      }),
    )
    expect(fileContentViewerMock).not.toHaveBeenCalled()
  })
})
