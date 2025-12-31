import { useMemo } from 'react'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { GameMap, MapPinWithItem } from 'convex/gameMaps/types'
import { MapViewContext } from '~/hooks/useMapView'

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
