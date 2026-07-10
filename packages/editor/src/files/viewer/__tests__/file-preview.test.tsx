import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { FilePreview } from '../file-preview'

describe('FilePreview', () => {
  it('renders the direct image for image files', () => {
    render(
      <FilePreview
        downloadUrl="https://example.com/original.png"
        previewUrl="https://example.com/preview.png"
        contentType="image/png"
        fileName="original.png"
        alt="Handout"
      />,
    )

    expect(screen.getByAltText('Handout')).toHaveAttribute(
      'src',
      'https://example.com/original.png',
    )
  })

  it('renders the generated preview for non-image files when available', () => {
    render(
      <FilePreview
        downloadUrl="https://example.com/document.pdf"
        previewUrl="https://example.com/preview.png"
        contentType="application/pdf"
        fileName="document.pdf"
        alt="Handout"
      />,
    )

    expect(screen.getByAltText('Handout')).toHaveAttribute('src', 'https://example.com/preview.png')
  })

  it('treats image MIME types case-insensitively', () => {
    render(
      <FilePreview
        downloadUrl="https://example.com/original.png"
        previewUrl="https://example.com/preview.png"
        contentType="IMAGE/PNG"
        fileName="original.png"
        alt="Handout"
      />,
    )

    expect(screen.getByAltText('Handout')).toHaveAttribute(
      'src',
      'https://example.com/original.png',
    )
  })

  it('uses file-name classification for generic image downloads', () => {
    render(
      <FilePreview
        downloadUrl="https://example.com/original.webp"
        previewUrl="https://example.com/preview.png"
        contentType="application/octet-stream"
        fileName="original.webp"
        alt="Portrait"
      />,
    )

    expect(screen.getByAltText('Portrait')).toHaveAttribute(
      'src',
      'https://example.com/original.webp',
    )
  })

  it('falls back from an unsafe direct image URL to a valid generated preview image', () => {
    render(
      <FilePreview
        downloadUrl="http://example.com/original.png"
        previewUrl="https://example.com/preview.png"
        contentType="image/png"
        fileName="original.png"
        alt="Handout"
      />,
    )

    expect(screen.getByAltText('Handout')).toHaveAttribute('src', 'https://example.com/preview.png')
  })

  it('falls back from a failed direct image to the generated preview image', async () => {
    render(
      <FilePreview
        downloadUrl="https://example.com/original.png"
        previewUrl="https://example.com/preview.png"
        contentType="image/png"
        fileName="original.png"
        alt="Handout"
      />,
    )

    const image = screen.getByAltText('Handout')
    expect(image).toHaveAttribute('src', 'https://example.com/original.png')

    fireEvent.error(image)

    await waitFor(() => {
      expect(screen.getByAltText('Handout')).toHaveAttribute(
        'src',
        'https://example.com/preview.png',
      )
    })
  })

  it('clears failed image URLs when the preview is reused for another file', async () => {
    const { rerender } = render(
      <FilePreview
        downloadUrl="https://example.com/first.png"
        previewUrl={null}
        contentType="image/png"
        fileName="first.png"
        alt="First"
      />,
    )

    fireEvent.error(screen.getByAltText('First'))
    await waitFor(() => {
      expect(screen.getByText('File preview unavailable')).toBeInTheDocument()
    })

    rerender(
      <FilePreview
        downloadUrl="https://example.com/second.png"
        previewUrl={null}
        contentType="image/png"
        fileName="second.png"
        alt="Second"
      />,
    )

    expect(screen.getByAltText('Second')).toHaveAttribute('src', 'https://example.com/second.png')
  })

  it('falls back to the unavailable state when no preview image is available', () => {
    render(
      <FilePreview
        downloadUrl="https://example.com/audio.mp3"
        previewUrl={null}
        contentType="audio/mpeg"
        fileName="audio.mp3"
        alt="Handout"
      />,
    )

    expect(screen.getByText('File preview unavailable')).toBeInTheDocument()
  })

  it('does not classify fallback icons from alt text when the filename is absent', () => {
    const { container } = render(
      <FilePreview
        downloadUrl={null}
        previewUrl={null}
        contentType="application/octet-stream"
        fileName={null}
        alt="portrait.png"
      />,
    )

    expect(container.querySelector('.lucide-file')).toBeInTheDocument()
    expect(container.querySelector('.lucide-file-image')).not.toBeInTheDocument()
  })

  it('falls back to the unavailable state when an image file has no generated preview and the direct image fails', async () => {
    render(
      <FilePreview
        downloadUrl="https://example.com/original.png"
        previewUrl={null}
        contentType="image/png"
        fileName="original.png"
        alt="Handout"
      />,
    )

    fireEvent.error(screen.getByAltText('Handout'))

    await waitFor(() => {
      expect(screen.getByText('File preview unavailable')).toBeInTheDocument()
    })
  })
})
