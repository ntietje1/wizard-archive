import type { MapPinWithItem } from './item-contract'

export type EmbeddedMapState = {
  status: 'available' | 'unavailable'
  pins: Array<MapPinWithItem>
  isPinGhost: (pin: MapPinWithItem) => boolean
}
