import { createContext } from 'react'
import type { MapPinId } from '../../../../../shared/common/ids'
import type { MapItemWithContent, MapPinWithItem } from '../../game-maps/item-contract'
import type { MapPinInteractionRequests, MapPinOperations } from './map-pin-operations'

export interface MapViewContextType {
  activeMap: MapItemWithContent | null
  activePin: MapPinWithItem | null
  canEditMap: boolean
  canViewPinItem: (pin: MapPinWithItem) => boolean
  pinOperations: MapPinOperations | null
  pinRequests: MapPinInteractionRequests | null
  setActivePinId: (pinId: MapPinId | null) => void
}

export const MapViewContext = createContext<MapViewContextType | null>(null)
