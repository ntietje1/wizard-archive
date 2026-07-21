import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { MapEmbedPreview } from '../map-embed-preview'
import type { MapContentSnapshot } from '../../resources/content-session-contract'
import { assertSha256Digest, initialVersion } from '../../resources/component-version'
import { generateDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

afterEach(() => vi.restoreAllMocks())

describe('MapEmbedPreview', () => {
  it('loads the canonical base map image into a read-only embed', async () => {
    const createObjectUrl = vi.fn(() => 'blob:map-preview')
    const revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })
    const loadImage = vi.fn(() =>
      Promise.resolve({
        status: 'ready' as const,
        bytes: Uint8Array.of(1, 2, 3),
        extension: 'png',
        mediaType: 'image/png',
      }),
    )
    const preview = mapPreview(loadImage)
    const view = render(<MapEmbedPreview preview={preview} title="Harbor map" />)

    const image = await screen.findByRole('img', { name: 'Harbor map' })
    expect(image).toHaveAttribute('src', 'blob:map-preview')
    expect(image.parentElement).toHaveAttribute('data-slot', 'map-image-pin-layout')
    expect(image.nextElementSibling).toHaveAttribute('data-slot', 'map-pin-layer')
    expect(loadImage).toHaveBeenCalledWith(null)
    expect(createObjectUrl).toHaveBeenCalledOnce()

    view.unmount()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:map-preview')
  })
})

function mapPreview(loadImage: MapContentSnapshot['loadImage']): MapContentSnapshot {
  return {
    content: {
      image: {
        status: 'attached',
        byteSize: 3,
        digest: assertSha256Digest('a'.repeat(64)),
        mediaType: 'image/png',
      },
      layers: [],
      pins: [
        {
          id: generateDomainId(DOMAIN_ID_KIND.mapPin),
          destination: { kind: 'unresolved', rawTarget: 'Harbor' },
          layerId: null,
          visible: true,
          x: 25,
          y: 75,
        },
      ],
    },
    version: initialVersion(assertSha256Digest('b'.repeat(64))),
    loadImage,
  }
}
