import { describe, expect, it } from 'vite-plus/test'
import type { MapLayer } from '../document-contract'
import { filterMapPinsForLayer } from '../render-projection'

describe('filterMapPinsForLayer', () => {
  const layers: Array<MapLayer> = [
    {
      id: 'base',
      imageAssetId: null,
      imageUrl: null,
      name: 'Base',
    },
    {
      id: 'upper',
      imageAssetId: null,
      imageUrl: null,
      name: 'Upper',
    },
  ]

  it('returns all pins when no active layer is selected', () => {
    const pins = [{ id: 'legacy-pin' }, { id: 'upper-pin', layerId: 'upper' }]

    expect(filterMapPinsForLayer(pins, null, layers)).toEqual(pins)
  })

  it('treats pins without a layer as belonging to the default layer', () => {
    expect(
      filterMapPinsForLayer(
        [
          { id: 'legacy-pin' },
          { id: 'base-pin', layerId: 'base' },
          { id: 'upper-pin', layerId: 'upper' },
        ],
        'base',
        layers,
      ),
    ).toEqual([{ id: 'legacy-pin' }, { id: 'base-pin', layerId: 'base' }])
  })
})
