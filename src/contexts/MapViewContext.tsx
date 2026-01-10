import { useMemo, useState } from 'react'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { GameMap, MapPinWithItem } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
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
  const [activePinId, setActivePinId] = useState<Id<'mapPins'> | null>(null)

  const value = useMemo(() => {
    const pinnedItemIds = new Set<SidebarItemId>(
      pins.map((pin) => pin.item._id),
    )

    return {
      mapId: map?._id ?? null,
      pinnedItemIds,
      map: map ?? null,
      pinId: activePinId,
      setPinId: setActivePinId,
    }
  }, [map, pins, activePinId])

  return (
    <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>
  )
}
