import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExternalUrlEmbedContent } from '../external-url-embed-content'
import { FileMediaEmbedContent } from '../file-media-embed-content'
import type * as TanStackRouter from '@tanstack/react-router'
import type { ReactNode } from 'react'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>()
  return {
    ...actual,
    ClientOnly: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

vi.mock('~/features/editor/components/viewer/file/pdf-file-viewer', () => ({
  PdfFileViewer: ({
    pdfUrl,
    onFirstPageAspectRatio,
  }: {
    pdfUrl: string
    onFirstPageAspectRatio?: (aspectRatio: number | null) => void
  }) => (
    <button
      type="button"
      data-testid="pdf-viewer"
      data-url={pdfUrl}
      onClick={() => onFirstPageAspectRatio?.(0.75)}
    >
      report pdf ratio
    </button>
  ),
}))

vi.mock('~/features/file-upload/utils/file-url-validation', () => ({
  isValidFileUrl: () => true,
}))

describe('ExternalUrlEmbedContent', () => {
  it('renders images inline', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/a.png" name="a.png" />)

    expect(screen.getByRole('img', { name: 'a.png' })).toHaveAttribute(
      'src',
      'https://x.test/a.png',
    )
  })

  it('reports external image intrinsic aspect ratios', () => {
    const onIntrinsicAspectRatio = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/a.png"
        name="a.png"
        onIntrinsicAspectRatio={onIntrinsicAspectRatio}
      />,
    )

    const image = screen.getByRole('img', { name: 'a.png' })
    Object.defineProperty(image, 'naturalWidth', { value: 1600 })
    Object.defineProperty(image, 'naturalHeight', { value: 900 })
    fireEvent.load(image)

    expect(onIntrinsicAspectRatio).toHaveBeenLastCalledWith(1.777778)
  })

  it('renders video and audio urls with native media elements', () => {
    const { rerender } = render(
      <ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />,
    )
    expect(document.querySelector('video')).toHaveAttribute('src', 'https://x.test/movie.mp4')

    rerender(<ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />)
    expect(document.querySelector('audio')).toHaveAttribute('src', 'https://x.test/sound.mp3')
  })

  it('renders PDFs through the React PDF viewer', async () => {
    render(<ExternalUrlEmbedContent url="https://x.test/doc.pdf" name="doc.pdf" />)

    expect(await screen.findByTestId('pdf-viewer')).toHaveAttribute(
      'data-url',
      'https://x.test/doc.pdf',
    )
  })

  it('forwards external PDF page aspect ratios', async () => {
    const onIntrinsicAspectRatio = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/doc.pdf"
        name="doc.pdf"
        onIntrinsicAspectRatio={onIntrinsicAspectRatio}
      />,
    )

    fireEvent.click(await screen.findByTestId('pdf-viewer'))

    expect(onIntrinsicAspectRatio).toHaveBeenLastCalledWith(0.75)
  })

  it('renders unknown urls as open-link cards', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/download" name="download" />)

    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'https://x.test/download',
    )
  })
})

describe('FileMediaEmbedContent', () => {
  it('uses internal preview metadata for files', () => {
    render(
      <FileMediaEmbedContent
        downloadUrl="https://x.test/image.png"
        contentType="image/png"
        previewUrl={null}
        name="image.png"
      />,
    )

    expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute(
      'src',
      'https://x.test/image.png',
    )
  })

  it('reports file video intrinsic aspect ratios from media metadata', () => {
    const onIntrinsicAspectRatio = vi.fn()
    render(
      <FileMediaEmbedContent
        downloadUrl="https://x.test/movie.mp4"
        contentType="video/mp4"
        previewUrl={null}
        name="movie.mp4"
        onIntrinsicAspectRatio={onIntrinsicAspectRatio}
      />,
    )

    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    Object.defineProperty(video, 'videoWidth', { value: 1920 })
    Object.defineProperty(video, 'videoHeight', { value: 1080 })
    fireEvent.loadedMetadata(video!)

    expect(onIntrinsicAspectRatio).toHaveBeenLastCalledWith(1.777778)
  })

  it('falls back to a file preview when no download URL is available', () => {
    render(
      <FileMediaEmbedContent
        downloadUrl={null}
        contentType="application/pdf"
        previewUrl={null}
        name="missing.pdf"
      />,
    )

    expect(screen.getByText('File preview unavailable')).toBeInTheDocument()
  })

  it('uses the existing unknown-file link fallback even when the URL has a media extension', () => {
    render(
      <FileMediaEmbedContent
        downloadUrl="https://example.convex.cloud/api/storage/not-authoritative"
        contentType="application/octet-stream"
        previewUrl={null}
        name="download"
      />,
    )

    expect(screen.getByRole('link', { name: /open file in new tab/i })).toHaveAttribute(
      'href',
      'https://example.convex.cloud/api/storage/not-authoritative',
    )
    expect(screen.queryByRole('img', { name: 'download' })).not.toBeInTheDocument()
  })
})
