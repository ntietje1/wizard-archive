import { createContext, useContext, useMemo } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { GameMap, MapPinWithItem  } from 'convex/gameMaps/types'

interface MapViewContextType {
  mapId: Id<'gameMaps'> | null
  pinnedItemIds: Set<SidebarItemId>
  map: GameMap | null
}

const MapViewContext = createContext<MapViewContextType | null>(null)

export function MapViewProvider({
  map,
  pins,
  children,
}: {
  map: GameMap | null
  pins: Array<MapPinWithItem>
  children: React.ReactNode
}) {
  const value = useMemo(() => {
    const pinnedItemIds = new Set<SidebarItemId>(
      pins.map((pin) => pin.item._id),
    )

    return {
      mapId: map?._id ?? null,
      pinnedItemIds,
      map: map ?? null,
    }
  }, [map, pins])

  return (
    <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>
  )
}

export function useMapView() {
  const context = useContext(MapViewContext)
  // Return default values when context is null (not viewing a map)
  return (
    context ?? {
      mapId: null,
      pinnedItemIds: new Set<SidebarItemId>(),
      map: null,
    }
  )
}
