import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GameMapWithContent } from 'shared/game-maps/types'
import { EmbeddedMapContent } from '../embedded-map-content'
import { createGameMap } from '~/test/factories/sidebar-item-factory'

vi.mock('~/features/editor/components/viewer/map/map-pins-layer', () => ({
  MapPinsLayer: () => <div data-testid="map-pins-layer" />,
}))

vi.mock('~/features/editor/components/viewer/map/map-image-preview', () => ({
  MapImagePreview: ({ imageUrl }: { imageUrl: string | null }) => (
    <div data-testid="map-image-preview">{imageUrl}</div>
  ),
}))

describe('EmbeddedMapContent', () => {
  it('reports the loaded map image aspect ratio through the embed media layout contract', () => {
    const onMediaLayout = vi.fn()

    render(<EmbeddedMapContent map={createMap()} onMediaLayout={onMediaLayout} />)

    const image = screen.getByRole('img', { name: 'Dungeon' })
    Object.defineProperty(image, 'naturalWidth', { value: 800, configurable: true })
    Object.defineProperty(image, 'naturalHeight', { value: 400, configurable: true })

    fireEvent.load(image)

    expect(onMediaLayout).toHaveBeenCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 2,
    })
  })
})

function createMap(): GameMapWithContent {
  const map = {
    ...createGameMap({ name: 'Dungeon', imageUrl: 'map.png' }),
    imageUrl: 'map.png',
    pins: [],
  }
  return map as unknown as GameMapWithContent
}
