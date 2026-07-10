import { describe, expect, it } from 'vitest'
import { resolveMapImage, withResolvedMapImage } from '../image-resolution'
import type { MapImageSource } from '../image-resolution'
import type { AssetId } from '../../../../../shared/common/ids'

describe('map image resolution', () => {
  it('uses the base map image when no layers exist', () => {
    expect(resolveMapImage(baseMap())).toEqual({
      imageAssetId: 'base-storage',
      imageUrl: 'base.png',
      layer: null,
    })
  })

  it('uses the first layer as the default export image for layered maps', () => {
    expect(resolveMapImage(layeredMap())).toEqual({
      imageAssetId: 'layer-1-storage',
      imageUrl: 'layer-1.png',
      layer: layeredMap().layers?.[0],
    })
  })

  it('uses the selected layer image when a selected layer is provided', () => {
    expect(resolveMapImage(layeredMap(), 'layer-2')).toEqual({
      imageAssetId: 'layer-2-storage',
      imageUrl: 'layer-2.png',
      layer: layeredMap().layers?.[1],
    })
  })

  it('falls back to the first layer when the selected layer is stale', () => {
    expect(resolveMapImage(layeredMap(), 'missing-layer').imageUrl).toBe('layer-1.png')
  })

  it('can project a map object with the resolved image while preserving other fields', () => {
    expect(withResolvedMapImage({ ...layeredMap(), name: 'Ruins' }, 'layer-2')).toMatchObject({
      imageAssetId: 'layer-2-storage',
      imageUrl: 'layer-2.png',
      name: 'Ruins',
    })
  })
})

function baseMap(): MapImageSource {
  return {
    imageAssetId: assetId('base-storage'),
    imageUrl: 'base.png',
  }
}

function layeredMap(): MapImageSource {
  return {
    imageAssetId: assetId('base-storage'),
    imageUrl: 'base.png',
    layers: [
      {
        id: 'layer-1',
        imageAssetId: assetId('layer-1-storage'),
        imageUrl: 'layer-1.png',
        name: 'Layer 1',
      },
      {
        id: 'layer-2',
        imageAssetId: assetId('layer-2-storage'),
        imageUrl: 'layer-2.png',
        name: 'Layer 2',
      },
    ],
  }
}

function assetId(value: string) {
  return value as AssetId
}
