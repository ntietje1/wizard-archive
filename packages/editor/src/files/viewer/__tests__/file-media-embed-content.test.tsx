import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { FileMediaEmbedContent } from '../file-media-embed-content'

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
    const onMediaLayout = vi.fn()
    render(
      <FileMediaEmbedContent
        downloadUrl="https://x.test/movie.mp4"
        contentType="video/mp4"
        previewUrl={null}
        name="movie.mp4"
        onMediaLayout={onMediaLayout}
      />,
    )

    const video = document.querySelector('video')
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error('Expected file video embed to render a video element')
    }
    Object.defineProperty(video, 'videoWidth', { value: 1920 })
    Object.defineProperty(video, 'videoHeight', { value: 1080 })
    fireEvent.loadedMetadata(video)

    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: expect.closeTo(16 / 9, 6),
    })
  })

  it('uses the file name to infer media embeds when MIME metadata is generic', () => {
    render(
      <FileMediaEmbedContent
        downloadUrl="https://x.test/movie"
        contentType="application/octet-stream"
        previewUrl={null}
        name="movie.mp4"
      />,
    )

    expect(document.querySelector('video')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /open file in new tab/i })).toBeNull()
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

  it('uses the unknown-file link fallback for non-authoritative storage urls', () => {
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
  })

  it('blocks unsafe media URLs instead of rendering them as media or fallback links', () => {
    render(
      <FileMediaEmbedContent
        downloadUrl="http://x.test/image.png"
        contentType="image/png"
        previewUrl={null}
        name="image.png"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid File URL')
    expect(screen.queryByRole('img', { name: 'image.png' })).toBeNull()
    expect(screen.queryByRole('link', { name: /open file in new tab/i })).toBeNull()
  })
})
