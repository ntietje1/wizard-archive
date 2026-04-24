import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FilePreview } from '../file-preview'

describe('FilePreview', () => {
  it('renders the direct image for image files', () => {
    render(
      <FilePreview
        downloadUrl="original.png"
        previewUrl="preview.png"
        contentType="image/png"
        alt="Handout"
      />,
    )

    expect(screen.getByAltText('Handout')).toHaveAttribute('src', 'original.png')
  })

  it('renders the generated preview for non-image files when available', () => {
    render(
      <FilePreview
        downloadUrl="document.pdf"
        previewUrl="preview.png"
        contentType="application/pdf"
        alt="Handout"
      />,
    )

    expect(screen.getByAltText('Handout')).toHaveAttribute('src', 'preview.png')
  })

  it('falls back from a failed direct image to the generated preview image', async () => {
    render(
      <FilePreview
        downloadUrl="original.png"
        previewUrl="preview.png"
        contentType="image/png"
        alt="Handout"
      />,
    )

    const image = screen.getByAltText('Handout')
    expect(image).toHaveAttribute('src', 'original.png')

    fireEvent.error(image)

    await waitFor(() => {
      expect(screen.getByAltText('Handout')).toHaveAttribute('src', 'preview.png')
    })
  })

  it('falls back to the unavailable state when no preview image is available', () => {
    render(
      <FilePreview
        downloadUrl="audio.mp3"
        previewUrl={null}
        contentType="audio/mpeg"
        alt="Handout"
      />,
    )

    expect(screen.getByText('File preview unavailable')).toBeInTheDocument()
  })

  it('falls back to the unavailable state when an image file has no generated preview and the direct image fails', async () => {
    render(
      <FilePreview
        downloadUrl="original.png"
        previewUrl={null}
        contentType="image/png"
        alt="Handout"
      />,
    )

    fireEvent.error(screen.getByAltText('Handout'))

    await waitFor(() => {
      expect(screen.getByText('File preview unavailable')).toBeInTheDocument()
    })
  })
})
