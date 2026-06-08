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
      scale,
      width,
    }: {
      pageNumber: number
      onLoadSuccess?: (page: { originalWidth: number; originalHeight: number }) => void
      scale?: number
      width?: number
    }) => (
      <button
        type="button"
        data-testid={`pdf-page-${pageNumber}`}
        data-scale={scale ?? ''}
        data-width={width ?? ''}
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

    class ResizeObserverMock {
      readonly callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      disconnect = vi.fn()
      observe = (target: Element) => {
        this.callback(
          [
            {
              target,
              contentRect: {
                bottom: 300,
                height: 300,
                left: 0,
                right: 420,
                top: 0,
                width: 420,
                x: 0,
                y: 0,
                toJSON: () => ({}),
              },
            } as ResizeObserverEntry,
          ],
          this,
        )
      }
      unobserve = vi.fn()
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
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

  it('renders embed PDFs to the measured shadcn scroll viewport width', () => {
    render(
      <PdfFileViewer
        pdfUrl="https://example.convex.cloud/api/storage/file-1"
        presentation="embed"
      />,
    )

    expect(screen.getByTestId('pdf-file-viewer')).toHaveAttribute('data-presentation', 'embed')

    fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))

    expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument()
    expect(screen.getByTestId('pdf-page-1')).toHaveAttribute('data-width', '420')
    expect(screen.getByTestId('pdf-page-1')).toHaveAttribute('data-scale', '')
  })
})
