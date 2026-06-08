import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PdfFileViewer } from '../pdf-file-viewer'
import type { ReactNode } from 'react'

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'pdf-worker.js' }))

vi.mock('~/features/file-upload/utils/file-url-validation', () => ({
  isValidFileUrl: () => true,
}))

vi.mock('react-pdf', () => {
  return {
    pdfjs: { GlobalWorkerOptions: {} },
    Document: ({
      children,
      file,
      onLoadError,
      onLoadSuccess,
    }: {
      children: ReactNode
      file: string
      onLoadError: () => void
      onLoadSuccess: (result: { numPages: number }) => void
    }) => {
      return (
        <div data-testid="pdf-document" data-file={file}>
          <button type="button" onClick={() => onLoadSuccess({ numPages: 2 })}>
            load pdf
          </button>
          <button type="button" onClick={onLoadError}>
            fail pdf
          </button>
          {children}
        </div>
      )
    },
    Page: ({
      pageNumber,
      onLoadSuccess,
    }: {
      pageNumber: number
      onLoadSuccess?: (page: { originalWidth: number; originalHeight: number }) => void
    }) => (
      <button
        type="button"
        data-testid={`pdf-page-${pageNumber}`}
        onClick={() => onLoadSuccess?.({ originalWidth: 612, originalHeight: 792 })}
      >
        load page {pageNumber}
      </button>
    ),
  }
})

describe('PdfFileViewer', () => {
  beforeEach(() => {
    class IntersectionObserverMock {
      disconnect = vi.fn()
      observe = vi.fn()
      unobserve = vi.fn()
    }

    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
  })

  it('shows the PDF load failure without leaving the loading overlay active', () => {
    render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'fail pdf' }))

    expect(screen.getByText('Failed to load PDF')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
  })

  it('reserves full embed width while the PDF document is loading', () => {
    render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)

    expect(screen.getByTestId('pdf-file-viewer')).toHaveClass('w-full', 'min-w-full')
    expect(screen.getByRole('status', { name: 'Loading PDF' })).toHaveClass('w-full', 'min-w-full')
  })

  it('resets document state when the PDF viewer is remounted for a new URL', () => {
    const { rerender } = render(
      <PdfFileViewer key="file-1" pdfUrl="https://example.convex.cloud/api/storage/file-1" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'fail pdf' }))

    rerender(
      <PdfFileViewer key="file-2" pdfUrl="https://example.convex.cloud/api/storage/file-2" />,
    )

    expect(screen.queryByText('Failed to load PDF')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading PDF' })).toBeInTheDocument()
  })

  it('reports the first PDF page aspect ratio', () => {
    const onFirstPageAspectRatio = vi.fn()
    render(
      <PdfFileViewer
        pdfUrl="https://example.convex.cloud/api/storage/file-1"
        onFirstPageAspectRatio={onFirstPageAspectRatio}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))
    fireEvent.click(screen.getByTestId('pdf-page-1'))
    fireEvent.click(screen.getByTestId('pdf-page-2'))

    expect(onFirstPageAspectRatio).toHaveBeenCalledTimes(1)
    expect(onFirstPageAspectRatio).toHaveBeenCalledWith(0.772727)
  })
})
