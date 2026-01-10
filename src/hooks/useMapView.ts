import { createContext, useContext } from 'react'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import type { GameMap } from 'convex/gameMaps/types'

export interface MapViewContextType {
  mapId: Id<'gameMaps'> | null
  pinnedItemIds: Set<SidebarItemId>
  map: GameMap | null
  pinId: Id<'mapPins'> | null
  setPinId: (pinId: Id<'mapPins'> | null) => void
}
export const MapViewContext = createContext<MapViewContextType | null>(null)

export function useMapView(): MapViewContextType {
  const context = useContext(MapViewContext)
  return (
    context ?? {
      mapId: null,
      pinnedItemIds: new Set<SidebarItemId>(),
      map: null,
      pinId: null,
      setPinId: () => {},
    }
  )
}
