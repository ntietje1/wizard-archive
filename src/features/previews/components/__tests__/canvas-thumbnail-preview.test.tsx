import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CanvasThumbnailPreview } from '../canvas-thumbnail-preview'

describe('CanvasThumbnailPreview', () => {
  it('renders the canvas thumbnail when a preview image is available', () => {
    render(<CanvasThumbnailPreview previewUrl="canvas.png" alt="Canvas preview" />)

    expect(screen.getByAltText('Canvas preview')).toHaveAttribute('src', 'canvas.png')
  })

  it('falls back to a placeholder when the preview image is missing or errors', () => {
    render(<CanvasThumbnailPreview previewUrl="canvas.png" alt="Canvas preview" />)

    fireEvent.error(screen.getByAltText('Canvas preview'))

    expect(screen.getByText('Canvas preview unavailable')).toBeInTheDocument()
  })

  it('falls back to a placeholder when no preview URL is provided', () => {
    render(<CanvasThumbnailPreview previewUrl={null} alt="Canvas preview" />)

    expect(screen.getByText('Canvas preview unavailable')).toBeInTheDocument()
  })
})
