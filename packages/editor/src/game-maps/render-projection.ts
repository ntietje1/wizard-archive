import type { MapLayer } from './document-contract'

type LayeredMapPin = {
  layerId?: string | null
}

export function filterMapPinsForLayer<TPin extends LayeredMapPin>(
  pins: Array<TPin>,
  activeLayerId: string | null,
  layers: ReadonlyArray<MapLayer>,
): Array<TPin> {
  if (layers.length === 0) return pins
  const defaultLayerId = layers[0]?.id ?? null
  const effectiveLayerId = activeLayerId ?? defaultLayerId
  if (effectiveLayerId === null) return pins
  return pins.filter((pin) => (pin.layerId ?? defaultLayerId) === effectiveLayerId)
}
