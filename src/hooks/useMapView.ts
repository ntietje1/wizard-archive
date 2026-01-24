import { createContext, useContext } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'

export interface MapViewContextType {
  activeMap: GameMapWithContent | null
  activePin: MapPinWithItem | null
  setActivePinId: (pinId: Id<'mapPins'> | null) => void
}
export const MapViewContext = createContext<MapViewContextType | null>(null)

export function useMapView(): MapViewContextType {
  const context = useContext(MapViewContext)
  return (
    context ?? {
      activeMap: null,
      activePin: null,
      setActivePinId: () => {},
    }
  )
}
