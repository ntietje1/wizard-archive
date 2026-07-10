import type { AssetId } from '../../../../shared/common/ids'
import type { MapLayer } from './document-contract'

export interface MapImageSource {
  imageAssetId: AssetId | null
  imageUrl: string | null
  layers?: ReadonlyArray<MapLayer>
}

export interface ResolvedMapImage {
  imageAssetId: AssetId | null
  imageUrl: string | null
  layer: MapLayer | null
}

export function resolveMapImage(
  map: MapImageSource,
  selectedLayerId?: string | null,
): ResolvedMapImage {
  const layers = map.layers ?? []
  const activeLayer = getActiveMapLayer(layers, selectedLayerId ?? layers[0]?.id ?? null)
  if (!activeLayer) {
    return {
      imageAssetId: map.imageAssetId,
      imageUrl: map.imageUrl,
      layer: null,
    }
  }
  return {
    imageAssetId: activeLayer.imageAssetId,
    imageUrl: activeLayer.imageUrl,
    layer: activeLayer,
  }
}

export function withResolvedMapImage<TMap extends MapImageSource>(
  map: TMap,
  selectedLayerId?: string | null,
): TMap {
  const resolved = resolveMapImage(map, selectedLayerId)
  return {
    ...map,
    imageAssetId: resolved.imageAssetId,
    imageUrl: resolved.imageUrl,
  }
}

function getActiveMapLayer(
  layers: ReadonlyArray<MapLayer>,
  selectedLayerId: string | null,
): MapLayer | null {
  if (layers.length === 0) return null
  return layers.find((layer) => layer.id === selectedLayerId) ?? layers[0] ?? null
}
