import type { MapPinWithItem } from './item-contract'

export type EmbeddedMapState =
  | {
      status: 'available'
      pins: Array<MapPinWithItem>
      isPinGhost: (pin: MapPinWithItem) => boolean
    }
  | {
      status: 'unavailable'
    }
