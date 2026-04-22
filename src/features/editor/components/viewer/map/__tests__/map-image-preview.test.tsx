import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapImagePreview } from '../map-image-preview'

describe('MapImagePreview', () => {
  it('renders the map image when a preview URL is available', () => {
    render(<MapImagePreview imageUrl="map.png" />)

    expect(screen.getByAltText('Map preview')).toHaveAttribute('src', 'map.png')
  })

  it('falls back when the image is missing or errors', () => {
    render(<MapImagePreview imageUrl="map.png" />)

    const image = screen.getByAltText('Map preview')
    fireEvent.error(image)

    expect(screen.getByText('Map image not available')).toBeInTheDocument()
    expect(screen.queryByAltText('Map preview')).toBeNull()
  })

  it('falls back when no map image URL is available', () => {
    render(<MapImagePreview imageUrl={null} />)

    expect(screen.getByText('Map image not available')).toBeInTheDocument()
  })
})
