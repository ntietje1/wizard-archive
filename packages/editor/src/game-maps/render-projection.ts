import type { MapLayer } from './document-contract'

type LayeredMapPin = {
  layerId?: string | null
}

export function filterMapPinsForLayer<TPin extends LayeredMapPin>(
  pins: Array<TPin>,
  activeLayerId: string | null,
  layers: ReadonlyArray<MapLayer>,
): Array<TPin> {
  if (!activeLayerId) return pins
  const defaultLayerId = layers[0]?.id ?? null
  return pins.filter((pin) => (pin.layerId ?? defaultLayerId) === activeLayerId)
}
