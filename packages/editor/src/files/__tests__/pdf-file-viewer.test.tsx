import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { PdfFileViewer } from '../pdf-file-viewer'

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'pdf-worker.js' }))

vi.mock('react-pdf', () => ({
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
    onLoadSuccess: (value: { numPages: number }) => void
  }) => (
    <div data-file={file} data-testid="pdf-document">
      <button type="button" onClick={() => onLoadSuccess({ numPages: 3 })}>
        Load document
      </button>
      <button type="button" onClick={onLoadError}>
        Fail document
      </button>
      {children}
    </div>
  ),
  Page: ({ pageNumber, scale }: { pageNumber: number; scale: number }) => (
    <div data-page={pageNumber} data-scale={scale} data-testid="pdf-page" />
  ),
}))

describe('PdfFileViewer', () => {
  it('provides bounded page and zoom controls after loading', () => {
    render(<PdfFileViewer url="blob:pdf" />)

    expect(screen.getByLabelText('Loading PDF')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-document')).toHaveAttribute('data-file', 'blob:pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Load document' }))

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-page')).toHaveAttribute('data-page', '2')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByTestId('pdf-page')).toHaveAttribute('data-scale', '1.25')
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }))
    expect(screen.getByTestId('pdf-page')).toHaveAttribute('data-scale', '1')
  })

  it('shows a truthful document failure state', () => {
    render(<PdfFileViewer url="blob:invalid-pdf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Fail document' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load PDF')
  })
})
