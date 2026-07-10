import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { PdfFileViewer } from '../pdf-file-viewer'
import type { ReactNode } from 'react'

const { isValidFileUrlMock, pdfPageCount } = vi.hoisted(() => ({
  isValidFileUrlMock: vi.fn<(url: string) => boolean>(() => true),
  pdfPageCount: { current: 2 },
}))

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'pdf-worker.js' }))

vi.mock('../file-url-validation', () => ({
  isValidFileUrl: isValidFileUrlMock,
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
          <button type="button" onClick={() => onLoadSuccess({ numPages: pdfPageCount.current })}>
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
  let intersectionObserverCallbacks: Array<IntersectionObserverCallback>

  beforeEach(() => {
    isValidFileUrlMock.mockReturnValue(true)
    pdfPageCount.current = 2
    intersectionObserverCallbacks = []
    HTMLElement.prototype.getAnimations = vi.fn(() => [])

    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        intersectionObserverCallbacks.push(callback)
      }

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

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the PDF load failure state', () => {
    render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'fail pdf' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load PDF')
  })

  it('reports a cleared aspect ratio when the PDF URL is invalid', () => {
    isValidFileUrlMock.mockImplementation((url: string) => !url.includes('invalid'))
    const onFirstPageAspectRatio = vi.fn()
    const { rerender } = render(
      <PdfFileViewer
        pdfUrl="https://example.convex.cloud/api/storage/file-1"
        onFirstPageAspectRatio={onFirstPageAspectRatio}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))
    fireEvent.click(screen.getByTestId('pdf-page-1'))

    rerender(
      <PdfFileViewer
        pdfUrl="http://invalid.example/file.pdf"
        onFirstPageAspectRatio={onFirstPageAspectRatio}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid PDF URL')
    expect(onFirstPageAspectRatio).toHaveBeenLastCalledWith(null)
  })

  it('shows the loading state until the PDF document loads', () => {
    render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)

    expect(screen.getByRole('status', { name: 'Loading PDF' })).toBeInTheDocument()
    expect(screen.getByTestId('pdf-document')).toHaveAttribute(
      'data-file',
      'https://example.convex.cloud/api/storage/file-1',
    )

    fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))

    expect(screen.queryByRole('status', { name: 'Loading PDF' })).toBeNull()
  })

  it('resets document state when the PDF URL changes on the same viewer instance', () => {
    const { rerender } = render(
      <PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'fail pdf' }))

    rerender(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-2" />)

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

    expect(screen.getByTestId('pdf-file-viewer')).toHaveClass('nowheel')
    expect(screen.getByTestId('pdf-file-viewer')).toHaveAttribute(
      'data-inner-scroll-enabled',
      'true',
    )
    expect(screen.getByTestId('pdf-page-1')).toHaveAttribute('data-width', '420')
    expect(screen.getByTestId('pdf-page-1')).toHaveAttribute('data-scale', '')
  })

  it('keeps embed PDF scrolling inert until the embed surface allows inner scroll', () => {
    render(
      <PdfFileViewer
        pdfUrl="https://example.convex.cloud/api/storage/file-1"
        presentation="embed"
        allowInnerScroll={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))

    expect(screen.getByTestId('pdf-file-viewer')).toHaveAttribute(
      'data-inner-scroll-enabled',
      'false',
    )
    expect(
      screen.getByTestId('pdf-file-viewer').querySelector('[data-slot="scroll-area-viewport"]'),
    ).toHaveStyle({ overflow: 'hidden' })
  })

  it('leaves browser ctrl-wheel zoom available in embed mode', () => {
    render(
      <PdfFileViewer
        pdfUrl="https://example.convex.cloud/api/storage/file-1"
        presentation="embed"
      />,
    )

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -100,
    })
    screen.getByTestId('pdf-file-viewer').dispatchEvent(wheelEvent)

    expect(wheelEvent.defaultPrevented).toBe(false)
  })

  it('zooms full PDFs with ctrl-wheel before the browser handles the wheel gesture', () => {
    render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))

    fireEvent.wheel(screen.getByTestId('pdf-file-viewer'), {
      ctrlKey: true,
      deltaY: -100,
    })

    expect(screen.getByTestId('pdf-page-1')).toHaveAttribute('data-scale', '1.25')
  })

  it('handles full PDF ctrl-wheel zoom with a non-passive native wheel listener', () => {
    const addEventListener = vi.spyOn(HTMLDivElement.prototype, 'addEventListener')

    try {
      render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)

      expect(addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), {
        passive: false,
      })
    } finally {
      addEventListener.mockRestore()
    }
  })

  it('updates PDF toolbar page controls from page visibility and navigation clicks', async () => {
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    )
    HTMLElement.prototype.scrollIntoView = scrollIntoView

    try {
      render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)
      fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))

      expect(screen.getByText('Page 1 of 2')).toHaveAttribute('aria-live', 'polite')
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()

      fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })

      const page2 = screen.getByTestId('pdf-page-2').closest('[data-page-number="2"]')
      expect(page2).not.toBeNull()
      intersectionObserverCallbacks.at(-1)?.(
        [
          {
            target: page2,
            intersectionRatio: 1,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )

      await waitFor(() => expect(screen.getByText('Page 2 of 2')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
      }
    }
  })

  it('mounts PDF pages near the visible page and keeps offscreen page anchors', async () => {
    pdfPageCount.current = 8
    render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))

    expect(screen.getByTestId('pdf-page-1')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-page-2')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-page-3')).toBeInTheDocument()
    expect(screen.queryByTestId('pdf-page-4')).toBeNull()
    expect(screen.getByTestId('pdf-page-placeholder-4')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-page-placeholder-8')).toBeInTheDocument()

    const page5Anchor = screen.getByTestId('pdf-page-placeholder-5').closest('[data-page-number]')
    if (!page5Anchor) {
      throw new Error('Expected page 5 anchor to exist')
    }
    intersectionObserverCallbacks.at(-1)?.(
      [
        {
          target: page5Anchor,
          intersectionRatio: 1,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

    await waitFor(() => expect(screen.getByText('Page 5 of 8')).toBeInTheDocument())
    expect(screen.queryByTestId('pdf-page-1')).toBeNull()
    expect(screen.getByTestId('pdf-page-placeholder-1')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-page-3')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-page-7')).toBeInTheDocument()
    expect(screen.queryByTestId('pdf-page-8')).toBeNull()
  })

  it('loads PDF pages when page visibility tracking is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    render(<PdfFileViewer pdfUrl="https://example.convex.cloud/api/storage/file-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'load pdf' }))

    expect(screen.getByTestId('pdf-page-1')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })
})
