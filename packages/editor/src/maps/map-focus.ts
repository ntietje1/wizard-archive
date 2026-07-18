import type { MapResourceContent } from '../resources/content-session-contract'
import type { MapPinId } from '../resources/domain-id'

export type MapFocus =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'base'; pinId: MapPinId }>
  | Readonly<{ kind: 'layer'; pinId: MapPinId; layerId: string }>
  | Readonly<{ kind: 'missing'; pinId: MapPinId }>

export function resolveMapFocus(
  content: MapResourceContent,
  focusedPinId: MapPinId | null,
): MapFocus {
  if (!focusedPinId) return { kind: 'none' }
  const pin = content.pins.find((candidate) => candidate.id === focusedPinId)
  if (!pin) return { kind: 'missing', pinId: focusedPinId }
  if (pin.layerId === null) return { kind: 'base', pinId: focusedPinId }
  return content.layers.some((layer) => layer.id === pin.layerId)
    ? { kind: 'layer', pinId: focusedPinId, layerId: pin.layerId }
    : { kind: 'missing', pinId: focusedPinId }
}
